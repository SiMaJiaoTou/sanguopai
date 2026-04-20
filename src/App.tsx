import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import { useGameStore, type SlotTarget, type PowerSnapshot } from './store';
import { evaluateHand } from './evaluate';
import { ROUND_CONFIGS, FINAL_ROUND, FACTION_THEME } from './data';
import type { Card, HandTypeKey } from './types';

import { TopBar } from './components/TopBar';
import { TeamPanel } from './components/TeamPanel';
import { HandArea } from './components/HandArea';
import { CardView } from './components/CardView';
import { GameOverModal } from './components/GameOverModal';
import { RedrawZone } from './components/RedrawZone';
import { HandTypeTable } from './components/HandTypeTable';
import { PowerChart } from './components/PowerChart';

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

  useEffect(() => {
    if (state.hand.length === 0 && state.deck.length === 0) {
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

  // 当前已触发的牌型（用于倍率表高亮）
  const activeHandKeys = useMemo(() => {
    const keys: HandTypeKey[] = [];
    if (team0Eval) keys.push(team0Eval.handType.key);
    if (team1Eval && teamsRequired >= 2) keys.push(team1Eval.handType.key);
    return keys;
  }, [team0Eval, team1Eval, teamsRequired]);

  // 满槽判定，决定"下一回合"是否可用
  const requiredTeamsFull = useMemo(() => {
    for (let ti = 0; ti < teamsRequired; ti++) {
      if (!state.teams[ti].every((c) => c !== null)) return false;
    }
    return true;
  }, [state.teams, teamsRequired]);

  // 拖拽感应器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const fromId = String(active.id);
    const data: any = over.data.current;
    if (!data) return;

    // 拖到换牌区 → 触发换牌
    if (data.type === 'redraw') {
      if (state.redrawsLeft > 0) state.redraw(fromId);
      return;
    }

    let target: SlotTarget;
    if (data.type === 'hand') {
      target = { type: 'hand' };
    } else if (data.type === 'team') {
      target = { type: 'team', teamIndex: data.teamIndex, slotIndex: data.slotIndex };
    } else return;
    state.moveCard(fromId, target);
  };

  const activeCard = activeId ? findCardById(state.hand, state.teams, activeId) : null;

  const canRedraw = state.redrawsLeft > 0 && !state.isFinished;

  const buildSnapshot = (): PowerSnapshot => ({
    round: state.round,
    team0Power: team0Eval?.power ?? 0,
    team1Power: teamsRequired >= 2 ? team1Eval?.power ?? 0 : 0,
    totalPower,
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

  // 牌池阵营剩余张数
  const factionCount = useMemo(() => {
    const m: Record<string, number> = { 魏: 0, 蜀: 0, 吴: 0, 群: 0 };
    state.deck.forEach((c) => (m[c.faction] += 1));
    return m;
  }, [state.deck]);

  return (
    <div className="min-h-screen bg-scroll">
      <TopBar
        round={state.round}
        roundDesc={cfg.description}
        redrawsLeft={state.redrawsLeft}
        totalPower={totalPower}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="max-w-[1400px] mx-auto p-6 grid grid-cols-12 gap-6">
          {/* 左主栏：战场 + 操作 + 手牌 */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* 战场 */}
            <div
              className={`grid gap-4 ${
                teamsRequired >= 2 ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              <TeamPanel
                teamIndex={0}
                cards={state.teams[0]}
                evalResult={team0Eval}
                canRedraw={canRedraw}
                onRedraw={state.redraw}
              />
              {teamsRequired >= 2 && (
                <TeamPanel
                  teamIndex={1}
                  cards={state.teams[1]}
                  evalResult={team1Eval}
                  canRedraw={canRedraw}
                  onRedraw={state.redraw}
                />
              )}
            </div>

            {/* 操作区 */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
                <span>牌库剩余 {state.deck.length} 张</span>
                {(['魏', '蜀', '吴', '群'] as const).map((f) => (
                  <span
                    key={f}
                    className={`px-2 py-0.5 rounded-md ${FACTION_THEME[f].bg} ${FACTION_THEME[f].accent}`}
                  >
                    {f} {factionCount[f]}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={state.autoPlace}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                  title="将手牌自动填入空槽"
                >
                  一键布阵
                </button>

                <button
                  onClick={handleRestart}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm border border-white/15"
                >
                  重开新局
                </button>

                <button
                  onClick={handleNext}
                  disabled={!requiredTeamsFull || state.isFinished}
                  className={[
                    'px-6 py-3 rounded-xl font-bold text-base shadow-md',
                    requiredTeamsFull && !state.isFinished
                      ? 'bg-gold text-ink hover:bg-gold-light animate-shine'
                      : 'bg-white/10 text-white/40 cursor-not-allowed',
                  ].join(' ')}
                >
                  {state.round >= FINAL_ROUND ? '⚔ 终局结算' : '⚔ 结束休战，进入下一年'}
                </button>
              </div>
            </div>

            {/* 手牌区 */}
            <HandArea cards={state.hand} canRedraw={canRedraw} onRedraw={state.redraw} />

            {/* 规则提示 */}
            <div className="text-[11px] text-white/40 leading-relaxed border-t border-white/5 pt-3">
              本回合目标：填满 <span className="text-gold">{teamsRequired}</span> 队 · 当前手牌总数{' '}
              {state.hand.length + state.teams.flat().filter(Boolean).length} / {cfg.totalCards} 张 ·
              拖拽卡牌至右侧 <span className="text-gold">「换将令」</span> 区块即可消耗 1 次替换
            </div>
          </div>

          {/* 右侧栏：换牌区 + 倍率表 + 折线图 */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <RedrawZone redrawsLeft={state.redrawsLeft} />
            <HandTypeTable activeKeys={activeHandKeys} />
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
          <GameOverModal totalPower={totalPower} onRestart={handleRestart} />
        )}
      </AnimatePresence>
    </div>
  );
}
