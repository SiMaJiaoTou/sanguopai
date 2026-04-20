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
  /** 显式尺寸（px）—— 传入后使用自适应尺寸，忽略 compact */
  width?: number;
  height?: number;
}

export function CardView({
  card,
  canRedraw,
  onRedraw,
  compact,
  highlight,
  width,
  height,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  const theme = FACTION_THEME[card.faction];

  // 最终尺寸：显式 width/height > compact > 默认
  const w = width ?? (compact ? 72 : 96);
  const h = height ?? (compact ? 104 : 136);

  // 按卡片宽度缩放字号，保证小尺寸下仍清晰
  const scale = w / 96;
  const fs = {
    faction: Math.max(9, Math.round(11 * scale)),
    point: Math.max(12, Math.round(16 * scale)),
    glyph: Math.max(11, Math.round(16 * scale)),
    name: Math.max(11, Math.round(16 * scale)),
    val: Math.max(9, Math.round(10 * scale)),
    glyphSm: Math.max(9, Math.round(11 * scale)),
  };

  const style: React.CSSProperties = {
    width: `${w}px`,
    height: `${h}px`,
    flex: '0 0 auto',
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.05 : 1})`,
          zIndex: isDragging ? 50 : 'auto',
        }
      : {}),
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={!isDragging ? { y: -6, scale: 1.04 } : undefined}
      className={[
        'relative select-none cursor-grab active:cursor-grabbing shrink-0',
        'rounded-xl ring-2',
        theme.bg,
        theme.ring,
        'shadow-card',
        isDragging ? 'opacity-80 shadow-glow' : '',
        highlight ? 'animate-shine' : '',
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
          <span
            className="font-bold tracking-widest"
            style={{ fontSize: fs.faction }}
          >
            {card.faction}
          </span>
          <span className="font-black" style={{ fontSize: fs.point }}>
            {card.pointLabel}
          </span>
        </div>
        <span className="opacity-70" style={{ fontSize: fs.glyph }}>
          {theme.glyph}
        </span>
      </div>

      {/* 中央：武将名 */}
      <div className={`text-center ${theme.text} font-serif`}>
        <div
          style={{ writingMode: 'horizontal-tb', fontSize: fs.name, lineHeight: 1.15 }}
        >
          {card.name}
        </div>
      </div>

      {/* 底部：数值 + 花色 */}
      <div className={`flex items-end justify-between ${theme.accent}`}>
        <span className="opacity-80" style={{ fontSize: fs.val }}>
          值 {card.pointValue}
        </span>
        <span className="opacity-70" style={{ fontSize: fs.glyphSm }}>
          {theme.glyph}
        </span>
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
