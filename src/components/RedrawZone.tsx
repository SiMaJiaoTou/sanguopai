import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';

interface Props {
  redrawsLeft: number;
  /** 紧凑模式：移动端置顶使用的横向条，减少垂直空间占用 */
  compact?: boolean;
}

export function RedrawZone({ redrawsLeft, compact }: Props) {
  const disabled = redrawsLeft <= 0;
  const { setNodeRef, isOver } = useDroppable({
    id: 'redraw-zone',
    data: { type: 'redraw' },
    disabled,
  });

  if (compact) {
    // 紧凑横向条：移动端 sticky 置顶
    return (
      <motion.div
        ref={setNodeRef}
        layout
        className={[
          'sticky top-2 z-30 w-full rounded-xl px-4 py-3 border-2 border-dashed transition-all',
          'flex items-center gap-3 backdrop-blur-md',
          disabled
            ? 'border-white/15 bg-black/50 opacity-70'
            : isOver
              ? 'border-gold bg-gold/25 shadow-glow scale-[1.01]'
              : 'border-gold/40 bg-gradient-to-r from-amber-900/40 to-red-900/40',
        ].join(' ')}
      >
        <motion.div
          animate={isOver ? { rotate: 360, scale: 1.15 } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-2xl shrink-0"
        >
          {disabled ? '🚫' : '⟳'}
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="text-gold text-xs font-bold tracking-widest leading-tight">
            换将令
          </div>
          <div className="text-[10px] text-white/50 leading-tight truncate">
            {disabled
              ? '已无换将令'
              : isOver
                ? '松开替换此卡'
                : '长按卡牌拖到此处替换'}
          </div>
        </div>

        <motion.div
          key={redrawsLeft}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          className={[
            'text-2xl font-black tabular-nums shrink-0',
            disabled ? 'text-slate-500' : 'text-gold',
          ].join(' ')}
        >
          {redrawsLeft}
        </motion.div>
      </motion.div>
    );
  }

  // 默认：桌面端竖版大号区块
  return (
    <motion.div
      ref={setNodeRef}
      layout
      className={[
        'relative w-full rounded-2xl p-5 border-2 border-dashed transition-all',
        'flex flex-col items-center justify-center gap-2 min-h-[160px]',
        disabled
          ? 'border-white/10 bg-black/20 opacity-60'
          : isOver
            ? 'border-gold bg-gold/15 shadow-glow scale-[1.02]'
            : 'border-gold/40 bg-gradient-to-br from-amber-900/20 to-red-900/20 hover:border-gold/70',
      ].join(' ')}
    >
      <motion.div
        animate={isOver ? { rotate: [0, 180, 360], scale: 1.15 } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-4xl"
      >
        {disabled ? '🚫' : '⟳'}
      </motion.div>

      <div className="text-gold font-bold tracking-widest text-sm">换将令</div>

      <motion.div
        key={redrawsLeft}
        initial={{ scale: 1.4, color: '#fde047' }}
        animate={{ scale: 1, color: disabled ? '#64748b' : '#d4af37' }}
        className="text-4xl font-black tabular-nums"
      >
        {redrawsLeft}
      </motion.div>

      <div className="text-[11px] text-white/50 text-center leading-relaxed px-2">
        {disabled ? (
          <>已无换将令</>
        ) : isOver ? (
          <span className="text-gold">松开以替换此卡</span>
        ) : (
          <>拖拽卡牌至此<br />消耗 1 次替换</>
        )}
      </div>

      {/* 装饰印章 */}
      <div className="absolute top-2 right-2 text-[10px] text-red-400/80 border border-red-400/40 px-1.5 py-0.5 rounded-sm font-bold tracking-widest">
        令
      </div>
    </motion.div>
  );
}
