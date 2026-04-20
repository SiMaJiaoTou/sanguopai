import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HAND_TYPES } from '../evaluate';
import { HAND_DESCRIPTIONS } from '../handDescriptions';
import type { HandTypeKey } from '../types';

interface Props {
  activeKeys?: HandTypeKey[]; // 当前各队伍已触发的牌型（高亮用）
}

const ORDERED: HandTypeKey[] = [
  'FIVE_OF_A_KIND',
  'FLUSH_FULL_HOUSE',
  'STRAIGHT_FLUSH',
  'FLUSH_THREE',
  'FOUR_OF_A_KIND',
  'FLUSH_TWO_PAIR',
  'FLUSH_ONE_PAIR',
  'FULL_HOUSE',
  'FLUSH_HIGH',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'ONE_PAIR',
  'HIGH_CARD',
];

function multiplierColor(m: number): string {
  if (m >= 20) return 'text-red-300 bg-red-500/20 border-red-400/40';
  if (m >= 15) return 'text-orange-300 bg-orange-500/20 border-orange-400/40';
  if (m >= 10) return 'text-yellow-300 bg-yellow-500/20 border-yellow-400/40';
  if (m >= 6) return 'text-emerald-300 bg-emerald-500/20 border-emerald-400/40';
  if (m >= 2) return 'text-sky-300 bg-sky-500/20 border-sky-400/40';
  return 'text-slate-300 bg-slate-500/15 border-slate-400/30';
}

export function HandTypeTable({ activeKeys = [] }: Props) {
  const active = new Set(activeKeys);
  const [expanded, setExpanded] = useState(true); // 默认展开说明
  const [hovered, setHovered] = useState<HandTypeKey | null>(null);

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-gold font-bold">📜 牌型倍率表</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] px-2 py-0.5 rounded border border-white/15 text-white/60 hover:text-gold hover:border-gold/60"
            title="显示/隐藏牌型说明"
          >
            {expanded ? '隐藏注释 ▴' : '展开注释 ▾'}
          </button>
          <div className="text-[10px] text-white/40">优先级从高到低</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1">
        {ORDERED.map((k) => {
          const t = HAND_TYPES[k];
          const desc = HAND_DESCRIPTIONS[k];
          const isActive = active.has(k);
          const isHover = hovered === k;
          const showDesc = expanded || isActive || isHover;

          return (
            <motion.div
              key={k}
              layout
              onMouseEnter={() => setHovered(k)}
              onMouseLeave={() => setHovered((h) => (h === k ? null : h))}
              animate={
                isActive
                  ? { backgroundColor: 'rgba(212,175,55,0.18)' }
                  : { backgroundColor: 'rgba(255,255,255,0)' }
              }
              className={[
                'px-2.5 py-1.5 rounded-md border',
                isActive ? 'border-gold shadow-glow' : 'border-transparent hover:border-white/10',
                'cursor-help',
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
                    multiplierColor(t.multiplier),
                  ].join(' ')}
                >
                  ×{t.multiplier}
                </span>
              </div>

              {/* 说明注释：展开模式 or 高亮时显示 */}
              <AnimatePresence initial={false}>
                {showDesc && (
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

      <div className="mt-3 text-[10px] text-white/35 leading-relaxed border-t border-white/5 pt-2">
        💡 提示：鼠标悬停某行可查看该牌型含义；倍率越高越稀有
      </div>
    </div>
  );
}
