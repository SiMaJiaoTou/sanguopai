import { motion, AnimatePresence } from 'framer-motion';
import type { AIState, DuelResult } from '../ai';
import { INITIAL_HP } from '../ai';

interface Props {
  ais: AIState[];
  playerTotalPower: number;
  playerHp: number;
  playerEliminated: boolean;
  latestDuel: { round: number; result: DuelResult; hpDelta: Record<string, number> } | null;
}

/**
 * 诸侯对战面板：
 * - 上：诸侯列表（玩家 + 7 AI），按战力降序
 * - 下：最近一轮对战明细（若有）
 */
export function AIStandings({
  ais,
  playerTotalPower,
  playerHp,
  playerEliminated,
  latestDuel,
}: Props) {
  const rows = [
    {
      kind: 'player' as const,
      id: 'player',
      name: '主公',
      power: playerTotalPower,
      hp: playerHp,
      eliminated: playerEliminated,
    },
    ...ais.map((a) => ({
      kind: 'ai' as const,
      id: a.id,
      name: a.name,
      power: a.lastTotalPower,
      hp: a.hp,
      eliminated: a.eliminatedAtRound !== null,
    })),
  ];
  rows.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return b.power - a.power;
  });

  const hpDeltaMap = latestDuel?.hpDelta ?? {};

  return (
    <div className="relative rounded-lg wood-panel bronze-border rivets wood-dark">
      <div className="rivet-b" />
      <div className="flex items-center justify-between mb-2 ink-underline relative">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-base">㊉</span>
          <div className="text-gold-grad font-black tracking-[0.25em] font-kai">
            诸 侯 混 战
          </div>
        </div>
        <div className="text-[10px] text-amber-100/60 italic">
          存活{' '}
          <span className="text-gold-grad tabular-nums font-black">
            {rows.filter((r) => !r.eliminated).length}
          </span>{' '}
          / {rows.length}
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const hpDelta = hpDeltaMap[r.id] ?? 0;
          const isPlayer = r.kind === 'player';
          return (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              className={[
                'relative flex items-center gap-2 px-2 py-1.5 rounded',
                r.eliminated ? 'opacity-40 grayscale' : '',
                isPlayer ? 'ring-1 ring-amber-400/70' : '',
              ].join(' ')}
              style={{
                background: isPlayer
                  ? 'linear-gradient(90deg, rgba(90,58,28,0.85) 0%, rgba(58,36,24,0.7) 100%)'
                  : 'linear-gradient(90deg, rgba(42,26,16,0.7) 0%, rgba(26,15,8,0.55) 100%)',
                border: '1px solid rgba(139,90,40,0.45)',
              }}
            >
              <span
                className={[
                  'w-5 text-center text-[11px] font-black font-kai tabular-nums',
                  i === 0 && !r.eliminated
                    ? 'text-gold-grad'
                    : 'text-amber-200/75',
                ].join(' ')}
              >
                {i + 1}
              </span>
              <span
                className={[
                  'font-kai font-black text-[13px] tracking-wider flex-1 truncate',
                  r.eliminated
                    ? 'text-amber-200/40 line-through'
                    : isPlayer
                      ? 'text-gold-grad'
                      : 'text-amber-100',
                ].join(' ')}
              >
                {r.name}
                {r.eliminated && <span className="ml-1 text-[10px]">（阵亡）</span>}
              </span>

              {/* HP 血条 */}
              <div
                className="relative w-20 h-3 rounded-sm overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #0a0604 0%, #1f0f08 100%)',
                  border: '1px solid #3a2414',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9)',
                }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0"
                  initial={{ width: `${(r.hp / INITIAL_HP) * 100}%` }}
                  animate={{ width: `${Math.max(0, (r.hp / INITIAL_HP) * 100)}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  style={{
                    background:
                      r.hp / INITIAL_HP > 0.5
                        ? 'linear-gradient(180deg, #ff8a8a 0%, #c82828 55%, #5a0f0f 100%)'
                        : r.hp / INITIAL_HP > 0.25
                          ? 'linear-gradient(180deg, #ffd080 0%, #d97706 55%, #5a3a10 100%)'
                          : 'linear-gradient(180deg, #ff4040 0%, #a01010 55%, #3a0404 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,220,220,0.3)',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-black tabular-nums font-kai text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                    {r.hp}
                  </span>
                </div>
              </div>

              <span className="text-[12px] tabular-nums font-kai font-black text-emerald-300 w-14 text-right">
                {r.power}
              </span>

              {hpDelta < 0 && (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute -right-1 -top-1 text-[10px] text-red-300 font-black font-kai"
                >
                  -{Math.abs(hpDelta)}
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 最近对战明细 */}
      <AnimatePresence>
        {latestDuel && (
          <motion.div
            key={latestDuel.round}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-2 border-t border-amber-900/40"
          >
            <div className="text-[10px] text-amber-200/70 tracking-widest font-kai mb-1.5">
              第 {latestDuel.round} 年 · 两两对战
            </div>
            <div className="space-y-1">
              {latestDuel.result.duels.map((d, i) => {
                const aWin = d.winnerId === d.aId;
                const bWin = d.winnerId === d.bId;
                const draw = d.winnerId === null;
                const diff = Math.abs(d.aPower - d.bPower);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[11px] font-kai"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(30,18,10,0.55)',
                    }}
                  >
                    <span
                      className={[
                        'flex-1 text-right tabular-nums truncate',
                        aWin
                          ? 'text-gold-grad font-black'
                          : draw
                            ? 'text-amber-100/70'
                            : 'text-amber-200/40',
                      ].join(' ')}
                    >
                      {d.aName} · {d.aPower}
                    </span>
                    <span className="text-red-400/80 text-[10px]">⚔</span>
                    <span
                      className={[
                        'flex-1 tabular-nums truncate',
                        bWin
                          ? 'text-gold-grad font-black'
                          : draw
                            ? 'text-amber-100/70'
                            : 'text-amber-200/40',
                      ].join(' ')}
                    >
                      {d.bName} · {d.bPower}
                    </span>
                    <span
                      className={[
                        'text-[10px] tabular-nums font-black w-12 text-right',
                        draw ? 'text-amber-200/50' : 'text-red-300',
                      ].join(' ')}
                    >
                      {draw ? '平' : `-${diff}`}
                    </span>
                  </div>
                );
              })}
              {latestDuel.result.byeName && (
                <div className="text-[10px] italic text-amber-200/55 pl-1">
                  · {latestDuel.result.byeName} 本轮轮空 ·
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
