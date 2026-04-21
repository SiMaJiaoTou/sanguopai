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
        'rounded-2xl p-4 bg-black/40 border min-w-0',
        highlight ? 'border-gold shadow-glow' : 'border-white/10',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-gold font-bold text-lg">第 {teamIndex + 1} 军</div>
          {full && evalResult ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <motion.span
                key={evalResult.rankType.key}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={[
                  'px-2 py-0.5 rounded-md text-xs font-bold',
                  'bg-white/10 text-white',
                ].join(' ')}
              >
                {evalResult.rankType.name}
              </motion.span>
              {evalResult.isFlush && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-2 py-0.5 rounded-md text-xs font-bold bg-gold text-ink"
                >
                  同花
                </motion.span>
              )}
            </div>
          ) : (
            <span className="text-xs text-white/40">配队中…</span>
          )}
        </div>

        <div className="text-right">
          <div className="text-[11px] text-white/50">军团战力</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={evalResult?.power ?? 0}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 6, opacity: 0 }}
              className={[
                'text-2xl font-black tabular-nums',
                highlight ? 'text-gold animate-shine' : 'text-white',
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
            'mb-3 px-3 py-2 rounded-lg text-[11px] leading-tight',
            'bg-black/30 border border-white/10',
          ].join(' ')}
        >
          <div className="flex items-center justify-center gap-1.5 font-mono flex-wrap">
            <span className="text-white/60">{evalResult.pointSum}</span>
            <span className="text-white/40">×</span>
            <span className="text-white/40">(</span>
            <span className="text-emerald-300">{evalResult.rankType.score}</span>
            <span className="text-white/40">+</span>
            <span className={evalResult.isFlush ? 'text-gold font-bold' : 'text-white/35'}>
              {evalResult.suitBonus}
            </span>
            <span className="text-white/40">)</span>
            <span className="text-white/40">=</span>
            <span
              className={[
                'font-black',
                evalResult.capped ? 'text-red-300 line-through' : 'text-gold',
              ].join(' ')}
            >
              {evalResult.rawPower}
            </span>
            {evalResult.capped && (
              <>
                <span className="text-white/40">→</span>
                <span className="text-red-300 font-black">{POWER_CAP}</span>
                <span className="text-[9px] text-red-300/80 px-1 py-0 rounded bg-red-500/20 border border-red-400/40">
                  封顶
                </span>
              </>
            )}
          </div>
          <div className="text-center text-[9px] text-white/35 mt-1">
            点数和 × (点数牌型值 + 同花加成) = 战力{evalResult.capped && '（上限 803）'}
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
