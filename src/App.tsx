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
import { useGameStore, type SlotTarget, type PowerSnapshot } from './store';
import { evaluateHand } from './evaluate';
import {
  ROUND_CONFIGS,
  FINAL_ROUND,
  FACTION_THEME,
  LEVEL_EXP_REQUIRED,
  ECONOMY_CONFIG,
} from './data';
import type { Card, RankTypeKey } from './types';

import { TopBar } from './components/TopBar';
import { TeamPanel } from './components/TeamPanel';
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
  const state = useGameStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [effect, setEffect] = useState<EffectTrigger | null>(null);
  // 记录上一次触发过特效的牌型签名，避免重复播放
  const lastEffectSig = useRef<string>('');

  useEffect(() => {
    if (state.hand.length === 0 && state.deck.length === 0 && state.round === 0 && state.gold === 0) {
      state.startNewGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = ROUND_CONFIGS[state.round];
  const teamsRequired = cfg.teamsRequired;

  // 每队评估
  const team0Eval = useMemo(() => {
    const cards = state.teams[0].filter((c): c is Card => !!c);
    return cards.length === 5 ? evaluateHand(cards) : null;
  }, [state.teams]);
  const team1Eval = useMemo(() => {
    const cards = state.teams[1].filter((c): c is Card => !!c);
    return cards.length === 5 ? evaluateHand(cards) : null;
  }, [state.teams]);

  const totalPower =
    (team0Eval?.power ?? 0) + (teamsRequired >= 2 ? team1Eval?.power ?? 0 : 0);

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

  const requiredTeamsFull = useMemo(() => {
    for (let ti = 0; ti < teamsRequired; ti++) {
      if (!state.teams[ti].every((c) => c !== null)) return false;
    }
    return true;
  }, [state.teams, teamsRequired]);

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

  const buildSnapshot = (): PowerSnapshot => ({
    round: state.round,
    team0Power: team0Eval?.power ?? 0,
    team1Power: teamsRequired >= 2 ? team1Eval?.power ?? 0 : 0,
    totalPower,
    gold: state.gold,
    recruitLevel: state.recruitLevel,
  });

  const handleNext = () => {
    if (!requiredTeamsFull) return;
    const snapshot = buildSnapshot();
    if (state.round >= FINAL_ROUND) {
      state.settleFinal(snapshot);
      return;
    }
    state.nextRound(snapshot);
  };

  const handleRestart = () => {
    state.startNewGame();
  };

  const factionCount = useMemo(() => {
    const m: Record<string, number> = { 魏: 0, 蜀: 0, 吴: 0, 群: 0 };
    state.deck.forEach((c) => (m[c.faction] += 1));
    return m;
  }, [state.deck]);

  const expNeed =
    state.recruitLevel >= 6 ? Infinity : LEVEL_EXP_REQUIRED[state.recruitLevel];

  // redraw 判定
  const canRedrawFree = state.freeRedrawsLeft > 0 && !state.isFinished;
  const canRedrawAny =
    (canRedrawFree || state.gold >= ECONOMY_CONFIG.paidRedrawCost) && !state.isFinished;

  return (
    <div className="min-h-screen bg-scroll">
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
          {/* 移动端：换将令置顶 */}
          <div className="col-span-12 lg:hidden">
            <RedrawZone
              freeRedrawsLeft={state.freeRedrawsLeft}
              gold={state.gold}
              paidCost={ECONOMY_CONFIG.paidRedrawCost}
              compact
            />
          </div>

          {/* 左主栏 */}
          <div className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
            <div
              className={`grid gap-4 ${
                teamsRequired >= 2 ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              <TeamPanel
                teamIndex={0}
                cards={state.teams[0]}
                evalResult={team0Eval}
                canRedraw={canRedrawAny}
                onRedraw={state.redraw}
              />
              {teamsRequired >= 2 && (
                <TeamPanel
                  teamIndex={1}
                  cards={state.teams[1]}
                  evalResult={team1Eval}
                  canRedraw={canRedrawAny}
                  onRedraw={state.redraw}
                />
              )}
            </div>

            {/* 操作区 */}
            <div className="flex items-center justify-between gap-3 flex-wrap relative rounded-lg wood-light px-3 py-2.5 border-2 border-amber-900">
              <div className="flex items-center gap-2 text-xs text-amber-100/80 flex-wrap font-kai">
                <span>牌库 <span className="text-gold-grad font-black tabular-nums">{state.deck.length}</span></span>
                {(['魏', '蜀', '吴', '群'] as const).map((f) => (
                  <span
                    key={f}
                    className={`px-2 py-0.5 rounded ${FACTION_THEME[f].bg} ${FACTION_THEME[f].accent} border border-amber-900 text-[11px] font-black`}
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}
                  >
                    {f} {factionCount[f]}
                  </span>
                ))}
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
                  onClick={handleRestart}
                  className="btn-wood text-xs px-3 py-2"
                >
                  重 开
                </button>

                <button
                  onClick={handleNext}
                  disabled={!requiredTeamsFull || state.isFinished}
                  className="btn-wood btn-gold text-sm px-4 sm:px-6 py-2.5 sm:py-3 tracking-[0.2em]"
                >
                  {state.round >= FINAL_ROUND ? '⚔ 終局結算' : '⚔ 下 一 年'}
                </button>
              </div>
            </div>

            <HandArea
              cards={state.hand}
              canRedraw={canRedrawAny}
              onRedraw={state.redraw}
            />

            <div className="text-[11px] text-amber-200/50 leading-relaxed border-t border-amber-900/30 pt-3 italic">
              ◈ 本年目标：填满 <span className="text-gold font-bold">{teamsRequired}</span> 队 ·
              手牌 <span className="text-gold tabular-nums">{state.hand.length + state.teams.flat().filter(Boolean).length}</span> 员 ·
              战力 = <span className="text-emerald-300">点数和</span> ×
              (<span className="text-emerald-300">点数牌型</span> +
              <span className="text-gold">同花加成</span>)，上限 <span className="text-red-300">803</span>
            </div>
          </div>

          {/* 右侧栏 */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="hidden lg:block">
              <RedrawZone
                freeRedrawsLeft={state.freeRedrawsLeft}
                gold={state.gold}
                paidCost={ECONOMY_CONFIG.paidRedrawCost}
              />
            </div>
            <RecruitPanel
              gold={state.gold}
              buyCount={state.buyCount}
              recruitLevel={state.recruitLevel}
              recruitExp={state.recruitExp}
              onBuy={state.buyCard}
              onUpgrade={state.upgradeLevel}
              disabled={state.isFinished}
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
          />
        )}
      </AnimatePresence>

      {/* GM 调试工具 */}
      <GMTool
        onGrantGold={state.gmGrantGold}
        onMaxLevel={state.gmMaxLevel}
        onFillHand={state.gmFillHand}
      />
    </div>
  );
}
