import { motion, AnimatePresence } from 'framer-motion';
import type { Card, EvaluateResult } from '../types';
import { TeamSlot } from './TeamSlot';

interface Props {
  teamIndex: number;
  cards: (Card | null)[];
  evalResult: EvaluateResult | null;
  canRedraw: boolean;
  onRedraw: (id: string) => void;
}

export function TeamPanel({ teamIndex, cards, evalResult, canRedraw, onRedraw }: Props) {
  const full = cards.every((c) => c !== null);
  const highlight = !!evalResult && evalResult.handType.multiplier >= 15;

  return (
    <motion.div
      layout
      className={[
        'rounded-2xl p-4 bg-black/40 border',
        highlight ? 'border-gold shadow-glow' : 'border-white/10',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-gold font-bold text-lg">第 {teamIndex + 1} 军</div>
          {full && evalResult ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">牌型</span>
              <motion.span
                key={evalResult.handType.key}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={[
                  'px-2 py-0.5 rounded-md text-sm font-bold',
                  highlight ? 'bg-gold text-ink' : 'bg-white/10 text-white',
                ].join(' ')}
              >
                {evalResult.handType.name}
              </motion.span>
              <span className="text-xs text-white/50">×{evalResult.handType.multiplier}</span>
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
          {full && evalResult && (
            <div className="text-[10px] text-white/40">
              点数和 {evalResult.pointSum} × {evalResult.handType.multiplier}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        {cards.map((c, si) => (
          <TeamSlot
            key={si}
            teamIndex={teamIndex}
            slotIndex={si}
            card={c}
            canRedraw={canRedraw}
            onRedraw={onRedraw}
          />
        ))}
      </div>
    </motion.div>
  );
}
