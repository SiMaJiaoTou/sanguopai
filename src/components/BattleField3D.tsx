import React, { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
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
 * 阵营配色 (3D 小兵专用)
 * 包含主体色、高光、阴影、旗面、饰带
 */
const FACTION_3D: Record<
  Faction,
  {
    primary: string;    // 基座主色
    primaryDark: string;
    primaryLight: string;
    flag: string;       // 旗帜主色
    flagDark: string;
    flagEdge: string;   // 旗帜描边
    text: string;
    glow: string;       // 发光色
    char: string;       // 书法字颜色
  }
> = {
  魏: {
    primary: '#1e3a5f',
    primaryDark: '#0f1e33',
    primaryLight: '#3a6ba3',
    flag: '#1e40af',
    flagDark: '#0a1f4d',
    flagEdge: '#60a5fa',
    text: '#dbeafe',
    glow: 'rgba(59, 130, 246, 0.6)',
    char: '#bfdbfe',
  },
  蜀: {
    primary: '#5a1818',
    primaryDark: '#2a0808',
    primaryLight: '#a83838',
    flag: '#991b1b',
    flagDark: '#450a0a',
    flagEdge: '#fb7185',
    text: '#fee2e2',
    glow: 'rgba(239, 68, 68, 0.6)',
    char: '#fecaca',
  },
  吴: {
    primary: '#0f3826',
    primaryDark: '#04180f',
    primaryLight: '#2d6b4e',
    flag: '#065f46',
    flagDark: '#022c22',
    flagEdge: '#34d399',
    text: '#d1fae5',
    glow: 'rgba(16, 185, 129, 0.6)',
    char: '#a7f3d0',
  },
  群: {
    primary: '#3d3a2a',
    primaryDark: '#1a1810',
    primaryLight: '#6b6448',
    flag: '#78350f',
    flagDark: '#3a1a05',
    flagEdge: '#fbbf24',
    text: '#fef3c7',
    glow: 'rgba(251, 191, 36, 0.6)',
    char: '#fde68a',
  },
};

const SLOTS = 5;
const MIN_W = 60;
const MAX_W = 110;
const GAP = 12;

/** 单兵 3D 模型 —— 梯形底座 + 立起旗牌 */
function Soldier({
  card,
  width,
  index,
  highlight,
  onDoubleClick,
}: {
  card: Card;
  width: number;
  index: number;
  highlight: boolean;
  onDoubleClick?: () => void;
}) {
  const t = FACTION_3D[card.faction];
  const flagW = width * 0.85;
  const flagH = width * 1.15;
  const baseW = width;
  const baseH = width * 0.38;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0, rotateX: 90 }}
      animate={{ y: 0, opacity: 1, rotateX: 0 }}
      exit={{ y: -30, opacity: 0, scale: 0.7 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: index * 0.05,
      }}
      onDoubleClick={onDoubleClick}
      style={{
        width: baseW,
        height: flagH + baseH + 8,
        transformStyle: 'preserve-3d',
      }}
      className="relative flex flex-col items-center justify-end select-none"
    >
      {/* 飘动旗帜动画 */}
      <motion.div
        animate={{
          rotateY: [-3, 3, -3],
          rotateZ: [-0.5, 0.5, -0.5],
        }}
        transition={{
          duration: 3 + index * 0.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          width: flagW,
          height: flagH,
          transformStyle: 'preserve-3d',
          transformOrigin: 'bottom center',
        }}
        className="relative"
      >
        {/* 旗杆 */}
        <div
          className="absolute left-1/2 top-0 bottom-0"
          style={{
            width: 3,
            transform: 'translateX(-50%) translateZ(1px)',
            background:
              'linear-gradient(180deg, #8b6914 0%, #d4af37 30%, #5a3810 100%)',
            boxShadow: '0 0 3px rgba(0,0,0,0.6), inset -1px 0 0 rgba(0,0,0,0.4)',
          }}
        />
        {/* 旗杆顶饰 */}
        <div
          className="absolute left-1/2"
          style={{
            top: -6,
            width: 8,
            height: 8,
            borderRadius: '50%',
            transform: 'translateX(-50%) translateZ(2px)',
            background:
              'radial-gradient(circle at 30% 30%, #fde68a 0%, #d4af37 50%, #5a3810 100%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        />

        {/* 旗面 */}
        <div
          className="absolute rounded-sm"
          style={{
            top: 3,
            left: '15%',
            right: 0,
            bottom: 4,
            background: `
              linear-gradient(180deg, ${t.primaryLight} 0%, ${t.flag} 40%, ${t.flagDark} 100%),
              repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 4px)
            `,
            backgroundBlendMode: 'multiply',
            border: `2px solid ${t.flagDark}`,
            boxShadow: highlight
              ? `inset 0 2px 3px rgba(255,255,255,0.3), inset 0 -3px 5px rgba(0,0,0,0.5), 0 0 12px ${t.glow}, 3px 3px 6px rgba(0,0,0,0.7)`
              : `inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -3px 5px rgba(0,0,0,0.5), 3px 3px 6px rgba(0,0,0,0.7)`,
            transform: 'translateZ(2px)',
          }}
        >
          {/* 旗面金边装饰 */}
          <div
            className="absolute inset-1 rounded-sm pointer-events-none"
            style={{
              border: `1px solid ${t.flagEdge}66`,
              boxShadow: `inset 0 0 4px ${t.glow}`,
            }}
          />
          {/* 阵营汉字 (大) */}
          <div
            className="absolute top-1 left-0 right-0 text-center font-kai font-black"
            style={{
              fontSize: width * 0.32,
              color: t.char,
              textShadow: `
                0 0 4px ${t.glow},
                -1px -1px 0 ${t.flagDark},
                1px -1px 0 ${t.flagDark},
                -1px 1px 0 ${t.flagDark},
                1px 1px 0 ${t.flagDark}
              `,
              lineHeight: 1,
            }}
          >
            {card.faction}
          </div>
          {/* 点数 */}
          <div
            className="absolute top-1/3 left-0 right-0 text-center font-kai font-black"
            style={{
              fontSize: width * 0.22,
              color: t.flagEdge,
              textShadow: `
                0 0 6px ${t.glow},
                1px 1px 0 ${t.flagDark},
                -1px -1px 0 ${t.flagDark}
              `,
              lineHeight: 1,
            }}
          >
            {card.pointLabel}
          </div>
          {/* 武将名 (书法小字) */}
          <div
            className="absolute bottom-1 left-0 right-0 text-center font-kai"
            style={{
              fontSize: Math.max(9, width * 0.14),
              color: t.text,
              fontWeight: 900,
              textShadow: `0 1px 2px ${t.flagDark}, 0 0 3px rgba(0,0,0,0.8)`,
              lineHeight: 1.1,
              padding: '0 2px',
              wordBreak: 'keep-all',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {card.name}
          </div>
        </div>
      </motion.div>

      {/* 基座（梯形 3D） */}
      <div
        className="relative"
        style={{
          width: baseW,
          height: baseH,
          transform: 'translateZ(0)',
        }}
      >
        {/* 基座顶面 */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: baseH * 0.55,
            background: `linear-gradient(180deg, ${t.primaryLight} 0%, ${t.primary} 70%, ${t.primaryDark} 100%)`,
            clipPath: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
            boxShadow: `inset 0 2px 2px rgba(255,255,255,0.25), inset 0 -2px 4px rgba(0,0,0,0.5)`,
            borderTop: `1px solid ${t.primaryLight}`,
          }}
        />
        {/* 基座正面（数字显示区） */}
        <div
          className="absolute left-0 right-0 flex items-center justify-center"
          style={{
            top: baseH * 0.45,
            bottom: 0,
            background: `linear-gradient(180deg, ${t.primaryDark} 0%, ${t.primary} 40%, ${t.primaryDark} 100%)`,
            borderTop: `1px solid ${t.flagEdge}55`,
            borderBottom: `2px solid #000`,
            boxShadow: `inset 0 2px 4px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.8)`,
          }}
        >
          {/* 战斗力数字 */}
          <div
            className="font-kai font-black tabular-nums"
            style={{
              fontSize: width * 0.28,
              color: t.flagEdge,
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
          className="absolute left-[-10%] right-[-10%]"
          style={{
            bottom: -6,
            height: 8,
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, transparent 70%)`,
            filter: 'blur(2px)',
          }}
        />
      </div>
    </motion.div>
  );
}

/** 空阵位 —— 草席/夯土地面 */
function EmptySlot({
  width,
  index,
  isOver,
}: {
  width: number;
  index: number;
  isOver: boolean;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{
        width: width,
        height: width * 1.53 + width * 0.38 + 8,
      }}
    >
      {/* 阵位地面 */}
      <div
        className="relative rounded-full transition-all"
        style={{
          width: width * 0.95,
          height: width * 0.28,
          background: isOver
            ? `radial-gradient(ellipse at center, rgba(212,175,55,0.4) 0%, rgba(139,101,20,0.2) 60%, transparent 100%)`
            : `radial-gradient(ellipse at center, rgba(90,60,30,0.6) 0%, rgba(40,25,15,0.3) 60%, transparent 100%)`,
          border: `1px dashed ${isOver ? '#d4af37' : '#5a3a24'}`,
          boxShadow: isOver
            ? 'inset 0 0 12px rgba(212,175,55,0.4), 0 0 16px rgba(212,175,55,0.5)'
            : 'inset 0 1px 3px rgba(0,0,0,0.6)',
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
          {isOver ? '降 · ' : '空'} {index + 1}
        </div>
      </div>
    </div>
  );
}

export function BattleField3D({ teamIndex, cards, evalResult, canRedraw, onRedraw }: Props) {
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
        highlight ? 'wood-dark' : 'wood-dark',
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

      {/* 头部：军名 + 牌型 + 战力 */}
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

      {/* 3D 战场 */}
      <Field3DStage
        ref={rowRef}
        cards={cards}
        cardW={cardW}
        teamIndex={teamIndex}
        canRedraw={canRedraw}
        onRedraw={onRedraw}
        highlight={highlight}
      />
    </motion.div>
  );
}

/** 3D 战场舞台 —— 核心 perspective 容器 */
const Field3DStage = React.forwardRef<
  HTMLDivElement,
  {
    cards: (Card | null)[];
    cardW: number;
    teamIndex: number;
    canRedraw: boolean;
    onRedraw: (id: string) => void;
    highlight: boolean;
  }
>(({ cards, cardW, teamIndex, canRedraw, onRedraw, highlight }, ref) => {
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-md"
      style={{
        perspective: '800px',
        perspectiveOrigin: '50% 30%',
        height: cardW * 1.53 + cardW * 0.38 + 50,
        background: `
          radial-gradient(ellipse at 50% 100%, rgba(212,175,55,0.08) 0%, transparent 70%),
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
      {/* 远景：天空/远山（水平光晕） */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '35%',
          background:
            'linear-gradient(180deg, rgba(100,70,30,0.15) 0%, rgba(40,25,15,0.05) 70%, transparent 100%)',
        }}
      />

      {/* 3D 地面 (倾斜的 plane) */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          height: '70%',
          transform: 'rotateX(58deg) translateZ(0)',
          transformOrigin: 'center bottom',
          background: `
            repeating-linear-gradient(
              90deg,
              rgba(0,0,0,0.35) 0 1px,
              transparent 1px 20px
            ),
            repeating-linear-gradient(
              0deg,
              rgba(0,0,0,0.35) 0 1px,
              transparent 1px 20px
            ),
            radial-gradient(ellipse at center 20%, #5a3a24 0%, #2a1810 50%, #0a0502 100%)
          `,
          boxShadow: 'inset 0 -20px 40px rgba(0,0,0,0.7)',
        }}
      />

      {/* 地面高亮 (中央聚光) */}
      {highlight && (
        <div
          className="absolute left-1/2 bottom-0 pointer-events-none"
          style={{
            width: '70%',
            height: '80%',
            transform: 'translateX(-50%)',
            background: 'radial-gradient(ellipse at center 90%, rgba(212,175,55,0.35) 0%, transparent 60%)',
          }}
        />
      )}

      {/* 兵马阵列 */}
      <div
        className="absolute left-0 right-0 flex justify-center items-end"
        style={{
          bottom: 16,
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
            canRedraw={canRedraw}
            onRedraw={onRedraw}
            highlight={highlight}
            index={si}
          />
        ))}
      </div>

      {/* 军旗水平装饰线 */}
      <div
        className="absolute top-0 left-4 right-4 pointer-events-none"
        style={{
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, #8b6914 20%, #d4af37 50%, #8b6914 80%, transparent 100%)',
          opacity: 0.6,
        }}
      />
    </div>
  );
});
Field3DStage.displayName = 'Field3DStage';

/** 单个兵位（含 droppable 逻辑） */
function SlotDroppable({
  teamIndex,
  slotIndex,
  card,
  width,
  canRedraw,
  onRedraw,
  highlight,
  index,
}: {
  teamIndex: number;
  slotIndex: number;
  card: Card | null;
  width: number;
  canRedraw: boolean;
  onRedraw: (id: string) => void;
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
      className="relative flex flex-col items-center justify-end"
      style={{
        flexShrink: 0,
      }}
    >
      <AnimatePresence mode="wait">
        {card ? (
          <Soldier
            key={card.id}
            card={card}
            width={width}
            index={index}
            highlight={highlight}
            onDoubleClick={canRedraw ? () => onRedraw(card.id) : undefined}
          />
        ) : (
          <EmptySlot key="empty" width={width} index={slotIndex} isOver={isOver} />
        )}
      </AnimatePresence>
    </div>
  );
}
