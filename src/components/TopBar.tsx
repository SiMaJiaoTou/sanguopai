import { motion } from 'framer-motion';

interface Props {
  round: number;
  roundDesc: string;
  redrawsLeft: number;
  totalPower: number;
}

export function TopBar({ round, roundDesc, redrawsLeft, totalPower }: Props) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur border-b border-gold/30">
      <div className="flex items-baseline gap-4">
        <h1 className="text-2xl font-black text-gold-grad tracking-wider">三国 · 将星牌局</h1>
        <span className="text-sm text-white/60">{roundDesc}</span>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-center">
          <div className="text-[11px] text-white/50">当前年份</div>
          <div className="text-xl font-bold text-white">第 {round} 年 / 共 6 年</div>
        </div>

        <div className="text-center">
          <div className="text-[11px] text-white/50">剩余换将令</div>
          <motion.div
            key={redrawsLeft}
            initial={{ scale: 1.3, color: '#fde047' }}
            animate={{ scale: 1, color: '#d4af37' }}
            className="text-2xl font-black"
          >
            ⟳ {redrawsLeft}
          </motion.div>
        </div>

        <div className="text-center">
          <div className="text-[11px] text-white/50">全军战力</div>
          <motion.div
            key={totalPower}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl font-black text-gold-grad tabular-nums"
          >
            {totalPower}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
