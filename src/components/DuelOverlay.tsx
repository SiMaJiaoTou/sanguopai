import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DuelEntry, DuelResult } from '../ai';
import { INITIAL_HP } from '../ai';

interface Props {
  /** 最新一轮对战记录。变化时触发播放 */
  duel: {
    round: number;
    result: DuelResult;
    hpDelta: Record<string, number>;
  } | null;
  /** 本轮对战 *结束后* 的当前 HP（用于反推对战前血量） */
  currentHp: Record<string, number>;
  /** 本轮结束后结果：玩家是否已阵亡 */
  onFinished?: () => void;
}

type Phase = 'slide_in' | 'impact' | 'damage' | 'exit' | 'done';

interface Step {
  duel: DuelEntry;
  aHpBefore: number;
  aHpAfter: number;
  bHpBefore: number;
  bHpAfter: number;
  damage: number; // 正数
}

const PHASE_MS: Record<Phase, number> = {
  slide_in: 380,
  impact: 320,
  damage: 620,
  exit: 260,
  done: 0,
};

export function DuelOverlay({ duel, currentHp, onFinished }: Props) {
  const [playing, setPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('slide_in');
  const lastRound = useRef<number | null>(null);

  // 当 duel 变化（新回合）→ 启动播放
  useEffect(() => {
    if (!duel) return;
    if (duel.round === lastRound.current) return;
    lastRound.current = duel.round;
    setStepIdx(0);
    setPhase('slide_in');
    setPlaying(true);
  }, [duel?.round]);

  // 计算每一场的 HP 进度（post = current，pre = current - hpDelta 的绝对量回补）
  const steps: Step[] = useMemo(() => {
    if (!duel) return [];
    // 逐步推算：从最新的当前 HP 倒推每场对战的 pre/post
    // hpDelta = negative；累计所有场，最终 HP = preHp(round 开始前) + Σ delta
    // 因此 preHp(对战开始前) = currentHp - Σ(delta of this round for that id)
    const roundTotalDelta: Record<string, number> = {};
    for (const d of duel.result.duels) {
      if (d.winnerId === null) continue;
      const loserId = d.winnerId === d.aId ? d.bId : d.aId;
      const dmg = Math.abs(d.aPower - d.bPower);
      roundTotalDelta[loserId] = (roundTotalDelta[loserId] ?? 0) - dmg;
    }
    const roundStartHp: Record<string, number> = {};
    for (const id of Object.keys(currentHp)) {
      roundStartHp[id] = Math.max(
        0,
        currentHp[id] - (roundTotalDelta[id] ?? 0),
      );
    }
    // 现在，从 roundStartHp 累加演化
    const runningHp = { ...roundStartHp };
    const list: Step[] = [];
    for (const d of duel.result.duels) {
      const aHpBefore = runningHp[d.aId] ?? INITIAL_HP;
      const bHpBefore = runningHp[d.bId] ?? INITIAL_HP;
      const draw = d.winnerId === null;
      const diff = Math.abs(d.aPower - d.bPower);
      let aHpAfter = aHpBefore;
      let bHpAfter = bHpBefore;
      if (!draw) {
        if (d.winnerId === d.aId) {
          bHpAfter = Math.max(0, bHpBefore - diff);
        } else {
          aHpAfter = Math.max(0, aHpBefore - diff);
        }
      }
      runningHp[d.aId] = aHpAfter;
      runningHp[d.bId] = bHpAfter;
      list.push({
        duel: d,
        aHpBefore,
        aHpAfter,
        bHpBefore,
        bHpAfter,
        damage: draw ? 0 : diff,
      });
    }
    return list;
  }, [duel, currentHp]);

  // 状态机：slide_in → impact → damage → exit → 下一场 / done
  useEffect(() => {
    if (!playing) return;
    if (stepIdx >= steps.length) {
      setPhase('done');
      const t = setTimeout(() => {
        setPlaying(false);
        onFinished?.();
      }, 260);
      return () => clearTimeout(t);
    }
    const dur = PHASE_MS[phase];
    const t = setTimeout(() => {
      if (phase === 'slide_in') setPhase('impact');
      else if (phase === 'impact') setPhase('damage');
      else if (phase === 'damage') setPhase('exit');
      else if (phase === 'exit') {
        setStepIdx((i) => i + 1);
        setPhase('slide_in');
      }
    }, dur);
    return () => clearTimeout(t);
  }, [playing, stepIdx, phase, steps.length, onFinished]);

  if (!playing || !duel) return null;

  const totalRounds = steps.length;
  const current = steps[stepIdx];

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          key={duel.round}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(40,10,4,0.75) 0%, rgba(0,0,0,0.92) 80%)',
            backdropFilter: 'blur(3px)',
          }}
        >
          {/* 标题 · 第 N 年 · 两两对战 */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <div className="text-[11px] tracking-[0.6em] text-amber-200/70 font-kai">
              第 {duel.round} 年
            </div>
            <div
              className="text-2xl font-black font-kai tracking-[0.4em] mt-1"
              style={{
                background:
                  'linear-gradient(180deg, #fff5cc 0%, #f7d57a 35%, #d4af37 65%, #6b4a10 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.65))',
              }}
            >
              诸 侯 对 决
            </div>
            <div className="text-[10px] text-amber-200/55 italic mt-1 font-kai">
              {stepIdx + 1} / {totalRounds}
            </div>
          </div>

          {current && (
            <DuelScene
              step={current}
              phase={phase}
              key={`${duel.round}-${stepIdx}`}
            />
          )}

          {/* 底部步进标记 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
            {steps.map((_, i) => (
              <span
                key={i}
                className="inline-block rounded-full transition-all"
                style={{
                  width: i === stepIdx ? 16 : 6,
                  height: 6,
                  background:
                    i < stepIdx
                      ? 'rgba(212,175,55,0.95)'
                      : i === stepIdx
                        ? '#fff5cc'
                        : 'rgba(139,90,40,0.45)',
                  boxShadow:
                    i === stepIdx ? '0 0 8px rgba(255,230,150,0.9)' : 'none',
                }}
              />
            ))}
            {duel.result.byeName && (
              <span className="ml-3 text-[10px] text-amber-200/55 italic font-kai">
                · {duel.result.byeName} 轮空 ·
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ======================================================================
// 单场对战场景
// ======================================================================

function DuelScene({ step, phase }: { step: Step; phase: Phase }) {
  const { duel: d } = step;
  const draw = d.winnerId === null;
  const aWin = d.winnerId === d.aId;
  const bWin = d.winnerId === d.bId;

  // 各 phase 下双方位置
  // slide_in：从屏幕外进入，停留在左右 30%
  // impact：向中心互冲，接触闪光
  // damage：胜者停在中线，败者被击飞回退 + 震动 + 红闪
  // exit：双方退出屏幕
  const xA =
    phase === 'slide_in'
      ? '-55vw'
      : phase === 'impact'
        ? '-6vw'
        : phase === 'damage'
          ? aWin
            ? '-10vw'
            : '-30vw'
          : '-70vw';
  const xB =
    phase === 'slide_in'
      ? '55vw'
      : phase === 'impact'
        ? '6vw'
        : phase === 'damage'
          ? bWin
            ? '10vw'
            : '30vw'
          : '70vw';

  const shakeA = phase === 'damage' && !aWin && !draw;
  const shakeB = phase === 'damage' && !bWin && !draw;

  return (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
      {/* 冲击光环 */}
      <AnimatePresence>
        {phase === 'impact' && (
          <motion.div
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 3.6, opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute"
            style={{
              width: 180,
              height: 180,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(255,245,200,0.95) 0%, rgba(255,180,60,0.75) 35%, rgba(180,40,20,0.55) 70%, transparent 100%)',
              filter: 'blur(2px)',
              boxShadow: '0 0 80px rgba(255,220,120,0.85)',
            }}
          />
        )}
      </AnimatePresence>

      {/* 冲击震动波 */}
      <AnimatePresence>
        {phase === 'impact' && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.3, opacity: 0.85 }}
                animate={{ scale: 4.8, opacity: 0 }}
                transition={{
                  duration: 0.6,
                  ease: 'easeOut',
                  delay: i * 0.08,
                }}
                className="absolute rounded-full"
                style={{
                  width: 120,
                  height: 120,
                  border: '3px solid rgba(255,220,140,0.8)',
                  boxShadow: '0 0 24px rgba(255,200,100,0.8)',
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* 胜利粒子（伤害阶段从胜者处爆开） */}
      {phase === 'damage' && !draw && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ perspective: 600 }}
        >
          {Array.from({ length: 20 }).map((_, i) => {
            const angle = (i / 20) * Math.PI * 2;
            const dist = 120 + Math.random() * 180;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist - 30,
                  opacity: 0,
                  scale: 0.3,
                }}
                transition={{
                  duration: 0.55,
                  ease: 'easeOut',
                  delay: Math.random() * 0.1,
                }}
                className="absolute top-1/2 left-1/2 rounded-full"
                style={{
                  width: 6 + Math.random() * 6,
                  height: 6 + Math.random() * 6,
                  background:
                    Math.random() < 0.2
                      ? '#ff5454'
                      : Math.random() < 0.5
                        ? '#ffd850'
                        : '#fff5cc',
                  boxShadow: '0 0 8px currentColor',
                }}
              />
            );
          })}
        </div>
      )}

      {/* A 方 */}
      <motion.div
        initial={{ x: '-55vw', opacity: 0 }}
        animate={{
          x: xA,
          opacity: phase === 'exit' ? 0 : 1,
        }}
        transition={{
          duration: 0.32,
          ease: phase === 'impact' ? [0.5, 0, 0.9, 1] : 'easeOut',
        }}
        className="absolute"
      >
        <DuelAvatar
          name={d.aName}
          power={d.aPower}
          hpBefore={step.aHpBefore}
          hpAfter={step.aHpAfter}
          damage={aWin || draw ? 0 : step.damage}
          won={aWin}
          lost={bWin}
          draw={draw}
          shake={shakeA}
          phase={phase}
          side="left"
        />
      </motion.div>

      {/* VS 标 */}
      <AnimatePresence>
        {phase === 'slide_in' && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15 }}
            className="absolute font-kai font-black"
            style={{
              fontSize: 72,
              background:
                'linear-gradient(180deg, #ffecb3 0%, #f59e0b 55%, #7a3a0a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter:
                'drop-shadow(0 0 24px rgba(251,191,36,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.95))',
              letterSpacing: '0.05em',
            }}
          >
            VS
          </motion.div>
        )}
      </AnimatePresence>

      {/* B 方 */}
      <motion.div
        initial={{ x: '55vw', opacity: 0 }}
        animate={{
          x: xB,
          opacity: phase === 'exit' ? 0 : 1,
        }}
        transition={{
          duration: 0.32,
          ease: phase === 'impact' ? [0.5, 0, 0.9, 1] : 'easeOut',
        }}
        className="absolute"
      >
        <DuelAvatar
          name={d.bName}
          power={d.bPower}
          hpBefore={step.bHpBefore}
          hpAfter={step.bHpAfter}
          damage={bWin || draw ? 0 : step.damage}
          won={bWin}
          lost={aWin}
          draw={draw}
          shake={shakeB}
          phase={phase}
          side="right"
        />
      </motion.div>
    </div>
  );
}

// ======================================================================
// 对战双方的人形立牌
// ======================================================================

function DuelAvatar({
  name,
  power,
  hpBefore,
  hpAfter,
  damage,
  won,
  lost,
  draw,
  shake,
  phase,
  side,
}: {
  name: string;
  power: number;
  hpBefore: number;
  hpAfter: number;
  damage: number;
  won: boolean;
  lost: boolean;
  draw: boolean;
  shake: boolean;
  phase: Phase;
  side: 'left' | 'right';
}) {
  const hpWidth = (hp: number) =>
    `${Math.max(0, Math.min(100, (hp / INITIAL_HP) * 100))}%`;

  return (
    <motion.div
      animate={
        shake
          ? {
              x: [0, -10, 12, -8, 9, -4, 0],
              rotate: [0, -2, 2, -1.5, 1, 0],
            }
          : {}
      }
      transition={{ duration: 0.55 }}
      className="relative flex flex-col items-center"
    >
      {/* 立牌 */}
      <div
        className="relative"
        style={{
          width: 180,
          height: 220,
          filter: lost && phase === 'damage' ? 'brightness(0.55) saturate(0.7)' : 'none',
        }}
      >
        {/* 背景光环（胜者金光） */}
        {won && phase === 'damage' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(255,230,150,0.55) 0%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
        )}
        {/* 外金边底盘 */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background:
              'linear-gradient(180deg, #d4af37 0%, #8b6914 60%, #3a2408 100%)',
            boxShadow:
              '0 8px 20px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,240,200,0.5), inset 0 -2px 4px rgba(0,0,0,0.65)',
          }}
        />
        {/* 阵营色底 */}
        <div
          className="absolute inset-[5px] rounded"
          style={{
            background:
              won && phase === 'damage'
                ? 'linear-gradient(180deg, #5a3a10 0%, #2a1810 55%, #1a0f08 100%)'
                : 'linear-gradient(180deg, #3a2418 0%, #1a0f08 100%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7)',
          }}
        />
        {/* 红闪（受击） */}
        <AnimatePresence>
          {lost && phase === 'damage' && (
            <motion.div
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55 }}
              className="absolute inset-[5px] rounded"
              style={{
                background:
                  'linear-gradient(180deg, rgba(220,30,30,0.85) 0%, rgba(80,10,10,0.7) 100%)',
                mixBlendMode: 'screen',
              }}
            />
          )}
        </AnimatePresence>

        {/* 名字 */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 text-center font-kai font-black whitespace-nowrap"
          style={{
            fontSize: 22,
            color: '#fef3c7',
            textShadow:
              '0 0 8px rgba(212,175,55,0.55), 0 2px 3px rgba(0,0,0,0.95)',
            letterSpacing: '0.22em',
          }}
        >
          {name}
        </div>

        {/* 肖像圆底（用 hero.png） */}
        <div
          className="absolute"
          style={{
            left: '50%',
            top: 52,
            transform: 'translateX(-50%)',
            width: 100,
            height: 100,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid #d4af37',
            boxShadow:
              '0 0 14px rgba(212,175,55,0.55), inset 0 2px 4px rgba(0,0,0,0.6)',
          }}
        >
          <img
            src="/hero.png"
            alt={name}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: '50% 22%',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)',
            }}
          />
        </div>

        {/* 战力数字 */}
        <div
          className="absolute left-1/2 -translate-x-1/2 text-center tabular-nums font-kai font-black"
          style={{
            bottom: 46,
            fontSize: 28,
            background:
              'linear-gradient(180deg, #fff5cc 0%, #f7d57a 40%, #d4af37 75%, #6b4a10 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95))',
            letterSpacing: '0.1em',
          }}
        >
          {power}
        </div>
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: 38,
            fontSize: 9,
            color: 'rgba(253,230,138,0.75)',
            letterSpacing: '0.35em',
          }}
        >
          軍 勢
        </div>

        {/* HP 血条 */}
        <div
          className="absolute left-3 right-3"
          style={{ bottom: 10 }}
        >
          <div
            className="relative h-3 rounded-sm overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, #0a0604 0%, #1f0f08 100%)',
              border: '1px solid #3a2414',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9)',
            }}
          >
            <motion.div
              className="absolute inset-y-0 left-0"
              initial={{ width: hpWidth(hpBefore) }}
              animate={{
                width:
                  phase === 'slide_in' || phase === 'impact'
                    ? hpWidth(hpBefore)
                    : hpWidth(hpAfter),
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                background:
                  'linear-gradient(180deg, #ff8a8a 0%, #c82828 55%, #5a0f0f 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,220,220,0.3)',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                key={phase}
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                className="text-[10px] font-black tabular-nums font-kai text-white"
                style={{
                  textShadow: '0 1px 1px rgba(0,0,0,0.95)',
                }}
              >
                {phase === 'slide_in' || phase === 'impact'
                  ? hpBefore
                  : hpAfter}{' '}
                / {INITIAL_HP}
              </motion.span>
            </div>
          </div>
        </div>

        {/* 胜者印 */}
        <AnimatePresence>
          {won && phase === 'damage' && (
            <motion.div
              initial={{ scale: 2, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 0.95, rotate: -8 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260 }}
              className="absolute -top-3 -right-3 seal-red w-12 h-12 flex items-center justify-center font-kai text-base font-black"
              style={{ letterSpacing: 0 }}
            >
              勝
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 扣血飘字 */}
      <AnimatePresence>
        {lost && !draw && damage > 0 && phase === 'damage' && (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.7 }}
            animate={{ y: -40, opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute pointer-events-none font-kai font-black"
            style={{
              top: 0,
              left: side === 'left' ? '100%' : 'auto',
              right: side === 'right' ? '100%' : 'auto',
              fontSize: 40,
              color: '#ff5454',
              textShadow:
                '0 0 12px rgba(255,80,80,0.95), 0 0 20px rgba(255,40,40,0.65), 0 2px 4px rgba(0,0,0,0.95)',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}
          >
            -{damage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 平局 */}
      <AnimatePresence>
        {draw && phase === 'damage' && (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.7 }}
            animate={{ y: -20, opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute pointer-events-none font-kai font-black text-amber-200"
            style={{
              top: -24,
              fontSize: 20,
              textShadow: '0 2px 3px rgba(0,0,0,0.9)',
              letterSpacing: '0.3em',
            }}
          >
            平
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
