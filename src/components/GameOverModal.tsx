import { motion } from 'framer-motion';
import type { PowerSnapshot } from '../store';
import type { AIState } from '../ai';
import { PowerChart } from './PowerChart';

interface Props {
  totalPower: number;
  gold: number;
  recruitLevel: number;
  onRestart: () => void;
  powerHistory: PowerSnapshot[];
  currentRound: number;
  ais: AIState[];
  playerEliminatedAtRound: number | null;
}

/**
 * 计算玩家最终排名：
 *  - 存活者排在淘汰者前面
 *  - 存活者之间按 totalPower 降序
 *  - 已淘汰者按"淘汰更晚 = 更靠前"，同年被淘汰按 totalPower 降序
 */
function computeFinalRank(
  playerTotalPower: number,
  playerEliminatedAtRound: number | null,
  ais: AIState[],
): { rank: number; total: number } {
  type Row = {
    id: string;
    totalPower: number;
    eliminatedAtRound: number | null;
  };
  const rows: Row[] = [
    {
      id: 'player',
      totalPower: playerTotalPower,
      eliminatedAtRound: playerEliminatedAtRound,
    },
    ...ais.map((a) => ({
      id: a.id,
      totalPower: a.lastTotalPower,
      eliminatedAtRound: a.eliminatedAtRound,
    })),
  ];
  rows.sort((a, b) => {
    const aAlive = a.eliminatedAtRound === null;
    const bAlive = b.eliminatedAtRound === null;
    if (aAlive !== bAlive) return aAlive ? -1 : 1;
    if (!aAlive && !bAlive) {
      // 淘汰更晚 → 排名更靠前
      if (a.eliminatedAtRound !== b.eliminatedAtRound) {
        return (b.eliminatedAtRound ?? 0) - (a.eliminatedAtRound ?? 0);
      }
    }
    return b.totalPower - a.totalPower;
  });
  const idx = rows.findIndex((r) => r.id === 'player');
  return { rank: idx + 1, total: rows.length };
}

const RANK_LABEL: Record<number, string> = {
  1: '魁 首',
  2: '亚 军',
  3: '探 花',
};

function rankTitle(rank: number): string {
  if (RANK_LABEL[rank]) return RANK_LABEL[rank];
  return `第 ${rank} 名`;
}

export function GameOverModal({
  totalPower,
  gold,
  recruitLevel,
  onRestart,
  powerHistory,
  currentRound,
  ais,
  playerEliminatedAtRound,
}: Props) {
  const { rank, total } = computeFinalRank(
    totalPower,
    playerEliminatedAtRound,
    ais,
  );
  const isChampion = rank === 1;
  const isTop3 = rank <= 3;
  const isEliminated = playerEliminatedAtRound !== null;

  // 根据排名选配色与文案
  const rankColor = isChampion
    ? { from: '#fff5cc', mid: '#f7d57a', to: '#6b4a10' }
    : rank === 2
      ? { from: '#f0f0f5', mid: '#c0c0d5', to: '#5a5a6a' }
      : rank === 3
        ? { from: '#fde4c8', mid: '#c88958', to: '#5a2810' }
        : { from: '#d4b89a', mid: '#8b6945', to: '#3a2418' };

  const rankTitleText = isEliminated
    ? '群 雄 末 路'
    : totalPower >= 1500
      ? '一 统 天 下'
      : totalPower >= 1100
        ? '问 鼎 中 原'
        : totalPower >= 700
          ? '割 据 一 方'
          : totalPower >= 400
            ? '小 有 声 望'
            : '草 莽 英 雄';

  const epitaph = isEliminated
    ? '英雄迟暮，折戟沉沙，诸侯皆背而去'
    : isChampion
      ? '群雄俯首，万民臣服 · 一统三国'
      : totalPower >= 1500
        ? '四海归一，万民臣服 · 千秋伟业终成'
        : totalPower >= 1100
          ? '诸侯皆服，中原可图'
          : totalPower >= 700
            ? '拥兵据土，未与群雄争锋'
            : totalPower >= 400
              ? '初有名声，路途尚远'
              : '白衣起步，志存高远';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(20,10,4,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <motion.div
        initial={{ scaleY: 0.06, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative w-full max-w-[680px]"
        style={{ transformOrigin: 'center' }}
      >
        {/* 上轴承 */}
        <div className="scroll-axis" />

        {/* 卷身 · 羊皮纸 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative parchment text-center px-6 sm:px-12 py-8 sm:py-12"
          style={{
            borderLeft: '3px solid #5a3a1c',
            borderRight: '3px solid #5a3a1c',
            boxShadow:
              'inset 0 0 60px rgba(100,60,20,0.25), inset 0 0 120px rgba(70,40,10,0.18)',
          }}
        >
          {/* 朱砂大印 */}
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 0.92, rotate: -8 }}
            transition={{ delay: 1.1, type: 'spring', stiffness: 180 }}
            className="absolute top-5 right-5 sm:top-7 sm:right-7 seal-red w-16 h-16 flex-col text-base font-kai"
            style={{ letterSpacing: 0 }}
          >
            <div className="leading-tight">终</div>
            <div className="leading-tight">局</div>
          </motion.div>

          {/* 卷首花纹 */}
          <div className="ornament-meander mb-2 opacity-60" />

          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.75 }}
          >
            <div className="text-[10px] text-red-900/70 tracking-[1em] font-kai font-black mb-0.5">
              六 载 春 秋
            </div>
            <div className="text-[10px] text-red-900/50 tracking-[0.5em] italic mb-5">
              · 功 过 史 册 ·
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.95 }}
            className="text-4xl sm:text-5xl font-black mb-3 font-kai tracking-[0.3em]"
            style={{
              background: 'linear-gradient(180deg, #7a1818 0%, #3a0404 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 2px 0 rgba(120,40,20,0.2)',
            }}
          >
            {rankTitleText}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.15 }}
            className="text-[12px] text-red-900/65 italic mb-4 tracking-[0.15em] font-kai"
          >
            —— {epitaph} ——
          </motion.div>

          {/* ============ 最终名次勋章（big medal） ============ */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              delay: 1.25,
              type: 'spring',
              stiffness: 220,
              damping: 14,
            }}
            className="mx-auto mb-5 flex items-center justify-center gap-5"
          >
            {/* 左右装饰 */}
            <span
              className="hidden sm:inline-block h-[2px] flex-1 max-w-[120px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${rankColor.mid}, transparent)`,
              }}
            />
            <div
              className="relative flex flex-col items-center justify-center font-kai font-black rounded-full"
              style={{
                width: 130,
                height: 130,
                background: `radial-gradient(circle at 30% 25%, ${rankColor.from} 0%, ${rankColor.mid} 55%, ${rankColor.to} 100%)`,
                border: `3px solid ${rankColor.to}`,
                boxShadow: isTop3
                  ? `0 0 24px ${rankColor.mid}cc, inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -4px 6px rgba(0,0,0,0.3), 0 6px 14px rgba(0,0,0,0.55)`
                  : `inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -4px 6px rgba(0,0,0,0.35), 0 6px 14px rgba(0,0,0,0.55)`,
              }}
            >
              {/* 徽章光晕 */}
              {isChampion && (
                <motion.div
                  animate={{ opacity: [0.35, 0.9, 0.35], scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(255,240,170,0.45) 0%, transparent 70%)',
                    filter: 'blur(12px)',
                    zIndex: -1,
                  }}
                />
              )}
              <div
                className="text-[10px] tracking-[0.45em] font-black"
                style={{ color: rankColor.to }}
              >
                最 终 名 次
              </div>
              <div
                className="text-[40px] tabular-nums leading-none mt-0.5"
                style={{
                  color: rankColor.to,
                  textShadow: '0 2px 0 rgba(255,255,255,0.45)',
                }}
              >
                {rank}
              </div>
              <div
                className="text-[11px] tracking-[0.35em] font-black mt-0.5"
                style={{ color: rankColor.to }}
              >
                {rankTitle(rank)}
              </div>
              <div
                className="text-[9px] tracking-widest italic mt-0.5"
                style={{ color: `${rankColor.to}99` }}
              >
                共 {total} 雄
              </div>
              {isEliminated && (
                <div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 seal-red font-kai font-black flex items-center justify-center whitespace-nowrap"
                  style={{
                    padding: '1px 8px',
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    borderRadius: 2,
                  }}
                >
                  第 {playerEliminatedAtRound} 年 阵 亡
                </div>
              )}
            </div>
            <span
              className="hidden sm:inline-block h-[2px] flex-1 max-w-[120px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${rankColor.mid}, transparent)`,
              }}
            />
          </motion.div>

          <div className="text-red-900/70 text-xs mb-2 tracking-[0.35em] font-kai">
            最 终 军 势
          </div>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.3, type: 'spring', stiffness: 200 }}
            className="text-6xl sm:text-7xl font-black tabular-nums mb-8 font-kai animate-shine"
          >
            {totalPower}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="grid grid-cols-2 gap-3 mb-8 text-sm"
          >
            <div
              className="relative p-3 text-center"
              style={{
                background:
                  'linear-gradient(180deg, rgba(240,220,180,0.85), rgba(200,170,120,0.8))',
                border: '2px solid #7a5a2c',
                borderRadius: 3,
                boxShadow:
                  'inset 0 1px 0 rgba(255,240,200,0.6), inset 0 -2px 4px rgba(80,50,20,0.3), 0 2px 4px rgba(0,0,0,0.35)',
              }}
            >
              <div className="text-[10px] text-red-900/70 tracking-[0.35em] font-kai font-black">
                余 财
              </div>
              <div className="text-xl font-black text-red-900 tabular-nums mt-1 font-kai">
                🪙 {gold}
              </div>
            </div>
            <div
              className="relative p-3 text-center"
              style={{
                background:
                  'linear-gradient(180deg, rgba(240,220,180,0.85), rgba(200,170,120,0.8))',
                border: '2px solid #7a5a2c',
                borderRadius: 3,
                boxShadow:
                  'inset 0 1px 0 rgba(255,240,200,0.6), inset 0 -2px 4px rgba(80,50,20,0.3), 0 2px 4px rgba(0,0,0,0.35)',
              }}
            >
              <div className="text-[10px] text-red-900/70 tracking-[0.35em] font-kai font-black">
                主 公 府
              </div>
              <div
                className="text-xl font-black tabular-nums mt-1 font-kai"
                style={{
                  background: 'linear-gradient(180deg, #a8753a, #4a2810)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Lv.{recruitLevel}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.55 }}
            className="mb-6 -mx-2 sm:-mx-4"
          >
            <PowerChart
              history={powerHistory}
              currentRound={currentRound}
              currentTotalPower={totalPower}
              isFinished
            />
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7 }}
            whileHover={{ y: -2 }}
            whileTap={{ y: 4 }}
            onClick={onRestart}
            className="btn-seal btn-seal-gold px-10 py-3 tracking-[0.35em] text-base relative overflow-hidden"
          >
            <div className="text-[15px] leading-none">再 开 新 局</div>
            <div className="sweep-sheen" />
          </motion.button>

          <div className="ornament-meander mt-8 opacity-60" />
        </motion.div>

        {/* 下轴承 */}
        <div className="scroll-axis" />
      </motion.div>
    </motion.div>
  );
}
