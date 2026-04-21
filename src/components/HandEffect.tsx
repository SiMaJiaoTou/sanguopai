import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RankTypeKey } from '../types';

/**
 * 牌型触发特效
 * 等级划分：
 *  - tier 1 (小)：ONE_PAIR, TWO_PAIR                          → 局部高光
 *  - tier 2 (中)：THREE_OF_A_KIND, STRAIGHT                   → 卡牌震动 + 光环
 *  - tier 3 (大)：FULL_HOUSE, FOUR_OF_A_KIND                  → 全屏光晕 + 墨迹波纹
 *  - tier 4 (超)：FIVE_OF_A_KIND                              → 全屏金光爆 + 书法大字
 *  - 特殊：同花触发叠加 +1 tier（如同花顺 = STRAIGHT+FLUSH = tier 3）
 */

export interface EffectTrigger {
  id: number;
  rankKey: RankTypeKey;
  rankName: string;
  isFlush: boolean;
  tier: number;
  poem: string;
}

interface Props {
  trigger: EffectTrigger | null;
  onDone: () => void;
}

const POEMS: Record<RankTypeKey, string> = {
  FIVE_OF_A_KIND: '五虎齐出 · 天下无双',
  FOUR_OF_A_KIND: '四将临阵 · 威震八方',
  FULL_HOUSE: '三带二将 · 阵型稳固',
  STRAIGHT: '连环兵阵 · 势如破竹',
  THREE_OF_A_KIND: '三英汇聚 · 气势初成',
  TWO_PAIR: '双壁辉映 · 进可得势',
  ONE_PAIR: '同袍之谊 · 初具锋芒',
  HIGH_CARD: '散兵列阵 · 徐徐图之',
};

export function computeTier(rankKey: RankTypeKey, isFlush: boolean): number {
  let base = 0;
  switch (rankKey) {
    case 'ONE_PAIR':
    case 'TWO_PAIR':
      base = 1;
      break;
    case 'THREE_OF_A_KIND':
    case 'STRAIGHT':
      base = 2;
      break;
    case 'FULL_HOUSE':
    case 'FOUR_OF_A_KIND':
      base = 3;
      break;
    case 'FIVE_OF_A_KIND':
      base = 4;
      break;
    default:
      base = 0;
  }
  // 同花加成：基础 ≥2 时 +1 (散牌/对子同花不加超级特效，避免噪扰)
  if (isFlush && base >= 1) base += 1;
  return Math.min(4, base);
}

export function buildEffect(
  rankKey: RankTypeKey,
  rankName: string,
  isFlush: boolean,
): EffectTrigger {
  const tier = computeTier(rankKey, isFlush);
  return {
    id: Date.now() + Math.random(),
    rankKey,
    rankName: isFlush ? `同花 · ${rankName}` : rankName,
    isFlush,
    tier,
    poem: POEMS[rankKey] ?? '',
  };
}

const TIER_CONFIG = [
  null,
  { duration: 900,  color: '#86efac', glyph: '·', charSize: 60,  particles: 6,  ringCount: 1 },
  { duration: 1100, color: '#60a5fa', glyph: '◈', charSize: 90,  particles: 12, ringCount: 2 },
  { duration: 1400, color: '#fbbf24', glyph: '✦', charSize: 130, particles: 24, ringCount: 3 },
  { duration: 2000, color: '#f97316', glyph: '龍', charSize: 200, particles: 48, ringCount: 4 },
];

export function HandEffect({ trigger, onDone }: Props) {
  const [shown, setShown] = useState<EffectTrigger | null>(null);

  useEffect(() => {
    if (!trigger) return;
    setShown(trigger);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pattern = [30, 20, 30, 20, trigger.tier * 40];
      navigator.vibrate?.(pattern.slice(0, 1 + trigger.tier));
    }
    const t = setTimeout(() => {
      setShown(null);
      onDone();
    }, TIER_CONFIG[trigger.tier]?.duration ?? 1000);
    return () => clearTimeout(t);
  }, [trigger, onDone]);

  if (!shown || shown.tier === 0) return null;
  const cfg = TIER_CONFIG[shown.tier]!;

  return (
    <AnimatePresence>
      <motion.div
        key={shown.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] pointer-events-none overflow-hidden flex items-center justify-center"
      >
        {/* 全屏径向光晕 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{
            opacity: [0, shown.tier >= 3 ? 0.9 : 0.5, 0],
            scale: [0.3, 1.6, 2.2],
          }}
          transition={{ duration: cfg.duration / 1000, ease: 'easeOut' }}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, ${cfg.color}55 0%, ${cfg.color}22 30%, transparent 60%)`,
          }}
        />

        {/* 墨迹涟漪环 */}
        {Array.from({ length: cfg.ringCount }).map((_, i) => (
          <motion.div
            key={`ring-${i}`}
            initial={{ opacity: 0.9, scale: 0 }}
            animate={{ opacity: 0, scale: 4 }}
            transition={{
              duration: cfg.duration / 1000,
              delay: i * 0.15,
              ease: 'easeOut',
            }}
            className="absolute rounded-full border-4"
            style={{
              width: 200,
              height: 200,
              borderColor: cfg.color,
              boxShadow: `0 0 40px ${cfg.color}`,
            }}
          />
        ))}

        {/* 粒子爆散 */}
        {Array.from({ length: cfg.particles }).map((_, i) => {
          const angle = (i / cfg.particles) * Math.PI * 2;
          const dist = 300 + Math.random() * 200;
          return (
            <motion.div
              key={`p-${i}`}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                opacity: 0,
                scale: 0,
                rotate: Math.random() * 720,
              }}
              transition={{
                duration: cfg.duration / 1000,
                ease: 'easeOut',
              }}
              className="absolute text-2xl"
              style={{ color: cfg.color, textShadow: `0 0 12px ${cfg.color}` }}
            >
              {cfg.glyph}
            </motion.div>
          );
        })}

        {/* 中心书法大字 */}
        <motion.div
          initial={{ scale: 4, opacity: 0, rotate: -15, y: -30 }}
          animate={{
            scale: [4, 1, 1, 1.1],
            opacity: [0, 1, 1, 0],
            rotate: [-15, -3, -3, -3],
            y: [-30, 0, 0, 10],
          }}
          transition={{
            duration: cfg.duration / 1000,
            times: [0, 0.25, 0.75, 1],
            ease: 'easeOut',
          }}
          className="relative flex flex-col items-center"
        >
          {/* 朱砂印 */}
          {shown.tier >= 3 && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: -8 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="seal-red px-3 py-2 text-sm tracking-widest mb-2"
              style={{ fontSize: 16 }}
            >
              {shown.isFlush ? '同花' : '成局'}
            </motion.div>
          )}

          {/* 主标题 */}
          <div
            className="text-calligraphy font-black leading-none"
            style={{
              fontSize: cfg.charSize,
              color: cfg.color,
              textShadow: `
                -2px -2px 0 #000,
                2px -2px 0 #000,
                -2px 2px 0 #000,
                2px 2px 0 #000,
                0 0 20px ${cfg.color},
                0 0 40px ${cfg.color}
              `,
            }}
          >
            {shown.rankName}
          </div>

          {/* 诗文 */}
          {shown.tier >= 2 && shown.poem && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-4 text-lg sm:text-2xl font-kai tracking-[0.3em]"
              style={{
                color: cfg.color,
                textShadow: `0 0 10px ${cfg.color}, 0 2px 4px rgba(0,0,0,0.8)`,
              }}
            >
              {shown.poem}
            </motion.div>
          )}
        </motion.div>

        {/* tier 4 特殊：金光条 */}
        {shown.tier >= 4 && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={`beam-${i}`}
                initial={{ opacity: 0, rotate: i * 45, scaleY: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scaleY: [0, 1, 1.2],
                }}
                transition={{
                  duration: cfg.duration / 1000,
                  delay: 0.1 + i * 0.04,
                }}
                className="absolute w-2 h-[120vh] origin-center pointer-events-none"
                style={{
                  background: `linear-gradient(180deg, transparent 0%, ${cfg.color} 50%, transparent 100%)`,
                  filter: `blur(2px)`,
                }}
              />
            ))}
          </>
        )}

        {/* 屏幕震动：用边缘红光闪烁模拟 */}
        {shown.tier >= 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 0 120px 30px ${cfg.color}`,
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
