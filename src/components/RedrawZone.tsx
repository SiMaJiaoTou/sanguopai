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

  if (compact) {
    return (
      <motion.div
        ref={setNodeRef}
        layout
        className={[
          'relative w-full rounded-lg px-4 py-3 border-2 transition-all',
          'wood-panel rivets',
          'flex items-center gap-3',
          disabled
            ? 'wood-light opacity-75 border-amber-900'
            : isOver
              ? 'lacquer-red border-amber-500'
              : useFree
                ? 'wood-dark border-amber-800'
                : 'wood-light border-amber-700',
        ].join(' ')}
      >
        <div className="rivet-b" />
        <motion.div
          animate={isOver ? { rotate: 360, scale: 1.15 } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-3xl shrink-0 relative"
        >
          {disabled ? '🚫' : useFree ? '⟳' : '🪙'}
        </motion.div>

        <div className="flex-1 min-w-0 relative">
          <div className={`text-xs font-black tracking-widest leading-tight font-kai ${disabled ? 'text-red-300' : useFree ? 'text-gold-grad' : 'text-amber-200'}`}>
            {modeLabel}
          </div>
          <div className="text-[10px] text-amber-100/60 leading-tight truncate italic">
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
            'text-sm font-black tabular-nums shrink-0 px-3 py-1.5 rounded border-2 relative',
            useFree
              ? 'bg-amber-900/80 text-gold-grad border-gold'
              : disabled
                ? 'bg-red-950/80 text-red-300 border-red-700'
                : 'bg-amber-800/80 text-amber-100 border-amber-500',
          ].join(' ')}
          style={{
            boxShadow: 'inset 0 1px 2px rgba(255,220,150,0.3), 0 1px 2px rgba(0,0,0,0.6)',
          }}
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
        'relative rounded-lg wood-panel bronze-border rivets transition-all',
        disabled
          ? 'wood-light opacity-70'
          : isOver
            ? 'lacquer-red scale-[1.02]'
            : useFree
              ? 'wood-dark'
              : 'wood-light',
        'flex flex-col items-center justify-center gap-2 min-h-[180px]',
      ].join(' ')}
    >
      <div className="rivet-b" />

      <motion.div
        animate={isOver ? { rotate: [0, 180, 360], scale: 1.15 } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-5xl relative"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))' }}
      >
        {disabled ? '🚫' : useFree ? '⟳' : '🪙'}
      </motion.div>

      <div className={`font-black tracking-[0.3em] text-sm font-kai relative ${disabled ? 'text-red-300' : useFree ? 'text-gold-grad' : 'text-amber-200'}`}>
        {modeLabel}
      </div>

      <motion.div
        key={`${useFree}-${freeRedrawsLeft}-${gold}`}
        initial={{ scale: 1.4 }}
        animate={{ scale: 1 }}
        className="text-3xl font-black tabular-nums relative font-kai"
      >
        {useFree ? (
          <span className="text-gold-grad">⟳ {freeRedrawsLeft}</span>
        ) : disabled ? (
          <span className="text-red-300">—</span>
        ) : (
          <span className="text-amber-200">🪙 {paidCost}</span>
        )}
      </motion.div>

      <div className="text-[11px] text-amber-100/60 text-center leading-relaxed px-2 italic relative">
        {disabled ? (
          <>免费次数已尽 · 金币不足</>
        ) : isOver ? (
          <span className="text-gold-grad font-bold">松开以{useFree ? '免费' : '付费'}替换</span>
        ) : useFree ? (
          <>拖拽卡牌至此<br />消耗 1 次免费换将</>
        ) : (
          <>拖拽卡牌至此<br />消耗 {paidCost} 金币替换</>
        )}
      </div>

      <div className="absolute top-3 right-3 seal-red w-7 h-7 text-[10px] z-10">
        令
      </div>
    </motion.div>
  );
}
