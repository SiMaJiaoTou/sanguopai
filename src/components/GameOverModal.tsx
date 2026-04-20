import { motion } from 'framer-motion';

interface Props {
  totalPower: number;
  onRestart: () => void;
}

export function GameOverModal({ totalPower, onRestart }: Props) {
  const rank = totalPower >= 1200 ? '一统天下' : totalPower >= 800 ? '问鼎中原' : totalPower >= 500 ? '割据一方' : '草莽英雄';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
    >
      <motion.div
        initial={{ scale: 0.7, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-[520px] rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-gold shadow-glow p-8 text-center"
      >
        <div className="text-sm text-gold tracking-[8px] mb-2">FINAL · 终局</div>
        <div className="text-4xl font-black text-gold-grad mb-6">{rank}</div>

        <div className="text-white/70 text-sm mb-2">六载征战，最终战力</div>
        <div className="text-6xl font-black text-gold-grad tabular-nums mb-8 animate-shine">
          {totalPower}
        </div>

        <button
          onClick={onRestart}
          className="px-8 py-3 rounded-xl bg-gold text-ink font-bold hover:bg-gold-light transition-colors"
        >
          重开新局
        </button>
      </motion.div>
    </motion.div>
  );
}
