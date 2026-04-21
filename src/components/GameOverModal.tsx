import { motion } from 'framer-motion';

interface Props {
  totalPower: number;
  gold: number;
  recruitLevel: number;
  onRestart: () => void;
}

export function GameOverModal({ totalPower, gold, recruitLevel, onRestart }: Props) {
  const rank =
    totalPower >= 1500
      ? '一 統 天 下'
      : totalPower >= 1100
        ? '問 鼎 中 原'
        : totalPower >= 700
          ? '割 據 一 方'
          : totalPower >= 400
            ? '小 有 聲 望'
            : '草 莽 英 雄';

  const epitaph =
    totalPower >= 1500
      ? '四海归一，万民臣服 · 千秋伟业终成！'
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur p-4"
    >
      <motion.div
        initial={{ scale: 0.7, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className={[
          'relative w-full max-w-[520px] rounded-2xl',
          'bg-gradient-to-b from-[#3b2816] via-[#1f1208] to-[#0b0807]',
          'border-2 border-gold shadow-glow p-6 sm:p-10 text-center scroll-paper',
        ].join(' ')}
      >
        {/* 四角装饰 */}
        <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-gold rounded-tl-xl" />
        <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-gold rounded-tr-xl" />
        <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-gold rounded-bl-xl" />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-gold rounded-br-xl" />

        {/* 朱砂大印 */}
        <motion.div
          initial={{ scale: 3, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 0.9, rotate: -8 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 180 }}
          className="absolute top-4 right-4 seal-red w-14 h-14 text-sm flex-col"
        >
          <div>终</div>
          <div>局</div>
        </motion.div>

        <div className="text-[10px] text-gold/70 tracking-[1em] mb-1">CHRONICLE</div>
        <div className="text-[10px] text-amber-200/60 tracking-[0.5em] mb-4">· 史 册 ·</div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl sm:text-5xl font-black text-gold-grad mb-2 font-kai tracking-[0.3em]"
        >
          {rank}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-[11px] text-amber-200/60 italic mb-6 tracking-wider"
        >
          —— {epitaph} ——
        </motion.div>

        <div className="text-amber-200/60 text-xs mb-2 tracking-widest">六 載 征 戰 · 最 終 戰 力</div>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.9, type: 'spring', stiffness: 200 }}
          className="text-6xl sm:text-7xl font-black text-gold-grad tabular-nums mb-6 animate-shine font-kai"
        >
          {totalPower}
        </motion.div>

        <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
          <div className="rounded-lg bg-black/40 border border-amber-800/50 py-3 px-2">
            <div className="text-[10px] text-amber-200/50 tracking-widest">余 财</div>
            <div className="text-xl font-black text-amber-300 tabular-nums mt-1">🪙 {gold}</div>
          </div>
          <div className="rounded-lg bg-black/40 border border-amber-800/50 py-3 px-2">
            <div className="text-[10px] text-amber-200/50 tracking-widest">主 公 府</div>
            <div className="text-xl font-black text-gold tabular-nums mt-1">Lv.{recruitLevel}</div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onRestart}
          className={[
            'px-10 py-3 rounded-xl font-bold touch-manipulation tracking-[0.3em] font-kai',
            'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800',
            'border-2 border-gold/70 text-ink shadow-glow',
            'hover:brightness-110',
          ].join(' ')}
        >
          再 开 新 局
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
