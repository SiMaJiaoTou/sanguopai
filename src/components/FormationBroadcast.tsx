import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EvaluateResult } from '../types';
import { FORMATIONS, FLUSH_BROADCAST } from '../formations';
import { POWER_CAP } from '../evaluate';

interface Props {
  evalResult: EvaluateResult | null;
  teamIndex: number;
}

/**
 * 阵法播报横幅 —— 5 员成阵时全屏打字机效果宣告
 * 触发逻辑：evalResult 从 null 变为非 null，或 rankType.key 改变
 */
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
    // 3 秒后自动消失
    const t = setTimeout(() => setBanner(null), 3000);
    return () => clearTimeout(t);
  }, [evalResult?.rankType.key, evalResult?.isFlush, teamIndex]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          initial={{ opacity: 0, scale: 0.7, y: -40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="fixed top-[28%] left-1/2 z-40 pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="relative px-8 py-4 rounded-lg wood-panel bronze-border rivets wood-dark min-w-[420px] max-w-[80vw]"
            style={{
              boxShadow:
                '0 0 40px rgba(212,175,55,0.6), 0 12px 40px rgba(0,0,0,0.9), inset 0 2px 3px rgba(255,200,120,0.35)',
            }}
          >
            <div className="rivet-b" />

            {/* 朱砂印 */}
            <div
              className="absolute -top-2 -left-2 seal-red w-10 h-10 text-xs flex items-center justify-center"
              style={{ transform: 'rotate(-8deg) scale(1)' }}
            >
              {teamIndex === 0 ? '前' : '后'}
            </div>

            {/* 阵法名（大字） */}
            <div className="text-center mb-2">
              <div className="text-[10px] text-amber-200/60 tracking-[0.6em] mb-1">
                · 阵 法 推 演 ·
              </div>
              <motion.div
                initial={{ letterSpacing: '1em', opacity: 0 }}
                animate={{ letterSpacing: '0.4em', opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-3xl sm:text-4xl font-black text-gold-grad font-kai leading-none"
              >
                {banner.formation.name}
              </motion.div>
            </div>

            {/* 播报文案（打字机效果） */}
            <TypewriterText text={banner.formation.broadcast} />
            {banner.isFlush && (
              <TypewriterText
                text={FLUSH_BROADCAST}
                delay={0.8}
                className="text-red-300 mt-1"
              />
            )}

            {/* 军势数字 */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.2, type: 'spring', stiffness: 200 }}
              className="mt-3 flex items-center justify-center gap-3"
            >
              <span className="text-[10px] text-amber-200/70 tracking-widest font-kai">
                军 势
              </span>
              <span
                className={[
                  'text-4xl font-black tabular-nums font-kai',
                  banner.capped ? 'text-red-400' : 'text-gold-grad',
                ].join(' ')}
                style={{
                  textShadow:
                    '0 0 12px rgba(212,175,55,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                }}
              >
                {banner.power}
              </span>
              {banner.capped && (
                <span className="text-[10px] text-red-300 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-400/60 font-bold tracking-widest">
                  封顶 {POWER_CAP}
                </span>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 打字机逐字显示文字 */
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
    const charDelay = 40; // 每字间隔 ms
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
        'text-center text-amber-100 text-sm sm:text-base font-kai tracking-wide leading-relaxed',
        className,
      ].join(' ')}
    >
      {shown}
      {shown.length < text.length && (
        <span className="inline-block w-[1px] h-[1em] align-middle bg-gold ml-1 animate-pulse" />
      )}
    </div>
  );
}
