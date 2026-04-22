import { motion } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import type { Card } from '../types';

interface Props {
  card: Card;
  compact?: boolean;
  highlight?: boolean;
  /** 显式尺寸（px）—— 传入后使用自适应尺寸，忽略 compact */
  width?: number;
  height?: number;
}

/**
 * 武将随从卡（圆形头像 + 3 枚贴圆周徽章）
 * 所有装饰直接挂在圆周上，不浮空：
 *   NW：阵营玉押    NE：金色战力
 *   S ：名字铜匾
 */

// 阵营配色
const FACTION_PORTRAIT: Record<
  string,
  {
    ring: string;
    ringDark: string;
    inner: string;
    glow: string;
    face: string;
    accentText: string;
    accentDark: string;
    plume: string; // 盔缨颜色
  }
> = {
  魏: {
    ring: '#3b82f6',
    ringDark: '#1e40af',
    inner: 'radial-gradient(ellipse at 30% 25%, #2b4b9e 0%, #1e3a8a 45%, #0a1f4d 100%)',
    glow: 'rgba(59,130,246,0.7)',
    face: '#e3d4b8',
    accentText: '#f0f6ff',
    accentDark: '#0a1f4d',
    plume: '#a7c3ff',
  },
  蜀: {
    ring: '#10b981',
    ringDark: '#065f46',
    inner: 'radial-gradient(ellipse at 30% 25%, #0d8f6e 0%, #047857 45%, #022c22 100%)',
    glow: 'rgba(16,185,129,0.7)',
    face: '#e3d4b8',
    accentText: '#e5fff4',
    accentDark: '#022c22',
    plume: '#b4efd2',
  },
  吴: {
    ring: '#ef4444',
    ringDark: '#991b1b',
    inner: 'radial-gradient(ellipse at 30% 25%, #d22a2a 0%, #b91c1c 45%, #5a0f0f 100%)',
    glow: 'rgba(239,68,68,0.7)',
    face: '#e3d4b8',
    accentText: '#fff2f2',
    accentDark: '#5a0f0f',
    plume: '#ffdcb0',
  },
  群: {
    ring: '#d97706',
    ringDark: '#78350f',
    inner: 'radial-gradient(ellipse at 30% 25%, #b05410 0%, #92400e 45%, #3a1a05 100%)',
    glow: 'rgba(217,119,6,0.7)',
    face: '#e3d4b8',
    accentText: '#fff4d8',
    accentDark: '#3a1a05',
    plume: '#ffd890',
  },
};

// 圆上 45° 方向的弧线点（距圆心距离 = r * cos(45°) ≈ 0.707r）
// 徽章中心落在圆周 NW / NE 处
const PERIMETER_INSET = 0.146;

export function CardView({
  card,
  compact,
  highlight,
  width,
  height,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  const portrait = FACTION_PORTRAIT[card.faction] ?? FACTION_PORTRAIT['群'];

  const w = width ?? (compact ? 80 : 110);
  const h = height ?? (compact ? 116 : 160);

  const scale = w / 110;
  const fs = {
    name: Math.max(11, Math.round(13 * scale)),
    faction: Math.max(10, Math.round(12 * scale)),
    value: Math.max(13, Math.round(16 * scale)),
  };

  const portraitSize = Math.round(Math.min(w * 0.82, h * 0.72));
  const portraitTop = Math.round(Math.max(8 * scale, 6 * scale));
  const portraitLeft = Math.round((w - portraitSize) / 2);

  const style: React.CSSProperties = {
    width: `${w}px`,
    height: `${h}px`,
    flex: '0 0 auto',
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${
            isDragging ? 1.05 : 1
          })`,
          zIndex: isDragging ? 50 : 'auto',
        }
      : {}),
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      whileHover={!isDragging ? { y: -6, scale: 1.06 } : undefined}
      className={[
        'relative select-none cursor-grab active:cursor-grabbing shrink-0 touch-none',
        isDragging ? 'opacity-80' : '',
      ].join(' ')}
      {...listeners}
      {...attributes}
    >
      {/* 头像容器（所有徽章挂在这个容器上，相对圆周定位） */}
      <div
        className="absolute"
        style={{
          left: `${portraitLeft}px`,
          top: `${portraitTop}px`,
          width: `${portraitSize}px`,
          height: `${portraitSize}px`,
          zIndex: 2,
        }}
      >
        {/* ============ 圆形头像 ============ */}
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          {/* 阵营色光晕 */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `0 0 ${Math.round(18 * scale)}px ${portrait.glow}, 0 4px 12px rgba(0,0,0,0.85)`,
            }}
          />
          {/* 高光在动动画时更亮（highlight） */}
          {highlight && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow:
                  '0 0 24px rgba(255,245,200,0.75), 0 0 40px rgba(212,175,55,0.45)',
              }}
            />
          )}

          {/* 金色外圈（多层金属质感） */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 210deg, #8b5a28 0deg, #f7d57a 60deg, #fff5cc 90deg, #f7d57a 120deg, #8b5a28 180deg, #4a2810 240deg, #8b5a28 300deg, #f7d57a 360deg)',
              padding: `${Math.max(2, Math.round(3 * scale))}px`,
              boxShadow:
                'inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,240,200,0.45)',
            }}
          >
            {/* 阵营色中圈（双环） */}
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `linear-gradient(180deg, ${portrait.ring} 0%, ${portrait.ringDark} 100%)`,
                padding: `${Math.max(1, Math.round(1.8 * scale))}px`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              {/* 阵营深色底 + 武将肖像图 */}
              <div
                className="relative w-full h-full rounded-full overflow-hidden"
                style={{
                  background: portrait.inner,
                  boxShadow:
                    'inset 0 3px 6px rgba(0,0,0,0.7), inset 0 -2px 3px rgba(255,240,200,0.1)',
                }}
              >
                {/* 肖像 */}
                <img
                  src="/hero.png"
                  alt={card.name}
                  draggable={false}
                  className="absolute inset-0 w-full h-full select-none pointer-events-none"
                  style={{
                    objectFit: 'cover',
                    // 稍微上偏，避免头顶金冠被圆形裁掉
                    objectPosition: '50% 22%',
                  }}
                />
                {/* 阵营色调染层（让不同阵营颜色可辨） */}
                <div
                  className="absolute inset-0 pointer-events-none mix-blend-color"
                  style={{
                    background: portrait.ring,
                    opacity: 0.28,
                  }}
                />
                {/* 边缘渐暗 vignette，让脸部更聚焦 */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)',
                  }}
                />
                {/* 顶部高光 · 金属反光 */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(255,240,200,0.18) 0%, transparent 35%)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============ 左上：阵营玉押（贴圆 NW 弧） ============ */}
        <div
          className="absolute font-kai font-black flex items-center justify-center"
          style={{
            left: `${portraitSize * PERIMETER_INSET}px`,
            top: `${portraitSize * PERIMETER_INSET}px`,
            transform: 'translate(-50%, -50%)',
            width: `${Math.round(28 * scale)}px`,
            height: `${Math.round(28 * scale)}px`,
            color: portrait.accentText,
            fontSize: fs.faction,
            lineHeight: 1,
            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, transparent 40%), linear-gradient(180deg, ${portrait.ring} 0%, ${portrait.accentDark} 100%)`,
            border: '2px solid #d4af37',
            borderRadius: '50%',
            textShadow: '0 1px 2px rgba(0,0,0,0.95)',
            letterSpacing: 0,
            boxShadow:
              'inset 0 1px 0 rgba(255,245,200,0.55), inset 0 -1px 2px rgba(0,0,0,0.45), 0 2px 5px rgba(0,0,0,0.85)',
            zIndex: 4,
          }}
        >
          {card.faction}
        </div>

        {/* ============ 右上：金色战力玉押（贴圆 NE 弧） ============ */}
        <div
          className="absolute font-kai font-black tabular-nums flex items-center justify-center"
          style={{
            right: `${portraitSize * PERIMETER_INSET}px`,
            top: `${portraitSize * PERIMETER_INSET}px`,
            transform: 'translate(50%, -50%)',
            width: `${Math.round(30 * scale)}px`,
            height: `${Math.round(30 * scale)}px`,
            color: '#2a1608',
            fontSize: fs.value,
            lineHeight: 1,
            background:
              'radial-gradient(circle at 30% 25%, #fff5cc 0%, #fde68a 30%, #d4af37 65%, #6b490f 100%)',
            border: '2px solid #2a1608',
            borderRadius: '50%',
            textShadow: '0 1px 1px rgba(255,245,200,0.65)',
            boxShadow:
              'inset 0 2px 3px rgba(255,255,255,0.65), inset 0 -2px 3px rgba(80,50,10,0.55), 0 3px 6px rgba(0,0,0,0.85)',
            zIndex: 4,
          }}
        >
          {card.pointValue}
        </div>

        {/* ============ 名字铜匾（贴圆 S 弧） ============ */}
        <div
          className="absolute font-kai font-black text-center"
          style={{
            left: '50%',
            top: '100%',
            transform: 'translate(-50%, -55%)',
            fontSize: fs.name,
            lineHeight: 1,
            color: '#fde68a',
            padding: `${Math.round(3.5 * scale)}px ${Math.round(11 * scale)}px`,
            background:
              'linear-gradient(180deg, #6b4228 0%, #3a2414 45%, #1a0f08 100%)',
            border: '1.5px solid #d4af37',
            borderRadius: '3px',
            textShadow:
              '0 1px 2px rgba(0,0,0,0.95), 0 0 5px rgba(212,175,55,0.45)',
            letterSpacing: '0.12em',
            boxShadow:
              'inset 0 1px 0 rgba(255,220,160,0.45), inset 0 -1px 2px rgba(0,0,0,0.55), 0 3px 7px rgba(0,0,0,0.85)',
            whiteSpace: 'nowrap',
            maxWidth: `${Math.round(w * 1.08)}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            zIndex: 4,
          }}
        >
          {/* 铜匾双线装饰（内描边） */}
          <span
            aria-hidden
            className="absolute inset-[3px] pointer-events-none"
            style={{
              border: '1px dashed rgba(212,175,55,0.35)',
              borderRadius: 2,
            }}
          />
          <span className="relative">{card.name}</span>
        </div>
      </div>
    </motion.div>
  );
}
