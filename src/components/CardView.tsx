import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import type { Card } from '../types';
import { FACTION_THEME } from '../data';

interface Props {
  card: Card;
  canRedraw?: boolean;
  onRedraw?: (id: string) => void;
  compact?: boolean;
  highlight?: boolean;
}

export function CardView({ card, canRedraw, onRedraw, compact, highlight }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  const theme = FACTION_THEME[card.faction];

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.05 : 1})`,
        zIndex: isDragging ? 50 : 'auto',
      }
    : {};

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={!isDragging ? { y: -6, scale: 1.04 } : undefined}
      className={[
        'relative select-none cursor-grab active:cursor-grabbing',
        'rounded-xl ring-2',
        theme.bg,
        theme.ring,
        'shadow-card',
        isDragging ? 'opacity-80 shadow-glow' : '',
        highlight ? 'animate-shine' : '',
        compact ? 'w-[72px] h-[104px] shrink-0' : 'w-[96px] h-[136px] shrink-0',
        'p-2 flex flex-col justify-between',
        'border border-white/10',
        'backdrop-blur-sm',
      ].join(' ')}
      {...listeners}
      {...attributes}
    >
      {/* 顶部：阵营 + 点数 */}
      <div className={`flex items-start justify-between ${theme.accent}`}>
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-bold tracking-widest">{card.faction}</span>
          <span className="text-[16px] font-black">{card.pointLabel}</span>
        </div>
        <span className="text-[16px] opacity-70">{theme.glyph}</span>
      </div>

      {/* 中央：武将名 */}
      <div className={`text-center ${theme.text} font-serif`}>
        <div className={compact ? 'text-[13px]' : 'text-[16px]'} style={{ writingMode: 'horizontal-tb' }}>
          {card.name}
        </div>
      </div>

      {/* 底部：数值 + 换牌按钮 */}
      <div className={`flex items-end justify-between ${theme.accent}`}>
        <span className="text-[10px] opacity-80">值 {card.pointValue}</span>
        <span className="text-[11px] opacity-70">{theme.glyph}</span>
      </div>

      {canRedraw && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRedraw?.(card.id);
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gold text-ink text-xs font-bold shadow-md hover:animate-spin"
          title="消耗 1 次换牌次数"
        >
          ⟳
        </button>
      )}
    </motion.div>
  );
}
