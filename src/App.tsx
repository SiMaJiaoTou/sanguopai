import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import { type SlotTarget, type PowerSnapshot, useGameStore } from './store';
import { evaluateHand } from './evaluate';
import { buildEvalContext, adjustedPointValue } from './talents';
import {
  ROUND_CONFIGS,
  FINAL_ROUND,
  FACTION_THEME,
  LEVEL_EXP_REQUIRED,
  ECONOMY_CONFIG,
} from './data';
import type { Card, RankTypeKey } from './types';

import { TopBar } from './components/TopBar';
import { BattleField3D } from './components/BattleField3D';
import { HandArea } from './components/HandArea';
import { CardView } from './components/CardView';
import { GameOverModal } from './components/GameOverModal';
import { RedrawZone } from './components/RedrawZone';
import { HandTypeTable } from './components/HandTypeTable';
import { PowerChart } from './components/PowerChart';
import { RecruitPanel } from './components/RecruitPanel';
import { Toast } from './components/Toast';
import { HandEffect, buildEffect, type EffectTrigger } from './components/HandEffect';
import { GMTool } from './components/GMTool';
import { TeamTabs } from './components/TeamTabs';
import { FormationBroadcast } from './components/FormationBroadcast';
import { AIStandings } from './components/AIStandings';
import { DeckDrawer } from './components/DeckDrawer';
import { DuelOverlay } from './components/DuelOverlay';
import { ModeSelectionModal } from './components/ModeSelectionModal';
import { TalentPickerModal } from './components/TalentPickerModal';
import { TalentsPanel } from './components/TalentsPanel';
import { LobbyScreens } from './components/LobbyScreens';
import { useLobbyStore } from './net/lobbyStore';
import { network } from './net/Network';
import { useUnifiedGame, useIsOnline } from './net/useUnifiedGame';
import { startSession, stopSession, dispatchGameAction } from './net/session';

function findCardById(
  hand: Card[],
  teams: (Card | null)[][],
  id: string,
): Card | null {
  const h = hand.find((c) => c.id === id);
  if (h) return h;
  for (const t of teams) for (const c of t) if (c?.id === id) return c;
  return null;
}

export default function App() {
  // 单机与联机统一接口：state 同时扮演 useGameStore 的角色
  const state = useUnifiedGame();
  const isOnline = useIsOnline();
  // 单机模式下我们还需要直接访问 useGameStore 的 nextRound/settleFinal
  // （UnifiedGame 不暴露 round 推进，因为联机由 host 自动驱动）
  const singleNextRound = useGameStore((s) => s.nextRound);
  const singleSettleFinal = useGameStore((s) => s.settleFinal);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [effect, setEffect] = useState<EffectTrigger | null>(null);
  const [activeTeamIndex, setActiveTeamIndex] = useState<0 | 1>(0);
  // 记录上一次触发过特效的牌型签名，避免重复播放
  const lastEffectSig = useRef<string>('');

  // ========== 大厅 / 联机屏幕控制 ==========
  const lobbyScreen = useLobbyStore((s) => s.screen);
  const setLobbyScreen = useLobbyStore((s) => s.setScreen);
  const isHost = useLobbyStore((s) => s.isHost);
  const roomCode = useLobbyStore((s) => s.roomCode);
  const peers = useLobbyStore((s) => s.peers);

  const showLobby = lobbyScreen !== 'inGame';

  // 进入单机
  const handleEnterSinglePlayer = () => {
    // 确保联机 session 不在运行
    stopSession();
    setLobbyScreen('inGame');
  };
  // Host 擂鼓出征：启动 session，通知所有成员同步进入
  const handleEnterOnlineGame = () => {
    startSession();
    network.sendHostEvent({ t: 'gameStart' });
    setLobbyScreen('inGame');
  };

  // 非 host 收到 gameStart 时进入游戏
  useEffect(() => {
    const unsub = network.subscribe({
      onHostEvent: (payload) => {
        if (payload.t === 'gameStart') {
          // 作为 client 启动 session
          startSession();
          setLobbyScreen('inGame');
        }
      },
    });
    return () => {
      unsub();
    };
  }, [setLobbyScreen]);

  // 退出游戏 → 停止 session
  useEffect(() => {
    if (showLobby) {
      stopSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLobby]);

  useEffect(() => {
    // 单机模式：进入游戏屏幕后，玩家已选择模式时才开局
    if (
      !isOnline &&
      !showLobby &&
      state.modeChosen &&
      state.hand.length === 0 &&
      state.deck.length === 0 &&
      state.round === 0 &&
      state.gold === 0
    ) {
      state.startNewGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.modeChosen, showLobby, isOnline]);

  const cfg = ROUND_CONFIGS[state.round];
  const teamsRequired = cfg.teamsRequired;

  // 【白龙马】：手牌中的数量 → 结算时阵法倍率 +1（传给 ctx）
  const bailongInHand = useMemo(
    () => state.hand.filter((c) => c.horseSeal === 'bailong').length,
    [state.hand],
  );

  // 天赐被动效果上下文
  const evalCtx = useMemo(
    () => buildEvalContext(state.talents, { gold: state.gold, bailongInHand }),
    [state.talents, state.gold, bailongInHand],
  );

  // 每队评估（仅满 5 员才成阵；否则按"武勇和 × 1 倍率"累计）
  const team0Eval = useMemo(() => {
    const cards = state.teams[0].filter((c): c is Card => !!c);
    return cards.length === 5 ? evaluateHand(cards, evalCtx) : null;
  }, [state.teams, evalCtx]);
  const team1Eval = useMemo(() => {
    const cards = state.teams[1].filter((c): c is Card => !!c);
    return cards.length === 5 ? evaluateHand(cards, evalCtx) : null;
  }, [state.teams, evalCtx]);

  // 手握百员加成：每张手牌基础勇武 +2（队伍未成阵时按部分战力叠加）
  const perHandBonus = useMemo(() => {
    const has = state.talents.some((t) => t.templateId === 'per_hand_card_2');
    return has ? state.hand.length * 2 : 0;
  }, [state.talents, state.hand.length]);

  // 散金养士：每 1 金币基础勇武 +2（未成阵时也叠加到部分战力上）
  const goldBonus = useMemo(() => {
    const has = state.talents.some((t) => t.templateId === 'gold_to_prowess');
    return has ? state.gold * 2 : 0;
  }, [state.talents, state.gold]);

  // 未成阵时的部分军势：经天赐 + 手握百员 + 散金养士 调整后的武勇和
  const team0PartialPower = useMemo(() => {
    if (team0Eval) return team0Eval.power;
    const base = state.teams[0]
      .filter((c): c is Card => !!c)
      .reduce(
        (s, c) =>
          s +
          adjustedPointValue(c, evalCtx),
        0,
      );
    return base + perHandBonus + goldBonus;
  }, [state.teams, team0Eval, evalCtx, perHandBonus, goldBonus]);
  const team1PartialPower = useMemo(() => {
    if (team1Eval) return team1Eval.power;
    const base = state.teams[1]
      .filter((c): c is Card => !!c)
      .reduce(
        (s, c) =>
          s +
          adjustedPointValue(c, evalCtx),
        0,
      );
    return base + (teamsRequired >= 2 ? perHandBonus + goldBonus : 0);
  }, [state.teams, team1Eval, evalCtx, perHandBonus, goldBonus, teamsRequired]);

  // 为满阵队伍也叠加"手握百员"（evaluateHand 已含 gold-to-prowess）
  const team0PowerFinal = useMemo(() => {
    if (!team0Eval) return team0PartialPower;
    return team0Eval.power + perHandBonus;
  }, [team0Eval, team0PartialPower, perHandBonus]);
  const team1PowerFinal = useMemo(() => {
    if (!team1Eval) return team1PartialPower;
    return team1Eval.power + (teamsRequired >= 2 ? perHandBonus : 0);
  }, [team1Eval, team1PartialPower, perHandBonus, teamsRequired]);

  const totalPower =
    team0PowerFinal + (teamsRequired >= 2 ? team1PowerFinal : 0);

  const activeRankKeys = useMemo(() => {
    const keys: RankTypeKey[] = [];
    if (team0Eval) keys.push(team0Eval.rankType.key);
    if (team1Eval && teamsRequired >= 2) keys.push(team1Eval.rankType.key);
    return keys;
  }, [team0Eval, team1Eval, teamsRequired]);

  const anyFlush =
    (team0Eval?.isFlush ?? false) || (teamsRequired >= 2 && (team1Eval?.isFlush ?? false));

  // 监测牌型首次触发 → 播放特效
  // 策略：每当 team0/team1 的 (rankType.key + isFlush + 队伍配置) 签名变化时，选择最高等级的那个触发特效
  useEffect(() => {
    // 只有 5 张时才可能触发
    const candidates: { key: RankTypeKey; name: string; flush: boolean; score: number }[] = [];
    if (team0Eval)
      candidates.push({
        key: team0Eval.rankType.key,
        name: team0Eval.rankType.name,
        flush: team0Eval.isFlush,
        score: team0Eval.rankType.score + team0Eval.suitBonus,
      });
    if (team1Eval && teamsRequired >= 2)
      candidates.push({
        key: team1Eval.rankType.key,
        name: team1Eval.rankType.name,
        flush: team1Eval.isFlush,
        score: team1Eval.rankType.score + team1Eval.suitBonus,
      });
    if (candidates.length === 0) {
      lastEffectSig.current = '';
      return;
    }
    // 选最高分
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];
    const sig = `${top.key}|${top.flush}`;
    if (sig === lastEffectSig.current) return;
    lastEffectSig.current = sig;
    // 散牌 / 一对 不触发特效（tier 太低，避免刷屏）
    if (top.key === 'HIGH_CARD') return;
    setEffect(buildEffect(top.key, top.name, top.flush));
  }, [team0Eval, team1Eval, teamsRequired]);

  // 拖拽感应器
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    if (typeof document !== 'undefined') {
      document.body.classList.add('dnd-dragging');
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(12);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('dnd-dragging');
    }
    const { active, over } = e;
    if (!over) return;
    const fromId = String(active.id);
    const data: any = over.data.current;
    if (!data) return;

    if (data.type === 'redraw') {
      state.redraw(fromId);
      return;
    }

    let target: SlotTarget;
    if (data.type === 'hand') target = { type: 'hand' };
    else if (data.type === 'team')
      target = { type: 'team', teamIndex: data.teamIndex, slotIndex: data.slotIndex };
    else return;
    state.moveCard(fromId, target);
  };

  const activeCard = activeId ? findCardById(state.hand, state.teams, activeId) : null;

  const buildSnapshot = (): PowerSnapshot => {
    // 计算上阵【绝影马】数量（仅计数在场上的）
    let jueyingOnBoard = 0;
    for (const t of state.teams) {
      const need = teamsRequired >= 2 ? 2 : 1;
      for (const c of t) if (c?.horseSeal === 'jueying') jueyingOnBoard++;
      if (need === 1) break; // 仅算 team0
    }
    return {
      round: state.round,
      team0Power: team0PowerFinal,
      team1Power: teamsRequired >= 2 ? team1PowerFinal : 0,
      totalPower,
      gold: state.gold,
      recruitLevel: state.recruitLevel,
      anyFlush,
      jueyingOnBoard,
    };
  };

  const handleNext = () => {
    if (isOnline) {
      // 联机：切换自己的 ready 状态（所有人 ready 后 host 自动推进）
      state.setReady(true);
      return;
    }
    // 单机：放宽规则，未上满 5 员不再阻塞下一年
    const snapshot = buildSnapshot();
    if (state.round >= FINAL_ROUND) {
      singleSettleFinal(snapshot);
      return;
    }
    singleNextRound(snapshot);
  };

  const handleRestart = () => {
    if (isOnline) {
      // 联机：返回大厅
      stopSession();
      setLobbyScreen('main');
      return;
    }
    state.startNewGame();
  };

  // 联机专属：host 擂鼓启动实际对局（洗牌发手牌）
  const handleStartOnlineGame = () => {
    console.info('[ui] host clicked 擂鼓·发牌');
    dispatchGameAction({ type: 'startGame' });
  };

  const factionCount = useMemo(() => {
    const m: Record<string, number> = { 魏: 0, 蜀: 0, 吴: 0, 群: 0 };
    state.deck.forEach((c) => (m[c.faction] += 1));
    return m;
  }, [state.deck]);
  // 联机不显示牌库张数（host 不广播 deck）
  const showDeckStats = !isOnline;

  const expNeed =
    state.recruitLevel >= 6 ? Infinity : LEVEL_EXP_REQUIRED[state.recruitLevel];

  return (
    <div className="min-h-screen bg-scroll">
      {/* ========== 大厅 / 连接界面 ========== */}
      {showLobby && (
        <LobbyScreens
          onEnterSinglePlayer={handleEnterSinglePlayer}
          onEnterGame={handleEnterOnlineGame}
        />
      )}

      {/* 游戏内：联机房间信息小条（已进入游戏时才显示） */}
      {!showLobby && roomCode && (
        <RoomHud
          roomCode={roomCode}
          isHost={isHost}
          peerCount={peers.length}
          onLeave={() => {
            useLobbyStore.getState().leaveRoom();
          }}
        />
      )}

      <TopBar
        round={state.round}
        roundDesc={cfg.description}
        freeRedrawsLeft={state.freeRedrawsLeft}
        gold={state.gold}
        recruitLevel={state.recruitLevel}
        recruitExp={state.recruitExp}
        expNeed={expNeed}
        totalPower={totalPower}
      />

      <Toast message={state.lastMessage} onClose={state.clearMessage} />

      <HandEffect trigger={effect} onDone={() => setEffect(null)} />

      {/* 阵法播报横幅：观察所有军团，某队阵法从无到有 / 阵法变化时触发 */}
      <FormationBroadcast teamEvals={[team0Eval, team1Eval]} />

      {/* 诸侯两两对战动画 */}
      <DuelOverlay
        duel={state.duelLog[state.duelLog.length - 1] ?? null}
        selfId={state.myId}
        currentHp={(() => {
          // 单机：hpDelta 以 'player' 为 key；联机：以各自 peerId 为 key
          const m: Record<string, number> = {};
          if (isOnline && state.roomPlayers) {
            for (const p of state.roomPlayers) {
              const id = p.peerId ?? `seat_${p.seatIdx}`;
              m[id] = p.hp;
            }
          } else {
            m['player'] = state.playerHp;
            for (const a of state.ais) m[a.id] = a.hp;
          }
          return m;
        })()}
      />

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          if (typeof document !== 'undefined') {
            document.body.classList.remove('dnd-dragging');
          }
        }}
      >
        <div className="max-w-[1400px] mx-auto p-3 sm:p-6 grid grid-cols-12 gap-4 sm:gap-6">
          {/* 左主栏 */}
          <div className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
            {/* 军团页签（双队列时显示） */}
            {teamsRequired >= 2 && (
              <TeamTabs
                activeTeamIndex={activeTeamIndex}
                onSwitch={setActiveTeamIndex}
                team0Power={team0PowerFinal}
                team1Power={team1PowerFinal}
                team0Full={state.teams[0].every((c) => c !== null)}
                team1Full={state.teams[1].every((c) => c !== null)}
              />
            )}

            {/* 当前军团战场 */}
            {(teamsRequired >= 2 ? activeTeamIndex === 0 : true) && (
              <BattleField3D
                teamIndex={0}
                cards={state.teams[0]}
                evalResult={team0Eval}
              />
            )}
            {teamsRequired >= 2 && activeTeamIndex === 1 && (
              <BattleField3D
                teamIndex={1}
                cards={state.teams[1]}
                evalResult={team1Eval}
              />
            )}

            {/* 操作区 */}
            <div className="flex items-center justify-between gap-3 flex-wrap relative rounded-lg wood-light px-4 py-3 border-4 border-amber-950 shadow-card-deep">
              <div className="flex items-center gap-2 text-xs text-amber-100/80 flex-wrap font-kai">
                {showDeckStats ? (
                  <>
                    <span>
                      牌库{' '}
                      <span className="text-gold-grad font-black tabular-nums">
                        {state.deck.length}
                      </span>
                    </span>
                    {(['魏', '蜀', '吴', '群'] as const).map((f) => (
                      <span
                        key={f}
                        className={`px-2 py-0.5 rounded ${FACTION_THEME[f].bg} ${FACTION_THEME[f].accent} border border-amber-900 text-[11px] font-black`}
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}
                      >
                        {f} {factionCount[f]}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="italic text-amber-200/55 tracking-widest">
                    · 联机对局 · 共享牌库不可见 ·
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <button
                  onClick={state.autoPlace}
                  className="btn-wood text-xs px-3 py-2"
                  title="将手牌自动填入空槽"
                >
                  一键布阵
                </button>

                <button
                  onClick={state.recallAll}
                  className="btn-wood text-xs px-3 py-2"
                  title="把已上阵的所有武将撤回待命"
                >
                  一键下阵
                </button>

                <button
                  onClick={handleRestart}
                  className="btn-wood text-xs px-3 py-2"
                >
                  重 开
                </button>

                <button
                  onClick={handleNext}
                  disabled={state.isFinished}
                  className="btn-wood btn-gold text-sm px-4 sm:px-6 py-2.5 sm:py-3 tracking-[0.2em]"
                >
                  {isOnline
                    ? nextButtonLabelOnline(state.roomPlayers, state.myId)
                    : state.round >= FINAL_ROUND
                      ? '⚔ 终局结算'
                      : '⚔ 下 一 年'}
                </button>
              </div>
            </div>

            <HandArea cards={state.hand} />

            {/* 换将令（统一放在待命武将下方，额外 mt 拉开与上方的距离） */}
            <div className="mt-2 sm:mt-4">
              <RedrawZone
                freeRedrawsLeft={state.freeRedrawsLeft}
                gold={state.gold}
                paidCost={ECONOMY_CONFIG.paidRedrawCost}
                compact
              />
            </div>

            <div className="text-[11px] text-amber-200/50 leading-relaxed border-t border-amber-900/30 pt-3 italic">
              ◈ 本年目标：填满 <span className="text-gold font-bold">{teamsRequired}</span> 队 ·
              手牌 <span className="text-gold tabular-nums">{state.hand.length + state.teams.flat().filter(Boolean).length}</span> 员 ·
              军势 = <span className="text-emerald-300">武勇和</span> ×
              (<span className="text-emerald-300">阵法加成</span> +
              <span className="text-gold">同心加成</span>)
            </div>
          </div>

          {/* 右侧栏 */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <RecruitPanel
              gold={state.gold}
              buyCount={state.buyCount}
              recruitLevel={state.recruitLevel}
              recruitExp={state.recruitExp}
              onBuy={state.buyCard}
              onUpgrade={state.upgradeLevel}
              disabled={state.isFinished}
            />
            {state.mode === 'empowered' && (
              <TalentsPanel
                talents={state.talents}
                mode={state.mode}
                doubleThisRoundActive={state.doubleThisRoundActive}
              />
            )}
            <AIStandings
              ais={state.ais}
              playerTotalPower={totalPower}
              playerHp={state.playerHp}
              playerEliminated={state.playerEliminatedAtRound !== null}
              latestDuel={state.duelLog[state.duelLog.length - 1] ?? null}
            />
            <HandTypeTable activeRankKeys={activeRankKeys} anyFlush={anyFlush} />
            <PowerChart
              history={state.powerHistory}
              currentRound={state.round}
              currentTotalPower={totalPower}
              isFinished={state.isFinished}
            />
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="scale-110 rotate-2">
              <CardView card={activeCard} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {state.isFinished && (
          <GameOverModal
            totalPower={totalPower}
            gold={state.gold}
            recruitLevel={state.recruitLevel}
            onRestart={handleRestart}
            powerHistory={state.powerHistory}
            currentRound={state.round}
            ais={state.ais}
            playerEliminatedAtRound={state.playerEliminatedAtRound}
          />
        )}
      </AnimatePresence>

      {/* 牌库抽屉（右下角固定按钮 + 弹出抽屉） */}
      {/* 牌库抽屉：仅单机时显示（联机牌库由 host 保管） */}
      {!isOnline && <DeckDrawer deck={state.deck} />}

      {/* GM 调试工具（仅单机） */}
      {!isOnline && (
        <GMTool
          onGrantGold={state.gmGrantGold}
          onMaxLevel={state.gmMaxLevel}
          onFillHand={state.gmFillHand}
        />
      )}

      {/* 初始模式选择弹窗（只在首次进入游戏屏幕时展示） */}
      <AnimatePresence>
        {!showLobby && !state.modeChosen && (
          <>
            {/* 联机时：只有 host 能选；其他人看等待面板 */}
            {isOnline && !isHost ? (
              <WaitingForHostModal text="等 待 主 公 择 模 式" />
            ) : (
              <ModeSelectionModal onChoose={(m) => state.chooseMode(m)} />
            )}
          </>
        )}
      </AnimatePresence>

      {/* 联机：host 已选模式但未擂鼓（phase=lobby）→ 等待 */}
      <AnimatePresence>
        {!showLobby &&
          isOnline &&
          state.modeChosen &&
          state.roomPlayers &&
          // phase 信息从 room view 推断：roomPlayers 存在 + round=0 + 没有 hand
          state.round === 0 &&
          state.hand.length === 0 &&
          !state.isFinished &&
          isHost && <StartGameHostPrompt dispatch={() => handleStartOnlineGame()} />}
      </AnimatePresence>

      {/* 天赐四选一弹窗 */}
      <AnimatePresence>
        {state.pendingTalentChoices && state.pendingTalentChoices.length > 0 && (
          <TalentPickerModal
            round={state.pendingTalentRound ?? 0}
            choices={state.pendingTalentChoices}
            onPick={(id) => state.pickTalent(id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ======================================================================
// 联机等待面板（非 host 在 host 未擂鼓时看）
// ======================================================================
function WaitingForHostModal({ text }: { text: string }) {
  return (
    <div
      className="fixed inset-0 z-[72] flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(20,10,4,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="parchment px-10 py-12 text-center"
        style={{
          border: '3px solid #5a3a1c',
          boxShadow: 'inset 0 0 60px rgba(100,60,20,0.25)',
          minWidth: 360,
        }}
      >
        <div className="text-[10px] text-red-900/55 tracking-[1em] font-kai font-black mb-1">
          候 令
        </div>
        <div
          className="text-3xl font-black font-kai tracking-[0.3em]"
          style={{
            background: 'linear-gradient(180deg, #7a1818 0%, #3a0404 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {text}
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] tracking-[0.3em] text-red-900/65 italic font-kai">
          <span
            className="inline-block"
            style={{
              width: 12,
              height: 12,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1.2s linear infinite',
            }}
          />
          正 在 调 度…
        </div>
      </div>
    </div>
  );
}

function StartGameHostPrompt({ dispatch }: { dispatch: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[71] flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(20,10,4,0.7) 0%, rgba(0,0,0,0.9) 100%)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="parchment px-10 py-12 text-center"
        style={{
          border: '3px solid #5a3a1c',
          boxShadow: 'inset 0 0 60px rgba(100,60,20,0.25)',
          minWidth: 420,
        }}
      >
        <div className="text-[10px] text-red-900/55 tracking-[1em] font-kai font-black mb-1">
          出 兵 在 即
        </div>
        <div
          className="text-3xl font-black font-kai tracking-[0.3em] mb-3"
          style={{
            background: 'linear-gradient(180deg, #7a1818 0%, #3a0404 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          擂 鼓 开 战
        </div>
        <div className="text-[12px] text-red-900/65 italic tracking-[0.15em] font-kai mb-6">
          —— 洗牌发令 · 诸将就位 ——
        </div>
        <button
          onClick={(e) => {
            console.info('[ui] StartGameHostPrompt button onClick', e);
            dispatch();
          }}
          className="btn-seal btn-seal-gold px-10 py-3 text-base tracking-[0.35em] relative overflow-hidden"
        >
          <div className="text-[15px] leading-none">擂 鼓 · 发 牌</div>
          <div className="sweep-sheen" />
        </button>
      </div>
    </div>
  );
}

// ======================================================================
// 辅助：联机模式下"下一年"按钮标签
// ======================================================================
function nextButtonLabelOnline(
  players: import('./net/roomTypes').ClientPlayerView[] | null,
  myId: string,
): string {
  if (!players) return '⚔ 下 一 年';
  const me = players.find((p) => p.peerId === myId);
  const humanAlive = players.filter(
    (p) => !p.isAI && p.eliminatedAtRound === null,
  );
  const readyCount = humanAlive.filter((p) => p.ready).length;
  const total = humanAlive.length;
  if (me?.ready) {
    return `· 等候群雄 · ${readyCount}/${total} ·`;
  }
  return `⚔ 擂 鼓 就 绪 · ${readyCount}/${total}`;
}

// ======================================================================
// 游戏内 · 房间信息小条
// ======================================================================
function RoomHud({
  roomCode,
  isHost,
  peerCount,
  onLeave,
}: {
  roomCode: string;
  isHost: boolean;
  peerCount: number;
  onLeave: () => void;
}) {
  return (
    <div
      className="fixed top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded font-kai"
      style={{
        background: 'linear-gradient(180deg, #3a2418 0%, #1a0f08 100%)',
        border: '1.5px solid #8b6914',
        boxShadow:
          '0 2px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,220,160,0.25)',
      }}
    >
      <span className="text-[10px] tracking-[0.3em] text-amber-200/70">
        房间
      </span>
      <span
        className="text-[13px] font-black tabular-nums"
        style={{
          letterSpacing: '0.25em',
          background:
            'linear-gradient(180deg, #fff5cc 0%, #f7d57a 40%, #d4af37 75%, #6b4a10 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {roomCode}
      </span>
      <span className="text-[10px] text-amber-100/65 tracking-widest">
        · {peerCount} 人 · {isHost ? '主公' : '客卿'}
      </span>
      <button
        onClick={onLeave}
        className="ml-2 text-[10px] tracking-[0.22em] text-red-300/75 hover:text-red-200 transition-colors"
      >
        撤 旗
      </button>
    </div>
  );
}
