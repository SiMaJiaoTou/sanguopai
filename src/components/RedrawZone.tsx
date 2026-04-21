import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';

interface Props {
  freeRedrawsLeft: number;
  gold: number;
  paidCost: number;
  compact?: boolean;
}

export function RedrawZone({ freeRedrawsLeft, gold, paidCost, compact }: Props) {
  const useFree = freeRedrawsLeft > 0;
  const canPay = gold >= paidCost;
  const disabled = !useFree && !canPay;
  const { setNodeRef, isOver } = useDroppable({
    id: 'redraw-zone',
    data: { type: 'redraw' },
    disabled,
  });

  const modeLabel = useFree ? '免费换将令' : disabled ? '无力换将' : '付费换将';
  const priceLabel = useFree ? `剩余 ${freeRedrawsLeft}` : `需 🪙 ${paidCost}`;
  const modeColor = useFree ? 'text-gold' : disabled ? 'text-red-300' : 'text-amber-300';

  if (compact) {
    return (
      <motion.div
        ref={setNodeRef}
        layout
        className={[
          'sticky top-[60px] z-30 w-full rounded-xl px-4 py-3 border-2 border-dashed transition-all',
          'flex items-center gap-3 backdrop-blur-md',
          disabled
            ? 'border-white/15 bg-black/50 opacity-70'
            : isOver
              ? 'border-gold bg-gold/25 shadow-glow scale-[1.01]'
              : useFree
                ? 'border-gold/40 bg-gradient-to-r from-amber-900/40 to-red-900/40'
                : 'border-amber-500/40 bg-gradient-to-r from-amber-800/30 to-orange-900/30',
        ].join(' ')}
      >
        <motion.div
          animate={isOver ? { rotate: 360, scale: 1.15 } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-2xl shrink-0"
        >
          {disabled ? '🚫' : useFree ? '⟳' : '🪙'}
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold tracking-widest leading-tight ${modeColor}`}>
            {modeLabel}
          </div>
          <div className="text-[10px] text-white/50 leading-tight truncate">
            {disabled
              ? '免费次数已尽且金币不足'
              : isOver
                ? useFree
                  ? '松开以免费替换'
                  : `松开替换：消耗 ${paidCost} 金币`
                : '长按卡牌拖到此处替换'}
          </div>
        </div>

        <motion.div
          key={`${useFree}-${freeRedrawsLeft}-${gold}`}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className={[
            'text-sm font-black tabular-nums shrink-0 px-2 py-1 rounded border',
            useFree
              ? 'text-gold border-gold/40 bg-gold/10'
              : disabled
                ? 'text-red-300 border-red-400/40 bg-red-500/10'
                : 'text-amber-300 border-amber-400/40 bg-amber-500/10',
          ].join(' ')}
        >
          {priceLabel}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      layout
      className={[
        'relative w-full rounded-2xl p-5 border-2 border-dashed transition-all',
        'flex flex-col items-center justify-center gap-2 min-h-[180px]',
        disabled
          ? 'border-white/10 bg-black/20 opacity-60'
          : isOver
            ? 'border-gold bg-gold/15 shadow-glow scale-[1.02]'
            : useFree
              ? 'border-gold/40 bg-gradient-to-br from-amber-900/20 to-red-900/20 hover:border-gold/70'
              : 'border-amber-500/40 bg-gradient-to-br from-amber-800/20 to-orange-900/20 hover:border-amber-400/70',
      ].join(' ')}
    >
      <motion.div
        animate={isOver ? { rotate: [0, 180, 360], scale: 1.15 } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-4xl"
      >
        {disabled ? '🚫' : useFree ? '⟳' : '🪙'}
      </motion.div>

      <div className={`font-bold tracking-widest text-sm ${modeColor}`}>{modeLabel}</div>

      <motion.div
        key={`${useFree}-${freeRedrawsLeft}-${gold}`}
        initial={{ scale: 1.4 }}
        animate={{ scale: 1 }}
        className="text-3xl font-black tabular-nums"
      >
        {useFree ? (
          <span className="text-gold">⟳ {freeRedrawsLeft}</span>
        ) : disabled ? (
          <span className="text-red-300">—</span>
        ) : (
          <span className="text-amber-300">🪙 {paidCost}</span>
        )}
      </motion.div>

      <div className="text-[11px] text-white/50 text-center leading-relaxed px-2">
        {disabled ? (
          <>免费次数已尽 · 金币不足</>
        ) : isOver ? (
          <span className="text-gold">松开以{useFree ? '免费' : '付费'}替换</span>
        ) : useFree ? (
          <>拖拽卡牌至此<br />消耗 1 次免费换将</>
        ) : (
          <>拖拽卡牌至此<br />消耗 {paidCost} 金币替换</>
        )}
      </div>

      <div className="absolute top-2 right-2 text-[10px] text-red-400/80 border border-red-400/40 px-1.5 py-0.5 rounded-sm font-bold tracking-widest">
        令
      </div>
    </motion.div>
  );
}
