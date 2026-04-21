import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card, EvaluateResult } from '../types';
import { POWER_CAP } from '../evaluate';
import { TeamSlot } from './TeamSlot';

interface Props {
  teamIndex: number;
  cards: (Card | null)[];
  evalResult: EvaluateResult | null;
  canRedraw: boolean;
  onRedraw: (id: string) => void;
}

const SLOTS = 5;
const GAP = 8;
const MIN_W = 60;
const MAX_W = 96;
const RATIO = 136 / 96;

export function TeamPanel({ teamIndex, cards, evalResult, canRedraw, onRedraw }: Props) {
  const full = cards.every((c) => c !== null);
  // 高倍率判定：点数值 ≥ 6 或达成同花
  const highlight = !!evalResult && (evalResult.rankType.score >= 6 || evalResult.isFlush);

  const rowRef = useRef<HTMLDivElement | null>(null);
  const [cardW, setCardW] = useState(MAX_W);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const recompute = () => {
      const avail = el.clientWidth;
      if (avail <= 0) return;
      const raw = (avail - GAP * (SLOTS - 1)) / SLOTS;
      const clamped = Math.max(MIN_W, Math.min(MAX_W, Math.floor(raw)));
      setCardW(clamped);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardH = Math.round(cardW * RATIO);

  return (
    <motion.div
      layout
      className={[
        'relative rounded-2xl p-4 min-w-0 scroll-paper',
        'bg-gradient-to-b from-[#2a1810]/90 to-[#14100a]/95',
        'border-2',
        highlight
          ? 'border-gold shadow-glow'
          : 'border-amber-900/60 shadow-card-deep',
      ].join(' ')}
    >
      {/* 角落青铜装饰 */}
      <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-gold/60 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-gold/60 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-gold/60 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-gold/60 rounded-br-xl" />

      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-red-400 text-base">㊉</span>
            <div className="text-gold-grad font-bold text-base sm:text-lg tracking-widest font-kai">
              {teamIndex === 0 ? '前军' : '后军'}
            </div>
          </div>
          {full && evalResult ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <motion.span
                key={evalResult.rankType.key}
                initial={{ scale: 0.6, opacity: 0, y: -4 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260 }}
                className={[
                  'px-3 py-1 rounded-md text-sm sm:text-base font-black border-2 font-kai tracking-widest',
                  highlight
                    ? 'bg-gradient-to-b from-amber-300 to-amber-600 text-ink border-gold shadow-glow'
                    : 'bg-amber-950/80 text-amber-50 border-amber-700/60',
                ].join(' ')}
              >
                {evalResult.rankType.name}
              </motion.span>
              {evalResult.isFlush && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-2 py-1 rounded-md text-sm font-black bg-gradient-to-r from-red-500 to-red-700 text-white border-2 border-red-300 shadow-glow-red font-kai tracking-widest"
                >
                  ◆ 同花
                </motion.span>
              )}
            </div>
          ) : (
            <span className="text-xs text-amber-100/40 italic">· 配队中 ·</span>
          )}
        </div>

        <div className="text-right">
          <div className="text-[10px] text-amber-200/50 tracking-widest">军团战力</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={evalResult?.power ?? 0}
              initial={{ y: -6, opacity: 0, scale: 1.4 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 6, opacity: 0 }}
              className={[
                'text-3xl sm:text-4xl font-black tabular-nums font-kai leading-none',
                highlight ? 'text-gold-grad animate-shine' : 'text-amber-100',
              ].join(' ')}
            >
              {full && evalResult ? evalResult.power : 0}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 算法拆解反馈：点数和 × (牌型值 + 同花) = 战力 */}
      {full && evalResult && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={[
            'mb-3 px-3 py-2 rounded-lg text-sm leading-tight',
            'bg-gradient-to-r from-black/60 via-amber-950/40 to-black/60',
            'border border-amber-800/50',
          ].join(' ')}
        >
          <div className="flex items-center justify-center gap-2 font-kai font-black flex-wrap text-lg sm:text-xl">
            <span className="text-emerald-300 tabular-nums">{evalResult.pointSum}</span>
            <span className="text-amber-200/50 text-base">×</span>
            <span className="text-amber-200/50 text-base">(</span>
            <span className="text-emerald-300 tabular-nums">{evalResult.rankType.score}</span>
            <span className="text-amber-200/50 text-base">+</span>
            <span
              className={[
                'tabular-nums',
                evalResult.isFlush ? 'text-gold' : 'text-amber-200/40',
              ].join(' ')}
            >
              {evalResult.suitBonus}
            </span>
            <span className="text-amber-200/50 text-base">)</span>
            <span className="text-amber-200/50 text-base">=</span>
            <span
              className={[
                'tabular-nums',
                evalResult.capped ? 'text-red-400 line-through' : 'text-gold-grad',
              ].join(' ')}
            >
              {evalResult.rawPower}
            </span>
            {evalResult.capped && (
              <>
                <span className="text-amber-200/50 text-base">→</span>
                <span className="text-red-400 tabular-nums">{POWER_CAP}</span>
                <span className="text-[10px] text-red-300 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-400/60 font-bold tracking-widest">
                  封顶
                </span>
              </>
            )}
          </div>
          <div className="text-center text-[10px] text-amber-200/40 mt-1 italic">
            点数和 × (点数牌型值 + 同花加成) = 战力{evalResult.capped && ' · 最高 803'}
          </div>
        </motion.div>
      )}

      <div
        ref={rowRef}
        className="flex justify-center flex-nowrap w-full"
        style={{ gap: `${GAP}px` }}
      >
        {cards.map((c, si) => (
          <TeamSlot
            key={si}
            teamIndex={teamIndex}
            slotIndex={si}
            card={c}
            canRedraw={canRedraw}
            onRedraw={onRedraw}
            width={cardW}
            height={cardH}
          />
        ))}
      </div>
    </motion.div>
  );
}
