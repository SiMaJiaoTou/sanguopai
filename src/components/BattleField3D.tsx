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
 * 阵营配色（水墨卷轴风 · 参考真实三国策略游戏）
 * 用于：武将徽章背景、小兵身上服色
 */
const FACTION_3D: Record<
  Faction,
  {
    badge: string;        // 武将徽章背景
    badgeDark: string;
    soldierMain: string;  // 小兵主色
    soldierDark: string;
    soldierLight: string;
    horse: string;        // 马匹色
    horseDark: string;
    flag: string;
    text: string;
  }
> = {
  魏: {
    badge: '#1e3a5f',
    badgeDark: '#0f1e33',
    soldierMain: '#1e3a8a',
    soldierDark: '#0c1e4a',
    soldierLight: '#3b82f6',
    horse: '#6b7280',
    horseDark: '#374151',
    flag: '#2563eb',
    text: '#dbeafe',
  },
  蜀: {
    badge: '#7a1f1f',
    badgeDark: '#3a0808',
    soldierMain: '#991b1b',
    soldierDark: '#450a0a',
    soldierLight: '#ef4444',
    horse: '#8b5a3c',
    horseDark: '#5a3a24',
    flag: '#dc2626',
    text: '#fee2e2',
  },
  吴: {
    badge: '#0f3826',
    badgeDark: '#04180f',
    soldierMain: '#065f46',
    soldierDark: '#022c22',
    soldierLight: '#10b981',
    horse: '#78716c',
    horseDark: '#44403c',
    flag: '#059669',
    text: '#d1fae5',
  },
  群: {
    badge: '#3d3a2a',
    badgeDark: '#1a1810',
    soldierMain: '#78350f',
    soldierDark: '#3a1a05',
    soldierLight: '#d97706',
    horse: '#a8896b',
    horseDark: '#78583f',
    flag: '#b45309',
    text: '#fef3c7',
  },
};

const SLOTS = 5;
const MIN_W = 90;
const MAX_W = 150;
const GAP = 10;

/**
 * SVG 梯形牌位 + 小兵方阵
 * 牌位形状类似参考图：金色描边的斜梯形（近大远小）
 */
function SlotTile({
  card,
  width,
  index,
  highlight,
  isOver,
}: {
  card: Card | null;
  width: number;
  index: number;
  highlight: boolean;
  isOver: boolean;
}) {
  // 梯形尺寸：近大远小 (近边宽 = 100%，远边宽 = 75%)
  const nearW = width * 0.98;
  const farW = width * 0.78;
  const tileH = width * 0.72;
  const svgH = tileH + width * 0.5; // 额外高度给小兵立绘
  const faction = card?.faction;
  const t = faction ? FACTION_3D[faction] : null;

  const empty = !card;

  return (
    <svg
      viewBox={`0 0 ${nearW} ${svgH}`}
      width={nearW}
      height={svgH}
      style={{
        overflow: 'visible',
        pointerEvents: 'none',
        filter: isOver
          ? 'drop-shadow(0 0 12px rgba(212,175,55,0.9))'
          : highlight && !empty
            ? 'drop-shadow(0 0 8px rgba(212,175,55,0.5))'
            : 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
      }}
    >
      <defs>
        <linearGradient id={`tile-bg-${index}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="rgba(245, 235, 210, 0.15)" />
          <stop offset="50%" stopColor="rgba(245, 235, 210, 0.25)" />
          <stop offset="100%" stopColor="rgba(245, 235, 210, 0.12)" />
        </linearGradient>
        <linearGradient id={`tile-border-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4af37" />
          <stop offset="50%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#8b6914" />
        </linearGradient>
        {t && (
          <>
            <radialGradient id={`soldier-grad-${index}`}>
              <stop offset="0%" stopColor={t.soldierLight} />
              <stop offset="70%" stopColor={t.soldierMain} />
              <stop offset="100%" stopColor={t.soldierDark} />
            </radialGradient>
            <linearGradient id={`flag-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={t.flag} />
              <stop offset="100%" stopColor={t.soldierDark} />
            </linearGradient>
          </>
        )}
      </defs>

      {/* === 梯形牌位 === */}
      <g transform={`translate(0, ${width * 0.35})`}>
        {/* 牌位底（梯形） */}
        <polygon
          points={`
            ${(nearW - farW) / 2},0
            ${(nearW + farW) / 2},0
            ${nearW},${tileH}
            0,${tileH}
          `}
          fill={`url(#tile-bg-${index})`}
          stroke={`url(#tile-border-${index})`}
          strokeWidth={isOver ? 3 : 2}
          opacity={isOver ? 1 : empty ? 0.65 : 0.8}
        />
        {/* 内描线（二重金边） */}
        <polygon
          points={`
            ${(nearW - farW) / 2 + 5},5
            ${(nearW + farW) / 2 - 5},5
            ${nearW - 5},${tileH - 5}
            5,${tileH - 5}
          `}
          fill="none"
          stroke="#d4af37"
          strokeWidth={0.8}
          opacity={0.5}
        />

        {empty && (
          <text
            x={nearW / 2}
            y={tileH / 2 + 5}
            textAnchor="middle"
            fontSize={width * 0.12}
            fill={isOver ? '#fde68a' : '#8b6914'}
            fontFamily="STKaiti, KaiTi, serif"
            fontWeight="900"
            opacity={isOver ? 1 : 0.6}
            fontStyle="italic"
          >
            {isOver ? `降 · ${index + 1}` : `空位 ${index + 1}`}
          </text>
        )}
      </g>

      {/* === 小兵方阵（只有已上阵时显示） === */}
      {card && t && (
        <SoldierArmy
          t={t}
          index={index}
          tileNearW={nearW}
          tileFarW={farW}
          tileH={tileH}
          baseY={width * 0.35}
          unitSize={width * 0.18}
        />
      )}

      {/* === 武将徽章（圆头像） === */}
      {card && t && (
        <CommanderBadge
          card={card}
          t={t}
          cx={width * 0.18}
          cy={width * 0.25}
          r={width * 0.2}
        />
      )}

      {/* === 战斗力数字（右下） === */}
      {card && (
        <g>
          <rect
            x={nearW - width * 0.3}
            y={svgH - width * 0.22}
            width={width * 0.28}
            height={width * 0.18}
            rx={3}
            fill="rgba(0,0,0,0.75)"
            stroke="#d4af37"
            strokeWidth={1.5}
          />
          <text
            x={nearW - width * 0.16}
            y={svgH - width * 0.08}
            textAnchor="middle"
            fontSize={width * 0.14}
            fill="#fde68a"
            fontFamily="STKaiti, KaiTi, serif"
            fontWeight="900"
            style={{
              filter: 'drop-shadow(0 0 3px rgba(212,175,55,0.8))',
            }}
          >
            {card.pointValue}
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * 武将徽章 —— 圆形头像徽标
 * 参考图里左上角小圆章 + 盾牌 + 名字横幅
 */
function CommanderBadge({
  card,
  t,
  cx,
  cy,
  r,
}: {
  card: Card;
  t: (typeof FACTION_3D)[Faction];
  cx: number;
  cy: number;
  r: number;
}) {
  return (
    <g>
      {/* 外圈（金边） */}
      <circle cx={cx} cy={cy} r={r} fill={t.badgeDark} stroke="#d4af37" strokeWidth={2} />
      {/* 内圈（阵营色渐变） */}
      <circle cx={cx} cy={cy} r={r - 3} fill={t.badge} />
      {/* 简化人像：头 + 肩 */}
      <ellipse cx={cx} cy={cy - r * 0.25} rx={r * 0.28} ry={r * 0.3} fill="#d4a574" />
      <path
        d={`
          M ${cx - r * 0.55} ${cy + r * 0.5}
          Q ${cx} ${cy + r * 0.05} ${cx + r * 0.55} ${cy + r * 0.5}
          L ${cx + r * 0.6} ${cy + r * 0.8}
          L ${cx - r * 0.6} ${cy + r * 0.8}
          Z
        `}
        fill={t.soldierMain}
        stroke={t.soldierDark}
        strokeWidth={0.8}
      />
      {/* 帽子 */}
      <path
        d={`
          M ${cx - r * 0.38} ${cy - r * 0.45}
          Q ${cx} ${cy - r * 0.75} ${cx + r * 0.38} ${cy - r * 0.45}
          L ${cx + r * 0.3} ${cy - r * 0.35}
          L ${cx - r * 0.3} ${cy - r * 0.35}
          Z
        `}
        fill={t.soldierDark}
      />

      {/* 下方阵营盾牌横幅 */}
      <g transform={`translate(${cx - r * 0.5}, ${cy + r * 1.05})`}>
        <path
          d={`
            M 0 0 L ${r * 1.8} 0
            L ${r * 1.95} ${r * 0.3}
            L ${r * 1.65} ${r * 0.5}
            L ${r * 0.15} ${r * 0.5}
            L 0 ${r * 0.3}
            Z
          `}
          fill={t.badge}
          stroke="#d4af37"
          strokeWidth={1}
        />
        {/* 盾形小徽章 */}
        <path
          d={`
            M ${r * 0.15} ${r * 0.08}
            L ${r * 0.45} ${r * 0.08}
            L ${r * 0.45} ${r * 0.32}
            Q ${r * 0.3} ${r * 0.45} ${r * 0.15} ${r * 0.32}
            Z
          `}
          fill={t.soldierLight}
          stroke="#d4af37"
          strokeWidth={0.5}
        />
        <text
          x={r * 0.3}
          y={r * 0.27}
          textAnchor="middle"
          fontSize={r * 0.3}
          fill="#fff"
          fontFamily="STKaiti, KaiTi, serif"
          fontWeight="900"
        >
          {card.faction}
        </text>
      </g>
    </g>
  );
}

/**
 * 小兵方阵（在牌位上站一排排小兵立绘）
 * 参考图：前排 3 个骑兵 + 后排 3 个骑兵 = 6 人方阵
 */
function SoldierArmy({
  t,
  index,
  tileNearW,
  tileFarW,
  tileH,
  baseY,
  unitSize,
}: {
  t: (typeof FACTION_3D)[Faction];
  index: number;
  tileNearW: number;
  tileFarW: number;
  tileH: number;
  baseY: number;
  unitSize: number;
}) {
  // 2 排 × 3 列 = 6 只小兵
  const rows = 2;
  const cols = 3;
  const soldiers: { x: number; y: number; delay: number }[] = [];

  for (let r = 0; r < rows; r++) {
    // 远排(r=0)：窄，居上
    // 近排(r=1)：宽，居下
    const rowProgress = r / (rows - 1); // 0 = far, 1 = near
    const rowW = tileFarW + (tileNearW - tileFarW) * rowProgress;
    const rowY = baseY + tileH * (0.15 + rowProgress * 0.55);
    const xStart = (tileNearW - rowW) / 2;

    for (let c = 0; c < cols; c++) {
      const colProgress = c / (cols - 1); // 0 = left, 1 = right
      const x = xStart + rowW * (0.18 + colProgress * 0.64);
      soldiers.push({
        x,
        y: rowY,
        delay: (r * cols + c) * 0.05,
      });
    }
  }

  return (
    <g>
      {soldiers.map((s, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: s.y + 15 }}
          animate={{ opacity: 1, y: s.y }}
          transition={{ delay: index * 0.08 + s.delay, duration: 0.3 }}
        >
          <MiniSoldier
            cx={s.x}
            cy={s.y}
            size={unitSize}
            t={t}
            index={i + index * 10}
          />
        </motion.g>
      ))}
    </g>
  );
}

/**
 * 单个小兵立绘（SVG，骑兵简化版）
 */
function MiniSoldier({
  cx,
  cy,
  size,
  t,
  index,
}: {
  cx: number;
  cy: number;
  size: number;
  t: (typeof FACTION_3D)[Faction];
  index: number;
}) {
  // 马身
  const horseW = size * 1.2;
  const horseH = size * 0.55;

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* 影子 */}
      <ellipse
        cx={0}
        cy={size * 0.35}
        rx={size * 0.55}
        ry={size * 0.1}
        fill="rgba(0,0,0,0.4)"
      />

      {/* 马身（椭圆） */}
      <ellipse
        cx={0}
        cy={size * 0.05}
        rx={horseW / 2}
        ry={horseH / 2}
        fill={t.horse}
        stroke={t.horseDark}
        strokeWidth={0.6}
      />
      {/* 马腿（4 条） */}
      {[-0.35, -0.15, 0.15, 0.35].map((dx, i) => (
        <rect
          key={i}
          x={dx * size - 1}
          y={size * 0.2}
          width={1.8}
          height={size * 0.25}
          fill={t.horseDark}
          rx={0.5}
        />
      ))}
      {/* 马头 */}
      <ellipse
        cx={size * 0.5}
        cy={-size * 0.05}
        rx={size * 0.13}
        ry={size * 0.18}
        fill={t.horse}
        stroke={t.horseDark}
        strokeWidth={0.5}
      />
      {/* 马脖子 */}
      <path
        d={`
          M ${size * 0.3} ${-size * 0.1}
          L ${size * 0.45} ${-size * 0.22}
          L ${size * 0.5} ${-size * 0.05}
          L ${size * 0.35} ${size * 0.05}
          Z
        `}
        fill={t.horse}
        stroke={t.horseDark}
        strokeWidth={0.5}
      />
      {/* 马尾 */}
      <path
        d={`
          M ${-size * 0.55} ${size * 0.05}
          L ${-size * 0.7} ${-size * 0.05}
          L ${-size * 0.68} ${size * 0.15}
          Z
        `}
        fill={t.horseDark}
      />

      {/* 骑手（简化）—— 身体 */}
      <ellipse
        cx={size * 0.05}
        cy={-size * 0.25}
        rx={size * 0.2}
        ry={size * 0.3}
        fill={t.soldierMain}
        stroke={t.soldierDark}
        strokeWidth={0.6}
      />
      {/* 骑手头 */}
      <circle cx={size * 0.05} cy={-size * 0.5} r={size * 0.12} fill="#d4a574" />
      {/* 骑手头盔 */}
      <path
        d={`
          M ${size * 0.05 - size * 0.13} ${-size * 0.52}
          Q ${size * 0.05} ${-size * 0.68} ${size * 0.05 + size * 0.13} ${-size * 0.52}
          Z
        `}
        fill={t.soldierDark}
      />
      {/* 长矛/旗杆（斜） */}
      <line
        x1={size * 0.2}
        y1={-size * 0.55}
        x2={size * 0.45}
        y2={-size * 0.95}
        stroke={t.soldierDark}
        strokeWidth={1.5}
      />
      {/* 小旗帜 */}
      <motion.rect
        x={size * 0.38}
        y={-size * 1.0}
        width={size * 0.22}
        height={size * 0.15}
        fill={`url(#flag-grad-${Math.floor(index / 10)})`}
        stroke={t.soldierDark}
        strokeWidth={0.5}
        animate={{ scaleX: [1, 0.9, 1] }}
        transition={{
          duration: 1.8 + (index % 5) * 0.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ transformOrigin: `${size * 0.38}px 0` }}
      />
    </g>
  );
}

/** 整个战场 3D 组件 */
export function BattleField3D({
  teamIndex,
  cards,
  evalResult,
  canRedraw: _canRedraw,
  onRedraw: _onRedraw,
}: Props) {
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

/** 战场舞台（水墨地图底） */
const Field3DStage = React.forwardRef<
  HTMLDivElement,
  {
    cards: (Card | null)[];
    cardW: number;
    teamIndex: number;
    highlight: boolean;
  }
>(({ cards, cardW, teamIndex, highlight }, ref) => {
  const stageH = cardW * 1.3;

  return (
    <div
      ref={ref}
      className="relative w-full rounded-md"
      style={{
        height: stageH,
        // 水墨地图底（参考图的雪地山脉水墨风）
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(180, 150, 110, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 60%, rgba(120, 100, 80, 0.2) 0%, transparent 50%),
          linear-gradient(180deg,
            #c8b896 0%,
            #b8a680 20%,
            #a89670 45%,
            #988660 70%,
            #786650 100%
          )
        `,
        boxShadow: 'inset 0 4px 12px rgba(60,40,20,0.5), inset 0 -4px 8px rgba(60,40,20,0.4)',
        border: '2px solid #3a2418',
      }}
    >
      {/* 水墨河流/云纹背景纹理 */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 60 Q 100 40 200 80 T 400 70"
          fill="none"
          stroke="#6b5a45"
          strokeWidth="1"
          opacity="0.5"
        />
        <path
          d="M 0 120 Q 120 100 240 140 T 400 130"
          fill="none"
          stroke="#5a4a35"
          strokeWidth="1"
          opacity="0.4"
        />
        <path
          d="M 0 160 Q 80 150 160 170 T 400 165"
          fill="none"
          stroke="#6b5a45"
          strokeWidth="0.8"
          opacity="0.3"
        />
        {/* 远山轮廓 */}
        <path
          d="M 20 30 L 40 10 L 60 25 L 80 8 L 100 28 L 120 15 L 140 32 L 160 20 L 180 30 Z"
          fill="#6b5a45"
          opacity="0.2"
        />
        <path
          d="M 220 35 L 240 12 L 260 30 L 280 18 L 300 32 L 320 20 L 340 35 L 360 22 L 380 38 Z"
          fill="#5a4a35"
          opacity="0.25"
        />
      </svg>

      {/* 中央聚光（高倍率时） */}
      {highlight && (
        <div
          className="absolute left-1/2 bottom-0 pointer-events-none"
          style={{
            width: '75%',
            height: '85%',
            transform: 'translateX(-50%)',
            background:
              'radial-gradient(ellipse at center, rgba(212,175,55,0.25) 0%, transparent 60%)',
          }}
        />
      )}

      {/* 5 个牌位排列 */}
      <div
        className="absolute left-0 right-0 flex justify-center items-center h-full px-3"
        style={{ gap: GAP }}
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

/** 单兵位 droppable + draggable 结合 */
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
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `team-${teamIndex}-${slotIndex}`,
    data: { type: 'team', teamIndex, slotIndex },
  });

  return (
    <div
      ref={setDropRef}
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: width * 0.98 }}
    >
      <AnimatePresence mode="wait">
        {card ? (
          <DraggableTile
            key={card.id}
            card={card}
            width={width}
            highlight={highlight}
            index={index}
            isOver={false}
          />
        ) : (
          <div key="empty" className="pointer-events-none">
            <SlotTile
              card={null}
              width={width}
              index={index}
              highlight={false}
              isOver={isOver}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 已上阵的牌位（整体可拖拽） */
function DraggableTile({
  card,
  width,
  highlight,
  index,
  isOver,
}: {
  card: Card;
  width: number;
  highlight: boolean;
  index: number;
  isOver: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  const dragStyle: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.08 : 1})`,
        zIndex: isDragging ? 50 : 'auto',
      }
    : {};

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ y: 30, opacity: 0, scale: 0.6 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -20, opacity: 0, scale: 0.5 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        ...dragStyle,
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.9 : 1,
      }}
      className="relative select-none"
      {...listeners}
      {...attributes}
    >
      <SlotTile
        card={card}
        width={width}
        index={index}
        highlight={highlight}
        isOver={isOver}
      />
    </motion.div>
  );
}
