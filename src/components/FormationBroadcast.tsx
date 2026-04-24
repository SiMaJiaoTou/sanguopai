import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EvaluateResult } from '../types';
import { FORMATIONS, FLUSH_BROADCAST } from '../formations';

interface Props {
  /** 所有军团的评估结果（索引即 teamIndex） */
  teamEvals: (EvaluateResult | null)[];
}

/** 总展示时长（ms）：入场动画全部完成后立刻开始上飘退出 */
const BANNER_DURATION = 520;

export function FormationBroadcast({ teamEvals }: Props) {
  const [banner, setBanner] = useState<{
    id: number;
    teamIndex: number;
    formation: (typeof FORMATIONS)[keyof typeof FORMATIONS];
    isFlush: boolean;
    power: number;
  } | null>(null);

  // 每队上一次已经播过的阵法签名（`${rankKey}|${isFlush}`）
  const lastSigs = useRef<(string | null)[]>([]);

  useEffect(() => {
    for (let i = 0; i < teamEvals.length; i++) {
      const ev = teamEvals[i];
      // 散阵（HIGH_CARD）tier 太低，既不触发特效也不播报 banner，避免刷屏
      const shouldBroadcast = ev && ev.rankType.key !== 'HIGH_CARD';
      const sig = shouldBroadcast ? `${ev!.rankType.key}|${ev!.isFlush}` : null;
      const prev = lastSigs.current[i] ?? null;
      if (sig !== prev) {
        lastSigs.current[i] = sig;
        if (sig && ev) {
          const formation = FORMATIONS[ev.rankType.key];
          setBanner({
            id: Date.now() + Math.random(),
            teamIndex: i,
            formation,
            isFlush: ev.isFlush,
            power: ev.power,
          });
        }
      }
    }
  }, [teamEvals]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), BANNER_DURATION);
    return () => clearTimeout(t);
  }, [banner?.id]);

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          // 弹入：快速放大+下落（y 从 -20 到 0）
          // 退出：向上飘出屏幕 + 淡出
          initial={{ opacity: 0, y: -30, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -220, scale: 0.92 }}
          transition={{
            opacity: { duration: 0.2 },
            y: { duration: 0.55, ease: [0.4, 0, 0.2, 1] },
            scale: { duration: 0.22, ease: [0.2, 1.2, 0.3, 1] },
          }}
          className="fixed inset-x-0 top-[22%] z-40 pointer-events-none"
        >
          <div className="relative proclaim-band py-5 sm:py-6 overflow-hidden">
            <EmberLayer />

            {/* 左右悬挂印章 */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
              className="absolute left-4 sm:left-10 top-1/2 seal-red w-12 h-12 text-base flex items-center justify-center font-kai z-10"
              style={{
                letterSpacing: 0,
                transform: 'translateY(-50%) rotate(-8deg)',
              }}
            >
              {banner.teamIndex === 0 ? '前' : '后'}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
              className="absolute right-4 sm:right-10 top-1/2 seal-red w-12 h-12 text-base flex items-center justify-center font-kai z-10"
              style={{
                letterSpacing: 0,
                transform: 'translateY(-50%) rotate(8deg)',
              }}
            >
              檄
            </motion.div>

            {/* 中央内容 */}
            <div className="relative mx-auto max-w-[720px] px-20 sm:px-24 text-center">
              {/* 阵法大名 */}
              <motion.div
                initial={{ opacity: 0, letterSpacing: '0.8em' }}
                animate={{ opacity: 1, letterSpacing: '0.45em' }}
                transition={{ duration: 0.22, delay: 0.05 }}
                className="text-3xl sm:text-4xl font-black font-kai leading-none"
                style={{
                  background:
                    'linear-gradient(180deg, #fff5cc 0%, #f7d57a 30%, #d4af37 55%, #6b4a10 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter:
                    'drop-shadow(0 0 12px rgba(212,175,55,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
                }}
              >
                {banner.formation.name}
              </motion.div>

              {/* 金线分隔 */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.25, delay: 0.1 }}
                className="mx-auto my-2 h-[1px] w-40"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(212,175,55,0.85), rgba(255,245,200,0.95), rgba(212,175,55,0.85), transparent)',
                  boxShadow: '0 0 8px rgba(212,175,55,0.55)',
                  transformOrigin: 'center',
                }}
              />

              {/* 播报文案 —— 整段一次性淡入，无打字效果 */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.12 }}
                className="text-center text-amber-100 text-sm sm:text-base font-kai tracking-[0.15em] leading-relaxed"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
              >
                {banner.formation.broadcast}
              </motion.div>
              {banner.isFlush && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.2 }}
                  className="text-center text-red-200 text-sm sm:text-base font-kai tracking-[0.15em] leading-relaxed mt-1"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                >
                  {FLUSH_BROADCAST}
                </motion.div>
              )}

              {/* 军势数字 */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.28,
                  delay: 0.18,
                  ease: [0.2, 1.3, 0.3, 1],
                }}
                className="mt-3 flex items-center justify-center gap-3"
              >
                <span className="text-[11px] text-amber-200/80 tracking-[0.5em] font-kai font-black">
                  軍 勢
                </span>
                <span
                  className="text-4xl sm:text-5xl font-black tabular-nums font-kai"
                  style={{
                    background:
                      'linear-gradient(180deg, #fff5cc 0%, #f7d57a 30%, #d4af37 55%, #6b4a10 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter:
                      'drop-shadow(0 0 16px rgba(212,175,55,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
                  }}
                >
                  {banner.power}
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 金色粒子层 */
function EmberLayer() {
  const dots = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        delay: Math.random() * 0.6,
        duration: 1.2 + Math.random() * 0.6,
        size: 2 + Math.random() * 3,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {dots.map((d) => (
        <span
          key={d.id}
          className="ember-dot"
          style={{
            left: `${d.left}%`,
            bottom: -8,
            width: d.size,
            height: d.size,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
