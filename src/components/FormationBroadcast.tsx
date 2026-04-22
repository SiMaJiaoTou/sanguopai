import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EvaluateResult } from '../types';
import { FORMATIONS, FLUSH_BROADCAST } from '../formations';
import { POWER_CAP } from '../evaluate';

interface Props {
  evalResult: EvaluateResult | null;
  teamIndex: number;
}

export function FormationBroadcast({ evalResult, teamIndex }: Props) {
  const [banner, setBanner] = useState<{
    id: number;
    formation: (typeof FORMATIONS)[keyof typeof FORMATIONS];
    isFlush: boolean;
    power: number;
    capped: boolean;
  } | null>(null);

  useEffect(() => {
    if (!evalResult) return;
    const formation = FORMATIONS[evalResult.rankType.key];
    setBanner({
      id: Date.now() + Math.random(),
      formation,
      isFlush: evalResult.isFlush,
      power: evalResult.power,
      capped: evalResult.capped,
    });
    const t = setTimeout(() => setBanner(null), 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalResult?.rankType.key, evalResult?.isFlush, teamIndex]);

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-x-0 top-[22%] z-40 pointer-events-none"
        >
          {/* 横幅整体 */}
          <motion.div
            initial={{ scaleX: 0.1, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0.3, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}
            className="relative proclaim-band py-6 sm:py-8 overflow-hidden"
            style={{ transformOrigin: 'center' }}
          >
            <EmberLayer />

            {/* 左右悬挂印章 */}
            <div
              className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 seal-red w-14 h-14 text-base flex items-center justify-center font-kai z-10"
              style={{ letterSpacing: 0, transform: 'translateY(-50%) rotate(-8deg)' }}
            >
              {teamIndex === 0 ? '前' : '后'}
            </div>
            <div
              className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 seal-red w-14 h-14 text-base flex items-center justify-center font-kai z-10"
              style={{ letterSpacing: 0, transform: 'translateY(-50%) rotate(8deg)' }}
            >
              檄
            </div>

            {/* 中央内容 */}
            <div className="relative mx-auto max-w-[720px] px-20 sm:px-24 text-center">
              {/* 页眉：阵法推演 */}
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-[11px] tracking-[0.9em] font-kai font-black mb-2"
                style={{
                  color: '#f7d57a',
                  textShadow: '0 0 10px rgba(212,175,55,0.75), 0 1px 2px rgba(0,0,0,0.95)',
                }}
              >
                阵 法 推 演
              </motion.div>

              {/* 阵法大名 */}
              <motion.div
                initial={{ letterSpacing: '1.3em', opacity: 0, filter: 'blur(6px)' }}
                animate={{ letterSpacing: '0.45em', opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.65, delay: 0.25 }}
                className="text-4xl sm:text-5xl font-black font-kai leading-none"
                style={{
                  background:
                    'linear-gradient(180deg, #fff5cc 0%, #f7d57a 30%, #d4af37 55%, #6b4a10 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter:
                    'drop-shadow(0 0 12px rgba(212,175,55,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
                }}
              >
                {banner.formation.name}
              </motion.div>

              {/* 金线分隔 */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="mx-auto my-3 h-[1px] w-48"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(212,175,55,0.85), rgba(255,245,200,0.95), rgba(212,175,55,0.85), transparent)',
                  boxShadow: '0 0 8px rgba(212,175,55,0.55)',
                  transformOrigin: 'center',
                }}
              />

              {/* 播报文案 */}
              <TypewriterText
                text={banner.formation.broadcast}
                delay={0.55}
                className="text-amber-100"
              />
              {banner.isFlush && (
                <TypewriterText
                  text={FLUSH_BROADCAST}
                  delay={1.1}
                  className="text-red-200 mt-1"
                />
              )}

              {/* 军势数字 */}
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.45, type: 'spring', stiffness: 200 }}
                className="mt-4 flex items-center justify-center gap-3"
              >
                <span className="text-[11px] text-amber-200/80 tracking-[0.5em] font-kai font-black">
                  軍 勢
                </span>
                <span
                  className={[
                    'text-5xl sm:text-6xl font-black tabular-nums font-kai',
                    banner.capped ? 'text-red-300' : '',
                  ].join(' ')}
                  style={{
                    background: banner.capped
                      ? undefined
                      : 'linear-gradient(180deg, #fff5cc 0%, #f7d57a 30%, #d4af37 55%, #6b4a10 100%)',
                    WebkitBackgroundClip: banner.capped ? undefined : 'text',
                    WebkitTextFillColor: banner.capped ? undefined : 'transparent',
                    filter:
                      'drop-shadow(0 0 16px rgba(212,175,55,0.75)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
                  }}
                >
                  {banner.power}
                </span>
                {banner.capped && (
                  <span
                    className="text-[10px] text-red-100 px-2 py-0.5 rounded font-bold tracking-widest"
                    style={{
                      background: 'linear-gradient(180deg, #c82828, #5a0808)',
                      border: '1px solid #2a0404',
                      boxShadow: 'inset 0 1px 0 rgba(255,180,160,0.5)',
                    }}
                  >
                    封顶 {POWER_CAP}
                  </span>
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 金色粒子层（装饰） */
function EmberLayer() {
  const dots = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        delay: Math.random() * 3,
        duration: 3.5 + Math.random() * 2,
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

function TypewriterText({
  text,
  delay = 0.3,
  className = '',
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    setShown('');
    const startDelay = delay * 1000;
    const charDelay = 42;
    let timer: ReturnType<typeof setTimeout>;

    const showChar = (i: number) => {
      if (i > text.length) return;
      setShown(text.slice(0, i));
      timer = setTimeout(() => showChar(i + 1), charDelay);
    };

    const start = setTimeout(() => showChar(1), startDelay);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [text, delay]);

  return (
    <div
      className={[
        'text-center text-sm sm:text-base font-kai tracking-[0.15em] leading-relaxed',
        className,
      ].join(' ')}
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
    >
      {shown}
      {shown.length < text.length && (
        <span className="inline-block w-[2px] h-[1em] align-middle ml-1 bg-amber-200 animate-pulse" />
      )}
    </div>
  );
}
