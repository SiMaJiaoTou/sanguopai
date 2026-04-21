import React, { useEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card, EvaluateResult, Faction } from '../types';
import { POWER_CAP } from '../evaluate';

interface Props {
  teamIndex: number;
  cards: (Card | null)[];
  evalResult: EvaluateResult | null;
  canRedraw: boolean;
  onRedraw: (id: string) => void;
}

/**
 * 阵营 3D 调色板 —— 精细化版
 *  含 12 色梯度（躯干/铠甲/缨穗/旗面/金属等）
 */
const FACTION_3D: Record<
  Faction,
  {
    armorLight: string;
    armor: string;
    armorDark: string;
    armorEdge: string;
    flag: string;
    flagDark: string;
    flagLight: string;
    tassel: string;      // 缨穗 / 红缨
    tasselDark: string;
    metal: string;       // 金属件（肩甲/头盔）
    metalDark: string;
    text: string;
    glow: string;
    char: string;
    skin: string;        // 面部（简化为一个色块）
  }
> = {
  魏: {
    armorLight: '#3a6ba3',
    armor: '#1e3a5f',
    armorDark: '#0f1e33',
    armorEdge: '#60a5fa',
    flag: '#1e40af',
    flagDark: '#0a1f4d',
    flagLight: '#3b82f6',
    tassel: '#dc2626',
    tasselDark: '#7f1d1d',
    metal: '#cbd5e1',
    metalDark: '#64748b',
    text: '#dbeafe',
    glow: 'rgba(59, 130, 246, 0.7)',
    char: '#bfdbfe',
    skin: '#d4a574',
  },
  蜀: {
    armorLight: '#a83838',
    armor: '#7a1f1f',
    armorDark: '#3a0808',
    armorEdge: '#fb7185',
    flag: '#991b1b',
    flagDark: '#450a0a',
    flagLight: '#dc2626',
    tassel: '#fbbf24',
    tasselDark: '#92400e',
    metal: '#d4af37',
    metalDark: '#78350f',
    text: '#fee2e2',
    glow: 'rgba(239, 68, 68, 0.7)',
    char: '#fecaca',
    skin: '#d4a574',
  },
  吴: {
    armorLight: '#2d6b4e',
    armor: '#0f3826',
    armorDark: '#04180f',
    armorEdge: '#34d399',
    flag: '#065f46',
    flagDark: '#022c22',
    flagLight: '#10b981',
    tassel: '#fbbf24',
    tasselDark: '#92400e',
    metal: '#d4af37',
    metalDark: '#78350f',
    text: '#d1fae5',
    glow: 'rgba(16, 185, 129, 0.7)',
    char: '#a7f3d0',
    skin: '#d4a574',
  },
  群: {
    armorLight: '#6b6448',
    armor: '#3d3a2a',
    armorDark: '#1a1810',
    armorEdge: '#fbbf24',
    flag: '#78350f',
    flagDark: '#3a1a05',
    flagLight: '#d97706',
    tassel: '#dc2626',
    tasselDark: '#7f1d1d',
    metal: '#d4af37',
    metalDark: '#78350f',
    text: '#fef3c7',
    glow: 'rgba(251, 191, 36, 0.7)',
    char: '#fde68a',
    skin: '#d4a574',
  },
};

const SLOTS = 5;
const MIN_W = 64;
const MAX_W = 110;
const GAP = 10;

/**
 * 小兵 3D 模型（精细化）
 * 组成（从上到下）：
 *   - 长矛/战旗（右侧斜插）
 *   - 头盔 + 红缨
 *   - 面部
 *   - 肩甲
 *   - 铠甲胸片（显示阵营字 + 点数）
 *   - 腰带（显示武将名）
 *   - 梯形基座（显示战力数字）
 */
function Soldier({
  card,
  width,
  index,
  highlight,
}: {
  card: Card;
  width: number;
  index: number;
  highlight: boolean;
}) {
  const t = FACTION_3D[card.faction];
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  const bodyW = width * 0.85;
  const bodyH = width * 1.45;
  const baseW = width;
  const baseH = width * 0.35;
  const totalH = bodyH + baseH;

  const dragStyle: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.1 : 1})`,
        zIndex: isDragging ? 50 : 'auto',
      }
    : {};

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ y: 60, opacity: 0, scaleY: 0.3 }}
      animate={{ y: 0, opacity: 1, scaleY: 1 }}
      exit={{ y: -30, opacity: 0, scale: 0.7 }}
      transition={{
        type: 'spring',
        stiffness: 220,
        damping: 18,
        delay: index * 0.06,
      }}
      style={{
        width: baseW,
        height: totalH,
        ...dragStyle,
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.9 : 1,
        filter: isDragging ? `drop-shadow(0 8px 12px ${t.glow})` : undefined,
      }}
      className="relative flex flex-col items-center justify-end select-none"
      {...listeners}
      {...attributes}
    >
      {/* =========== 主体（上半身） =========== */}
      <motion.div
        animate={{ rotate: [-1.2, 1.2, -1.2] }}
        transition={{
          duration: 3 + index * 0.15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          width: bodyW,
          height: bodyH,
          transformOrigin: 'bottom center',
        }}
        className="relative"
      >
        {/* —— 长矛（右后） —— */}
        <div
          className="absolute"
          style={{
            right: -4,
            top: -10,
            width: 3,
            height: bodyH * 1.1,
            transform: 'rotate(12deg)',
            background:
              'linear-gradient(180deg, #a8753a 0%, #5a3810 50%, #2a1608 100%)',
            boxShadow: '1px 0 2px rgba(0,0,0,0.6)',
            borderRadius: 1,
          }}
        />
        {/* 矛尖 */}
        <div
          className="absolute"
          style={{
            right: -8,
            top: -14,
            width: 0,
            height: 0,
            transform: 'rotate(12deg)',
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: `14px solid ${t.metal}`,
            filter: `drop-shadow(0 0 3px ${t.glow})`,
          }}
        />
        {/* 矛下红缨 */}
        <div
          className="absolute"
          style={{
            right: -2,
            top: 12,
            width: 6,
            height: 10,
            transform: 'rotate(12deg)',
            background: `linear-gradient(180deg, ${t.tassel} 0%, ${t.tasselDark} 100%)`,
            borderRadius: '50% 50% 20% 20% / 30% 30% 70% 70%',
            boxShadow: `0 0 4px ${t.tassel}`,
          }}
        />

        {/* —— 小战旗（左后） —— */}
        <div
          className="absolute"
          style={{
            left: -2,
            top: -6,
            width: 2.5,
            height: bodyH * 0.8,
            transform: 'rotate(-8deg)',
            background:
              'linear-gradient(180deg, #d4af37 0%, #5a3810 100%)',
            boxShadow: '1px 0 2px rgba(0,0,0,0.6)',
          }}
        />
        <motion.div
          animate={{ skewY: [-2, 2, -2] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute"
          style={{
            left: 0,
            top: -4,
            width: width * 0.32,
            height: width * 0.22,
            transform: 'rotate(-8deg)',
            transformOrigin: 'left top',
            background: `linear-gradient(90deg, ${t.flagDark} 0%, ${t.flag} 50%, ${t.flagLight} 100%)`,
            clipPath: 'polygon(0 0, 100% 0, 85% 50%, 100% 100%, 0 100%)',
            boxShadow: `inset 0 0 4px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.6)`,
            border: `1px solid ${t.flagDark}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: width * 0.16,
            color: t.char,
            fontWeight: 900,
            fontFamily: 'STKaiti, KaiTi, serif',
            textShadow: `0 0 3px ${t.glow}, 1px 1px 0 ${t.flagDark}`,
          }}
        >
          {card.faction}
        </motion.div>

        {/* =========== 头盔区域 =========== */}
        <div
          className="absolute left-1/2"
          style={{
            top: 0,
            width: width * 0.5,
            height: width * 0.45,
            transform: 'translateX(-50%)',
          }}
        >
          {/* 头盔主体（半球状） */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: width * 0.08,
              height: width * 0.3,
              background: `
                radial-gradient(ellipse at 35% 30%, ${t.metal} 0%, ${t.armor} 60%, ${t.armorDark} 100%)
              `,
              borderRadius: '50% 50% 30% 30% / 70% 70% 30% 30%',
              border: `1.5px solid ${t.armorDark}`,
              boxShadow: `
                inset 1px 1px 2px rgba(255,255,255,0.3),
                inset -2px -2px 3px rgba(0,0,0,0.5),
                0 2px 3px rgba(0,0,0,0.6)
              `,
            }}
          />
          {/* 头盔顶饰（金属钉） */}
          <div
            className="absolute left-1/2"
            style={{
              top: width * 0.03,
              width: width * 0.1,
              height: width * 0.1,
              transform: 'translateX(-50%)',
              background: `radial-gradient(circle at 30% 30%, ${t.metal} 0%, ${t.metalDark} 70%, #000 100%)`,
              borderRadius: '50%',
              boxShadow: `0 0 4px ${t.glow}`,
            }}
          />
          {/* 红缨（从头盔顶向后飘） */}
          <motion.div
            animate={{ skewX: [-3, 3, -3], scaleY: [0.95, 1.05, 0.95] }}
            transition={{ duration: 2 + index * 0.1, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2"
            style={{
              top: -width * 0.1,
              width: width * 0.18,
              height: width * 0.22,
              transform: 'translateX(-50%)',
              background: `
                linear-gradient(180deg,
                  ${t.tassel} 0%,
                  ${t.tasselDark} 100%)
              `,
              borderRadius: '50% 50% 20% 20% / 60% 60% 40% 40%',
              boxShadow: `0 0 6px ${t.tassel}, inset 0 -2px 3px rgba(0,0,0,0.4)`,
              filter: 'blur(0.3px)',
            }}
          />
          {/* 头盔前额护片（点数 / 等级徽章） */}
          <div
            className="absolute left-1/2 font-kai font-black"
            style={{
              top: width * 0.15,
              width: width * 0.24,
              height: width * 0.14,
              transform: 'translateX(-50%)',
              background: `linear-gradient(180deg, ${t.metal} 0%, ${t.metalDark} 100%)`,
              border: `1px solid ${t.armorDark}`,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: width * 0.12,
              color: t.armorDark,
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.5)',
              textShadow: '1px 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            {card.pointLabel}
          </div>
        </div>

        {/* =========== 面部 =========== */}
        <div
          className="absolute left-1/2"
          style={{
            top: width * 0.42,
            width: width * 0.28,
            height: width * 0.18,
            transform: 'translateX(-50%)',
            background: `radial-gradient(ellipse at 40% 40%, ${t.skin} 0%, #8b6040 100%)`,
            borderRadius: '50% 50% 40% 40% / 60% 60% 40% 40%',
            boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {/* 眼睛（两点） */}
          <div
            className="absolute"
            style={{
              left: '25%',
              top: '35%',
              width: 2,
              height: 2,
              background: '#000',
              borderRadius: '50%',
            }}
          />
          <div
            className="absolute"
            style={{
              right: '25%',
              top: '35%',
              width: 2,
              height: 2,
              background: '#000',
              borderRadius: '50%',
            }}
          />
        </div>

        {/* =========== 肩甲（左右） =========== */}
        <div
          className="absolute"
          style={{
            left: '8%',
            top: width * 0.55,
            width: width * 0.22,
            height: width * 0.18,
            background: `linear-gradient(135deg, ${t.metal} 0%, ${t.armor} 60%, ${t.armorDark} 100%)`,
            borderRadius: '60% 30% 40% 60% / 70% 30% 40% 60%',
            border: `1px solid ${t.armorDark}`,
            boxShadow: `inset 1px 1px 1px rgba(255,255,255,0.3), 0 2px 3px rgba(0,0,0,0.5)`,
            transform: 'rotate(-15deg)',
          }}
        />
        <div
          className="absolute"
          style={{
            right: '8%',
            top: width * 0.55,
            width: width * 0.22,
            height: width * 0.18,
            background: `linear-gradient(225deg, ${t.metal} 0%, ${t.armor} 60%, ${t.armorDark} 100%)`,
            borderRadius: '30% 60% 60% 40% / 30% 70% 60% 40%',
            border: `1px solid ${t.armorDark}`,
            boxShadow: `inset -1px 1px 1px rgba(255,255,255,0.3), 0 2px 3px rgba(0,0,0,0.5)`,
            transform: 'rotate(15deg)',
          }}
        />

        {/* =========== 胸甲（主躯干） =========== */}
        <div
          className="absolute left-1/2"
          style={{
            top: width * 0.62,
            width: width * 0.65,
            height: width * 0.58,
            transform: 'translateX(-50%)',
            background: `
              repeating-linear-gradient(0deg, ${t.armorDark} 0 2px, ${t.armor} 2px 10px, ${t.armorDark} 10px 12px, ${t.armor} 12px 20px),
              linear-gradient(180deg, ${t.armorLight} 0%, ${t.armor} 50%, ${t.armorDark} 100%)
            `,
            backgroundBlendMode: 'multiply',
            border: `1.5px solid ${t.armorDark}`,
            borderRadius: '25% 25% 10% 10% / 15% 15% 5% 5%',
            boxShadow: `
              inset 2px 2px 3px rgba(255,255,255,0.2),
              inset -2px -2px 4px rgba(0,0,0,0.5),
              0 3px 5px rgba(0,0,0,0.6)
            `,
          }}
        >
          {/* 胸口徽章 / 护心镜（显示阵营字） */}
          <div
            className="absolute left-1/2 top-1/2 flex items-center justify-center font-kai font-black"
            style={{
              width: width * 0.38,
              height: width * 0.38,
              transform: 'translate(-50%, -55%)',
              background: `
                radial-gradient(circle at 35% 35%, ${t.metal} 0%, ${t.metalDark} 50%, ${t.armorDark} 100%)
              `,
              borderRadius: '50%',
              border: `1.5px solid ${t.armorDark}`,
              fontSize: width * 0.26,
              color: t.char,
              textShadow: `
                0 0 5px ${t.glow},
                -1px -1px 0 ${t.armorDark},
                1px -1px 0 ${t.armorDark},
                -1px 1px 0 ${t.armorDark},
                1px 1px 0 ${t.armorDark}
              `,
              boxShadow: `
                inset 1px 1px 2px rgba(255,255,255,0.4),
                inset -1px -1px 2px rgba(0,0,0,0.5),
                0 0 ${highlight ? '10px' : '4px'} ${t.glow}
              `,
            }}
          >
            {card.faction}
          </div>
        </div>

        {/* =========== 腰带（武将名） =========== */}
        <div
          className="absolute left-1/2"
          style={{
            bottom: 2,
            width: width * 0.75,
            height: width * 0.18,
            transform: 'translateX(-50%)',
            background: `linear-gradient(180deg, ${t.metal} 0%, ${t.armorDark} 100%)`,
            border: `1px solid ${t.armorDark}`,
            borderRadius: 3,
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.max(10, width * 0.14),
            color: t.armorDark,
            fontFamily: 'STKaiti, KaiTi, serif',
            fontWeight: 900,
            letterSpacing: '0.05em',
            textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {card.name}
        </div>
      </motion.div>

      {/* =========== 基座（梯形 3D，显示战力） =========== */}
      <div
        className="relative"
        style={{
          width: baseW,
          height: baseH,
        }}
      >
        {/* 基座顶面 */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: baseH * 0.45,
            background: `linear-gradient(180deg, ${t.armorLight} 0%, ${t.armor} 70%, ${t.armorDark} 100%)`,
            clipPath: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
            boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.5)',
            borderTop: `1px solid ${t.armorLight}`,
          }}
        />
        {/* 基座正面 —— 战力数字 */}
        <div
          className="absolute left-0 right-0 flex items-center justify-center"
          style={{
            top: baseH * 0.35,
            bottom: 0,
            background: `
              repeating-linear-gradient(90deg, rgba(0,0,0,0.2) 0 2px, transparent 2px 8px),
              linear-gradient(180deg, ${t.armorDark} 0%, ${t.armor} 40%, ${t.armorDark} 100%)
            `,
            borderTop: `2px solid ${t.armorEdge}`,
            borderBottom: '2px solid #000',
            borderLeft: '1px solid #000',
            borderRight: '1px solid #000',
            boxShadow: `inset 0 2px 4px rgba(0,0,0,0.6), 0 3px 6px rgba(0,0,0,0.8)`,
          }}
        >
          <div
            className="font-kai font-black tabular-nums"
            style={{
              fontSize: width * 0.3,
              color: t.armorEdge,
              textShadow: `
                0 0 6px ${t.glow},
                0 0 2px #000,
                1px 1px 0 #000
              `,
              letterSpacing: '0.02em',
            }}
          >
            {card.pointValue}
          </div>
        </div>
        {/* 地面投影 */}
        <div
          className="absolute left-[-15%] right-[-15%] pointer-events-none"
          style={{
            bottom: -10,
            height: 12,
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, transparent 70%)`,
            filter: 'blur(3px)',
          }}
        />
      </div>
    </motion.div>
  );
}

/** 空阵位 */
function EmptySlot({ width, index, isOver }: { width: number; index: number; isOver: boolean }) {
  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{
        width: width,
        height: width * 1.45 + width * 0.35,
      }}
    >
      <div
        className="relative rounded-full transition-all"
        style={{
          width: width * 0.95,
          height: width * 0.26,
          background: isOver
            ? `radial-gradient(ellipse at center, rgba(212,175,55,0.5) 0%, rgba(139,101,20,0.25) 60%, transparent 100%)`
            : `radial-gradient(ellipse at center, rgba(90,60,30,0.6) 0%, rgba(40,25,15,0.3) 60%, transparent 100%)`,
          border: `1px dashed ${isOver ? '#d4af37' : '#5a3a24'}`,
          boxShadow: isOver
            ? 'inset 0 0 14px rgba(212,175,55,0.5), 0 0 20px rgba(212,175,55,0.6)'
            : 'inset 0 2px 4px rgba(0,0,0,0.6)',
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center font-kai italic"
          style={{
            fontSize: width < 80 ? 10 : 13,
            color: isOver ? '#fde68a' : '#a8896b',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {isOver ? '降 · ' : '空 · '}{index + 1}
        </div>
      </div>
    </div>
  );
}

export function BattleField3D({ teamIndex, cards, evalResult, canRedraw: _canRedraw, onRedraw: _onRedraw }: Props) {
  const full = cards.every((c) => c !== null);
  const highlight = !!evalResult && (evalResult.rankType.score >= 6 || evalResult.isFlush);

  const rowRef = useRef<HTMLDivElement | null>(null);
  const [cardW, setCardW] = useState(MAX_W);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const recompute = () => {
      const avail = el.clientWidth;
      if (avail <= 0) return;
      const raw = (avail - GAP * (SLOTS - 1) - 24) / SLOTS;
      const clamped = Math.max(MIN_W, Math.min(MAX_W, Math.floor(raw)));
      setCardW(clamped);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      layout
      className={[
        'relative rounded-lg wood-panel bronze-border rivets min-w-0',
        'wood-dark',
      ].join(' ')}
      style={
        highlight
          ? {
              boxShadow:
                '0 0 24px rgba(212,175,55,0.5), 0 12px 24px rgba(0,0,0,0.9), inset 0 2px 3px rgba(255,200,120,0.25)',
            }
          : undefined
      }
    >
      <div className="rivet-b" />

      {/* 头部 */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap ink-underline">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-red-500 text-base">㊉</span>
          <div className="text-gold-grad font-black text-base sm:text-lg tracking-[0.25em] font-kai">
            {teamIndex === 0 ? '前軍' : '後軍'}
          </div>
          {full && evalResult ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <motion.span
                key={evalResult.rankType.key}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260 }}
                className={[
                  'px-3 py-1 rounded text-sm font-black border-2 font-kai tracking-widest',
                  highlight
                    ? 'border-gold text-[#2a1808]'
                    : 'border-amber-700 text-amber-50',
                ].join(' ')}
                style={{
                  background: highlight
                    ? 'linear-gradient(180deg, #fde68a 0%, #d4af37 50%, #8b6914 100%)'
                    : 'linear-gradient(180deg, #5a3a24 0%, #3a2418 100%)',
                  boxShadow: highlight
                    ? 'inset 0 1px 0 rgba(255,245,200,0.5), 0 2px 4px rgba(0,0,0,0.7)'
                    : 'inset 0 1px 0 rgba(255,200,120,0.3), 0 2px 4px rgba(0,0,0,0.6)',
                }}
              >
                {evalResult.rankType.name}
              </motion.span>
              {evalResult.isFlush && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-2 py-1 rounded text-sm font-black text-white border-2 border-red-300 font-kai tracking-widest"
                  style={{
                    background: 'linear-gradient(180deg, #c82828 0%, #7a1f1f 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,180,160,0.5), 0 2px 4px rgba(0,0,0,0.7)',
                  }}
                >
                  ◆ 同花
                </motion.span>
              )}
            </div>
          ) : (
            <span className="text-xs text-amber-100/50 italic">· 配陣中 ·</span>
          )}
        </div>

        <div className="text-right">
          <div className="text-[10px] text-amber-200/60 tracking-widest font-kai">軍團戰力</div>
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

      {/* 算法拆解 */}
      {full && evalResult && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 px-3 py-2 rounded-lg text-sm leading-tight"
          style={{
            background: 'linear-gradient(90deg, #1a0f08 0%, #2a1810 50%, #1a0f08 100%)',
            border: '2px solid #5a3a24',
            boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.6)',
          }}
        >
          <div className="flex items-center justify-center gap-2 font-kai font-black flex-wrap text-lg sm:text-xl">
            <span className="text-emerald-300 tabular-nums">{evalResult.pointSum}</span>
            <span className="text-amber-200/50 text-base">×</span>
            <span className="text-amber-200/50 text-base">(</span>
            <span className="text-emerald-300 tabular-nums">{evalResult.rankType.score}</span>
            <span className="text-amber-200/50 text-base">+</span>
            <span className={['tabular-nums', evalResult.isFlush ? 'text-gold-grad' : 'text-amber-200/40'].join(' ')}>
              {evalResult.suitBonus}
            </span>
            <span className="text-amber-200/50 text-base">)</span>
            <span className="text-amber-200/50 text-base">=</span>
            <span className={['tabular-nums', evalResult.capped ? 'text-red-400 line-through' : 'text-gold-grad'].join(' ')}>
              {evalResult.rawPower}
            </span>
            {evalResult.capped && (
              <>
                <span className="text-amber-200/50 text-base">→</span>
                <span className="text-red-400 tabular-nums">{POWER_CAP}</span>
                <span className="text-[10px] text-red-300 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-400/60 font-bold tracking-widest">
                  封頂
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}

      <Field3DStage
        ref={rowRef}
        cards={cards}
        cardW={cardW}
        teamIndex={teamIndex}
        highlight={highlight}
      />
    </motion.div>
  );
}

/** 3D 战场舞台 */
const Field3DStage = React.forwardRef<
  HTMLDivElement,
  {
    cards: (Card | null)[];
    cardW: number;
    teamIndex: number;
    highlight: boolean;
  }
>(({ cards, cardW, teamIndex, highlight }, ref) => {
  const fieldH = cardW * 1.45 + cardW * 0.35 + 55;

  return (
    <div
      ref={ref}
      className="relative w-full rounded-md"
      style={{
        height: fieldH,
        // 关键：不使用 overflow-hidden，避免拖拽时小兵超出容器被裁切
        // 用单独的 background 图层营造 3D 感，但前景元素不做 perspective
        background: `
          radial-gradient(ellipse at 50% 100%, rgba(212,175,55,0.1) 0%, transparent 70%),
          linear-gradient(180deg,
            #0a0502 0%,
            #1a0f08 30%,
            #2a1810 70%,
            #1a0f08 100%
          )
        `,
        boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.9), inset 0 -2px 6px rgba(120,80,40,0.25)',
        border: '2px solid #1a0f08',
      }}
    >
      {/* 远景天幕 */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none rounded-t-md"
        style={{
          height: '30%',
          background:
            'linear-gradient(180deg, rgba(100,70,30,0.2) 0%, rgba(40,25,15,0.08) 70%, transparent 100%)',
        }}
      />

      {/* 3D 倾斜地面 —— 独立层，与拖拽层不冲突 */}
      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-none overflow-hidden rounded-b-md"
        style={{ height: '75%' }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: 'rotateX(60deg)',
            transformOrigin: 'center bottom',
            background: `
              repeating-linear-gradient(
                90deg,
                rgba(0,0,0,0.35) 0 1px,
                transparent 1px 22px
              ),
              repeating-linear-gradient(
                0deg,
                rgba(0,0,0,0.4) 0 1px,
                transparent 1px 22px
              ),
              radial-gradient(ellipse at center 20%, #5a3a24 0%, #2a1810 50%, #0a0502 100%)
            `,
            boxShadow: 'inset 0 -20px 40px rgba(0,0,0,0.8)',
          }}
        />
      </div>

      {/* 中央聚光灯（高倍率时） */}
      {highlight && (
        <div
          className="absolute left-1/2 bottom-0 pointer-events-none"
          style={{
            width: '75%',
            height: '85%',
            transform: 'translateX(-50%)',
            background:
              'radial-gradient(ellipse at center 90%, rgba(212,175,55,0.4) 0%, transparent 60%)',
          }}
        />
      )}

      {/* 远景水平金线 */}
      <div
        className="absolute top-[30%] left-4 right-4 pointer-events-none"
        style={{
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, #8b6914 20%, #d4af37 50%, #8b6914 80%, transparent 100%)',
          opacity: 0.5,
        }}
      />

      {/* 兵阵（前景层，拖拽区） */}
      <div
        className="absolute left-0 right-0 flex justify-center items-end z-10"
        style={{
          bottom: 14,
          gap: GAP,
          padding: '0 12px',
        }}
      >
        {cards.map((c, si) => (
          <SlotDroppable
            key={si}
            teamIndex={teamIndex}
            slotIndex={si}
            card={c}
            width={cardW}
            highlight={highlight}
            index={si}
          />
        ))}
      </div>
    </div>
  );
});
Field3DStage.displayName = 'Field3DStage';

/** 单兵位 droppable */
function SlotDroppable({
  teamIndex,
  slotIndex,
  card,
  width,
  highlight,
  index,
}: {
  teamIndex: number;
  slotIndex: number;
  card: Card | null;
  width: number;
  highlight: boolean;
  index: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${teamIndex}-${slotIndex}`,
    data: { type: 'team', teamIndex, slotIndex },
  });

  return (
    <div
      ref={setNodeRef}
      className="relative flex flex-col items-center justify-end shrink-0"
    >
      <AnimatePresence mode="wait">
        {card ? (
          <Soldier
            key={card.id}
            card={card}
            width={width}
            index={index}
            highlight={highlight}
          />
        ) : (
          <EmptySlot key="empty" width={width} index={slotIndex} isOver={isOver} />
        )}
      </AnimatePresence>
    </div>
  );
}
