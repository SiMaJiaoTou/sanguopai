import { motion } from 'framer-motion';

interface Props {
  totalPower: number;
  gold: number;
  recruitLevel: number;
  onRestart: () => void;
}

export function GameOverModal({ totalPower, gold, recruitLevel, onRestart }: Props) {
  // 新战力上限为每队 803，双队最大 1606；调整评级标准
  const rank =
    totalPower >= 1500
      ? '一统天下'
      : totalPower >= 1100
        ? '问鼎中原'
        : totalPower >= 700
          ? '割据一方'
          : totalPower >= 400
            ? '小有声望'
            : '草莽英雄';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-4"
    >
      <motion.div
        initial={{ scale: 0.7, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-full max-w-[520px] rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-gold shadow-glow p-6 sm:p-8 text-center"
      >
        <div className="text-sm text-gold tracking-[8px] mb-2">FINAL · 终局</div>
        <div className="text-3xl sm:text-4xl font-black text-gold-grad mb-6">{rank}</div>

        <div className="text-white/70 text-sm mb-2">六载征战，最终战力</div>
        <div className="text-5xl sm:text-6xl font-black text-gold-grad tabular-nums mb-6 animate-shine">
          {totalPower}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
          <div className="rounded-lg bg-black/40 border border-white/10 py-3">
            <div className="text-[11px] text-white/50">余财金币</div>
            <div className="text-xl font-black text-amber-300">🪙 {gold}</div>
          </div>
          <div className="rounded-lg bg-black/40 border border-white/10 py-3">
            <div className="text-[11px] text-white/50">主公府等级</div>
            <div className="text-xl font-black text-gold">Lv.{recruitLevel}</div>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="px-8 py-3 rounded-xl bg-gold text-ink font-bold hover:bg-gold-light transition-colors touch-manipulation"
        >
          重开新局
        </button>
      </motion.div>
    </motion.div>
  );
}
