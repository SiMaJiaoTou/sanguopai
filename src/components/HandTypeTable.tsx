import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RANK_TYPES, SUIT_BONUS, POWER_CAP } from '../evaluate';
import { RANK_DESCRIPTIONS, SUIT_BONUS_DESC } from '../handDescriptions';
import type { RankTypeKey } from '../types';

interface Props {
  activeRankKeys?: RankTypeKey[]; // 各队伍已触发的点数牌型
  anyFlush?: boolean;             // 是否有队伍达成同花
}

const ORDERED: RankTypeKey[] = [
  'FIVE_OF_A_KIND',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'ONE_PAIR',
  'HIGH_CARD',
];

function scoreColor(s: number): string {
  if (s >= 10) return 'text-red-300 bg-red-500/20 border-red-400/40';
  if (s >= 8) return 'text-orange-300 bg-orange-500/20 border-orange-400/40';
  if (s >= 6) return 'text-yellow-300 bg-yellow-500/20 border-yellow-400/40';
  if (s >= 4) return 'text-emerald-300 bg-emerald-500/20 border-emerald-400/40';
  if (s >= 2) return 'text-sky-300 bg-sky-500/20 border-sky-400/40';
  return 'text-slate-300 bg-slate-500/15 border-slate-400/30';
}

export function HandTypeTable({ activeRankKeys = [], anyFlush = false }: Props) {
  const active = new Set(activeRankKeys);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="relative rounded-lg wood-panel bronze-border rivets wood-dark">
      <div className="rivet-b" />

      <div className="flex items-center justify-between mb-2 ink-underline">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-base">㊉</span>
          <div className="text-gold-grad font-black tracking-[0.25em] font-kai">兵 法 譜</div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="btn-wood text-[10px] px-2 py-1"
        >
          {expanded ? '隐注 ▴' : '展注 ▾'}
        </button>
      </div>
      <div className="text-[10px] text-amber-100/55 mb-3 italic text-center">
        战力 ＝ 点数和 × (点数牌型 + 同花加成) · 上限 {POWER_CAP}
      </div>

      {/* 乘区 1 */}
      <div className="text-[10px] text-amber-200/70 mb-1.5 pl-1 tracking-[0.25em] font-kai font-black">
        ◈ 乘區一 · 點數牌型
      </div>
      <div className="grid grid-cols-1 gap-1 mb-3">
        {ORDERED.map((k) => {
          const t = RANK_TYPES[k];
          const desc = RANK_DESCRIPTIONS[k];
          const isActive = active.has(k);
          return (
            <motion.div
              key={k}
              layout
              animate={
                isActive
                  ? { backgroundColor: 'rgba(212,175,55,0.18)' }
                  : { backgroundColor: 'rgba(255,255,255,0)' }
              }
              className={[
                'px-2.5 py-1.5 rounded-md border cursor-help',
                isActive ? 'border-gold shadow-glow' : 'border-transparent hover:border-white/10',
              ].join(' ')}
              title={desc}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 w-4 text-right tabular-nums">
                    {t.priority}
                  </span>
                  <span
                    className={[
                      'text-sm font-bold',
                      isActive ? 'text-gold' : 'text-white/85',
                    ].join(' ')}
                  >
                    {t.name}
                  </span>
                  {isActive && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-[10px] text-gold font-bold"
                    >
                      ◂ 当前
                    </motion.span>
                  )}
                </div>
                <span
                  className={[
                    'text-xs font-black px-2 py-0.5 rounded border tabular-nums',
                    scoreColor(t.score),
                  ].join(' ')}
                >
                  +{t.score}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {(expanded || isActive) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 4 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div
                      className={[
                        'text-[11px] leading-snug pl-6 pr-1',
                        isActive ? 'text-gold/85' : 'text-white/55',
                      ].join(' ')}
                    >
                      {desc}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* 乘区 2：花色加成 */}
      <div className="text-[10px] text-amber-200/70 mb-1.5 pl-1 tracking-[0.25em] font-kai font-black">
        ◈ 乘區二 · 花色加成
      </div>
      <motion.div
        layout
        animate={
          anyFlush
            ? { backgroundColor: 'rgba(212,175,55,0.18)' }
            : { backgroundColor: 'rgba(255,255,255,0)' }
        }
        className={[
          'px-2.5 py-1.5 rounded-md border',
          anyFlush ? 'border-gold shadow-glow' : 'border-transparent',
        ].join(' ')}
        title={SUIT_BONUS_DESC}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={[
                'text-sm font-bold',
                anyFlush ? 'text-gold' : 'text-white/85',
              ].join(' ')}
            >
              {SUIT_BONUS.FLUSH.name}
            </span>
            {anyFlush && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-[10px] text-gold font-bold"
              >
                ◂ 当前
              </motion.span>
            )}
          </div>
          <span className="text-xs font-black px-2 py-0.5 rounded border tabular-nums text-yellow-300 bg-yellow-500/20 border-yellow-400/40">
            +{SUIT_BONUS.FLUSH.bonus}
          </span>
        </div>
        <AnimatePresence initial={false}>
          {(expanded || anyFlush) && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 4 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div
                className={[
                  'text-[11px] leading-snug pr-1',
                  anyFlush ? 'text-gold/85' : 'text-white/55',
                ].join(' ')}
              >
                {SUIT_BONUS_DESC}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-3 text-[10px] text-amber-100/40 leading-relaxed border-t border-amber-900/40 pt-2 italic">
        ◈ 范例：打出「同花3+2」→ 乘区 (6 + 5) = 11
      </div>
    </div>
  );
}
