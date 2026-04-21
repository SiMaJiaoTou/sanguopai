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

/**
 * 简化版卡面：仅显示阵营（魏/蜀/吴/群）+ 战斗力（点数值）
 * 视觉结构：
 *   ┌───────────────┐
 *   │               │
 *   │      魏       │   ← 大号阵营字（顶部）
 *   │               │
 *   │      13       │   ← 超大战斗力数字（中下部）
 *   │               │
 *   └───────────────┘
 */
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

  const w = width ?? (compact ? 72 : 96);
  const h = height ?? (compact ? 104 : 136);

  // 按卡片宽度缩放字号
  const scale = w / 96;
  const fs = {
    faction: Math.max(18, Math.round(28 * scale)), // 阵营字放大
    value: Math.max(28, Math.round(44 * scale)),   // 战斗力超大
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
        'relative select-none cursor-grab active:cursor-grabbing shrink-0 touch-none',
        'rounded-lg ring-2',
        theme.bg,
        theme.ring,
        'shadow-card-deep',
        isDragging ? 'opacity-80 shadow-glow' : '',
        highlight ? 'animate-shine' : '',
        'flex flex-col items-center justify-center overflow-hidden',
        'border-2 border-[#1a0f08]',
      ].join(' ')}
      {...listeners}
      {...attributes}
    >
      {/* 材质覆膜（厚重感） */}
      <div className="card-texture-overlay" />

      {/* 内边金线装饰 */}
      <div className="absolute inset-1 rounded-md border border-gold/30 pointer-events-none z-[2]" />

      {/* 阵营字（上） */}
      <div
        className={`relative z-10 font-kai font-black ${theme.accent}`}
        style={{
          fontSize: fs.faction,
          lineHeight: 1,
          marginBottom: Math.round(6 * scale),
          textShadow: `
            -1px -1px 0 rgba(0,0,0,0.8),
            1px -1px 0 rgba(0,0,0,0.8),
            -1px 1px 0 rgba(0,0,0,0.8),
            1px 1px 0 rgba(0,0,0,0.8),
            0 0 6px rgba(0,0,0,0.6)
          `,
          letterSpacing: '0.05em',
        }}
      >
        {card.faction}
      </div>

      {/* 金线分隔 */}
      <div
        className="relative z-10"
        style={{
          width: '60%',
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.7) 50%, transparent 100%)',
          marginBottom: Math.round(4 * scale),
        }}
      />

      {/* 战斗力数字（下，超大） */}
      <div
        className={`relative z-10 font-kai font-black tabular-nums ${theme.text}`}
        style={{
          fontSize: fs.value,
          lineHeight: 1,
          textShadow: `
            -1.5px -1.5px 0 rgba(0,0,0,0.9),
            1.5px -1.5px 0 rgba(0,0,0,0.9),
            -1.5px 1.5px 0 rgba(0,0,0,0.9),
            1.5px 1.5px 0 rgba(0,0,0,0.9),
            0 0 10px rgba(212,175,55,0.4),
            0 2px 4px rgba(0,0,0,0.8)
          `,
        }}
      >
        {card.pointValue}
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
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gold text-ink text-xs font-bold shadow-md hover:animate-spin z-20"
          title="消耗 1 次换牌次数"
        >
          ⟳
        </button>
      )}
    </motion.div>
  );
}
