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

type Phase = 'slide_in' | 'impact' | 'damage' | 'linger' | 'exit' | 'done';

interface Step {
  duel: DuelEntry;
  aHpBefore: number;
  aHpAfter: number;
  bHpBefore: number;
  bHpAfter: number;
  damage: number; // 正数
}

// 全局统一阶段节奏（所有对战同时走）
const PHASE_MS: Record<Phase, number> = {
  slide_in: 650,
  impact: 520,
  damage: 900,
  linger: 1500, // 停留观察
  exit: 450,
  done: 0,
};

export function DuelOverlay({ duel, currentHp, onFinished }: Props) {
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>('slide_in');
  const lastRound = useRef<number | null>(null);

  // 当 duel 变化（新回合）→ 启动播放
  useEffect(() => {
    if (!duel) return;
    if (duel.round === lastRound.current) return;
    lastRound.current = duel.round;
    setPhase('slide_in');
    setPlaying(true);
  }, [duel?.round]);

  // 计算每一场的 HP 进度（post = current，pre = current - hpDelta 的绝对量回补）
  const steps: Step[] = useMemo(() => {
    if (!duel) return [];
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

  // 状态机（全局同步，所有对战同一节奏）：
  // slide_in → impact → damage → linger → exit → done
  useEffect(() => {
    if (!playing) return;
    if (phase === 'done') {
      setPlaying(false);
      onFinished?.();
      return;
    }
    const dur = PHASE_MS[phase];
    const t = setTimeout(() => {
      if (phase === 'slide_in') setPhase('impact');
      else if (phase === 'impact') setPhase('damage');
      else if (phase === 'damage') setPhase('linger');
      else if (phase === 'linger') setPhase('exit');
      else if (phase === 'exit') setPhase('done');
    }, dur);
    return () => clearTimeout(t);
  }, [playing, phase, onFinished]);

  if (!playing || !duel) return null;

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          key={duel.round}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex flex-col items-center pointer-events-auto overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(40,10,4,0.8) 0%, rgba(0,0,0,0.95) 80%)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* 标题 · 第 N 年 · 诸侯混战 */}
          <div className="flex-shrink-0 text-center pt-6 pb-2">
            <div className="text-[11px] tracking-[0.6em] text-amber-200/70 font-kai">
              第 {duel.round} 年
            </div>
            <div
              className="text-2xl sm:text-3xl font-black font-kai tracking-[0.4em] mt-1"
              style={{
                background:
                  'linear-gradient(180deg, #fff5cc 0%, #f7d57a 35%, #d4af37 65%, #6b4a10 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.65))',
              }}
            >
              諸 侯 混 戰
            </div>
            <div className="text-[10px] text-amber-200/55 italic mt-1 font-kai">
              共 {steps.length} 场对决 · 同时开打
            </div>
          </div>

          {/* 所有对战同时展示（垂直堆叠） */}
          <div className="flex-1 w-full flex flex-col justify-center items-center gap-2 sm:gap-3 px-4 pb-16">
            {steps.map((s, i) => (
              <DuelRow
                key={`${duel.round}-${i}`}
                step={s}
                phase={phase}
                slideInDelay={i * 0.06}
              />
            ))}
          </div>

          {/* 底部轮空提示 */}
          {duel.result.byeName && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-amber-200/65 italic font-kai">
              · {duel.result.byeName} 本轮轮空 ·
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ======================================================================
// 单行对战（水平：A ⚔ B）
// ======================================================================

function DuelRow({
  step,
  phase,
  slideInDelay,
}: {
  step: Step;
  phase: Phase;
  slideInDelay: number;
}) {
  const { duel: d } = step;
  const draw = d.winnerId === null;
  const aWin = d.winnerId === d.aId;
  const bWin = d.winnerId === d.bId;

  // 位置：slide_in 从两侧进入；impact 相撞到中央；damage 胜者留中/败者后退；linger 静态；exit 退出
  const xA =
    phase === 'slide_in'
      ? '-50vw'
      : phase === 'impact'
        ? '-3vw'
        : phase === 'damage' || phase === 'linger'
          ? aWin
            ? '-4vw'
            : '-20vw'
          : '-70vw';
  const xB =
    phase === 'slide_in'
      ? '50vw'
      : phase === 'impact'
        ? '3vw'
        : phase === 'damage' || phase === 'linger'
          ? bWin
            ? '4vw'
            : '20vw'
          : '70vw';

  const shakeA = phase === 'damage' && !aWin && !draw;
  const shakeB = phase === 'damage' && !bWin && !draw;

  return (
    <div
      className="relative w-full flex items-center justify-center"
      style={{ minHeight: 90, maxWidth: 900 }}
    >
      {/* 中央冲击光环（impact 阶段） */}
      <AnimatePresence>
        {phase === 'impact' && (
          <motion.div
            initial={{ scale: 0.25, opacity: 0 }}
            animate={{ scale: 2.6, opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.52, ease: 'easeOut' }}
            className="absolute"
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(255,245,200,0.95) 0%, rgba(255,180,60,0.75) 35%, rgba(220,40,20,0.65) 70%, transparent 100%)',
              filter: 'blur(2px)',
              boxShadow: '0 0 60px rgba(255,220,120,0.85)',
              zIndex: 5,
            }}
          />
        )}
      </AnimatePresence>

      {/* 冲击波纹 */}
      <AnimatePresence>
        {phase === 'impact' && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 3.8, opacity: 0 }}
                transition={{
                  duration: 0.7,
                  ease: 'easeOut',
                  delay: i * 0.08,
                }}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 80,
                  height: 80,
                  border: '3px solid rgba(255,220,140,0.85)',
                  boxShadow: '0 0 18px rgba(255,200,100,0.85)',
                  zIndex: 4,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* 胜利粒子（damage 阶段） */}
      {phase === 'damage' && !draw && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {Array.from({ length: 14 }).map((_, i) => {
            const angle = (i / 14) * Math.PI * 2;
            const dist = 70 + Math.random() * 120;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist - 14,
                  opacity: 0,
                  scale: 0.3,
                }}
                transition={{
                  duration: 0.7,
                  ease: 'easeOut',
                  delay: Math.random() * 0.1,
                }}
                className="absolute rounded-full"
                style={{
                  width: 5 + Math.random() * 5,
                  height: 5 + Math.random() * 5,
                  background:
                    Math.random() < 0.35
                      ? '#ff3030'
                      : Math.random() < 0.6
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
        initial={{ x: '-50vw', opacity: 0 }}
        animate={{
          x: xA,
          opacity: phase === 'exit' ? 0 : 1,
        }}
        transition={{
          duration: phase === 'slide_in' ? 0.55 : 0.36,
          delay: phase === 'slide_in' ? slideInDelay : 0,
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

      {/* VS 标（slide_in 阶段中央） */}
      <AnimatePresence>
        {phase === 'slide_in' && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 15,
              delay: slideInDelay + 0.15,
            }}
            className="absolute font-kai font-black"
            style={{
              fontSize: 44,
              background:
                'linear-gradient(180deg, #ffecb3 0%, #f59e0b 55%, #7a3a0a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter:
                'drop-shadow(0 0 20px rgba(251,191,36,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.95))',
              letterSpacing: '0.05em',
              zIndex: 3,
            }}
          >
            VS
          </motion.div>
        )}
      </AnimatePresence>

      {/* B 方 */}
      <motion.div
        initial={{ x: '50vw', opacity: 0 }}
        animate={{
          x: xB,
          opacity: phase === 'exit' ? 0 : 1,
        }}
        transition={{
          duration: phase === 'slide_in' ? 0.55 : 0.36,
          delay: phase === 'slide_in' ? slideInDelay : 0,
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
// 对战双方的人形立牌（紧凑版：120×120）
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
              x: [0, -12, 14, -10, 10, -5, 0],
              rotate: [0, -3, 3, -2, 1.5, 0],
            }
          : {}
      }
      transition={{ duration: 0.6 }}
      className="relative flex flex-col items-center"
    >
      {/* 立牌 · 紧凑版 */}
      <div
        className="relative"
        style={{
          width: 150,
          height: 74,
          filter:
            lost && (phase === 'damage' || phase === 'linger')
              ? 'brightness(0.55) saturate(0.7)'
              : 'none',
          transition: 'filter 0.3s',
        }}
      >
        {/* 胜者金色光环 */}
        {won && (phase === 'damage' || phase === 'linger') && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.9 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(255,230,150,0.6) 0%, transparent 70%)',
              filter: 'blur(10px)',
              zIndex: 0,
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
              '0 4px 10px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,240,200,0.5), inset 0 -2px 4px rgba(0,0,0,0.65)',
          }}
        />
        {/* 阵营色底 */}
        <div
          className="absolute inset-[3px] rounded"
          style={{
            background:
              won && (phase === 'damage' || phase === 'linger')
                ? 'linear-gradient(180deg, #5a3a10 0%, #2a1810 55%, #1a0f08 100%)'
                : 'linear-gradient(180deg, #3a2418 0%, #1a0f08 100%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7)',
          }}
        />

        {/* 红闪（受击） */}
        <AnimatePresence>
          {lost && phase === 'damage' && (
            <motion.div
              initial={{ opacity: 0.95 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.75 }}
              className="absolute inset-[3px] rounded"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,30,30,0.95) 0%, rgba(120,10,10,0.8) 100%)',
                mixBlendMode: 'screen',
              }}
            />
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-2 h-full px-2">
          {/* 肖像圆底 */}
          <div
            className="relative flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid #d4af37',
              boxShadow:
                '0 0 10px rgba(212,175,55,0.55), inset 0 2px 4px rgba(0,0,0,0.6)',
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

          {/* 右侧信息 */}
          <div className="flex flex-col justify-center flex-1 min-w-0 gap-0.5">
            {/* 名字 */}
            <div
              className="font-kai font-black whitespace-nowrap truncate"
              style={{
                fontSize: 16,
                color: '#fef3c7',
                textShadow:
                  '0 0 6px rgba(212,175,55,0.55), 0 1px 2px rgba(0,0,0,0.95)',
                letterSpacing: '0.15em',
                lineHeight: 1,
              }}
            >
              {name}
            </div>
            {/* 军势 */}
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  fontSize: 9,
                  color: 'rgba(253,230,138,0.7)',
                  letterSpacing: '0.25em',
                }}
              >
                軍勢
              </span>
              <span
                className="tabular-nums font-kai font-black"
                style={{
                  fontSize: 18,
                  background:
                    'linear-gradient(180deg, #fff5cc 0%, #f7d57a 40%, #d4af37 75%, #6b4a10 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.95))',
                  lineHeight: 1,
                }}
              >
                {power}
              </span>
            </div>
            {/* HP 血条 */}
            <div
              className="relative w-full rounded-sm overflow-hidden"
              style={{
                height: 10,
                background: 'linear-gradient(180deg, #0a0604 0%, #1f0f08 100%)',
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
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                  background:
                    'linear-gradient(180deg, #ff8a8a 0%, #c82828 55%, #5a0f0f 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,220,220,0.3)',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="font-black tabular-nums font-kai text-white"
                  style={{
                    fontSize: 9,
                    textShadow: '0 1px 1px rgba(0,0,0,0.95)',
                  }}
                >
                  {phase === 'slide_in' || phase === 'impact'
                    ? hpBefore
                    : hpAfter}{' '}
                  / {INITIAL_HP}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 胜者印（紧贴右上） */}
        <AnimatePresence>
          {won && (phase === 'damage' || phase === 'linger') && (
            <motion.div
              initial={{ scale: 2, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 0.95, rotate: -8 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260 }}
              className="absolute -top-2 -right-2 seal-red flex items-center justify-center font-kai font-black"
              style={{
                width: 30,
                height: 30,
                fontSize: 13,
                letterSpacing: 0,
                zIndex: 6,
              }}
            >
              勝
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =========== 扣血飘字（超强红色爆字）=========== */}
      <AnimatePresence>
        {lost && !draw && damage > 0 && (phase === 'damage' || phase === 'linger') && (
          <>
            {/* 主飘字 */}
            <motion.div
              initial={{ y: 6, opacity: 0, scale: 0.5 }}
              animate={{
                y: [-6, -18, -44, -60],
                opacity: [0, 1, 1, 0.85],
                scale: [0.5, 1.4, 1.2, 1.1],
              }}
              transition={{
                duration: 1.5,
                times: [0, 0.18, 0.6, 1],
                ease: 'easeOut',
              }}
              className="absolute pointer-events-none font-kai font-black"
              style={{
                top: '-30%',
                left: side === 'left' ? 'auto' : '50%',
                right: side === 'right' ? 'auto' : 'auto',
                transform: 'translateX(-50%)',
                fontSize: 52,
                background:
                  'linear-gradient(180deg, #ffffff 0%, #ffb4b4 20%, #ff3030 55%, #7a0000 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter:
                  'drop-shadow(0 0 20px rgba(255,50,50,1)) drop-shadow(0 0 36px rgba(255,0,0,0.85)) drop-shadow(0 3px 6px rgba(0,0,0,1))',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                zIndex: 10,
                fontStyle: 'italic',
              }}
            >
              -{damage}
            </motion.div>

            {/* 伤害爆发光晕 */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0.9 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="absolute pointer-events-none rounded-full"
              style={{
                top: '-10%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 80,
                height: 80,
                background:
                  'radial-gradient(circle, rgba(255,60,60,0.9) 0%, rgba(200,20,20,0.6) 40%, transparent 75%)',
                filter: 'blur(6px)',
                zIndex: 9,
              }}
            />

            {/* 血珠溅出 */}
            {Array.from({ length: 10 }).map((_, i) => {
              const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
              const dist = 40 + Math.random() * 50;
              return (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(ang) * dist,
                    y: Math.sin(ang) * dist - 10 + 40, // 向下带重力
                    opacity: 0,
                    scale: 0.4,
                  }}
                  transition={{
                    duration: 0.9,
                    ease: 'easeOut',
                    delay: Math.random() * 0.1,
                  }}
                  className="absolute pointer-events-none rounded-full"
                  style={{
                    top: '10%',
                    left: '50%',
                    width: 5 + Math.random() * 6,
                    height: 5 + Math.random() * 6,
                    background:
                      'radial-gradient(circle at 30% 25%, #ff6060 0%, #a01010 55%, #3a0404 100%)',
                    boxShadow: '0 0 6px rgba(255,40,40,0.85)',
                    zIndex: 9,
                  }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* 平局 */}
      <AnimatePresence>
        {draw && (phase === 'damage' || phase === 'linger') && (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.7 }}
            animate={{ y: -14, opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute pointer-events-none font-kai font-black text-amber-200"
            style={{
              top: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 18,
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
