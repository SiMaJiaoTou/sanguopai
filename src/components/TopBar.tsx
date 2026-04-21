import { motion } from 'framer-motion';

interface Props {
  round: number;
  roundDesc: string;
  freeRedrawsLeft: number;
  gold: number;
  recruitLevel: number;
  recruitExp: number;
  expNeed: number;
  totalPower: number;
}

export function TopBar({
  round,
  roundDesc,
  freeRedrawsLeft,
  gold,
  recruitLevel,
  recruitExp,
  expNeed,
  totalPower,
}: Props) {
  const expPercent =
    expNeed === Infinity || expNeed === 0 ? 100 : Math.min(100, (recruitExp / expNeed) * 100);
  const isMax = recruitLevel >= 6;

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-black/50 backdrop-blur border-b border-gold/30 gap-3 flex-wrap sticky top-0 z-40">
      <div className="flex items-baseline gap-3 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-black text-gold-grad tracking-wider">
          三国 · 将星牌局
        </h1>
        <span className="text-xs sm:text-sm text-white/60 hidden md:inline">{roundDesc}</span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
        {/* 年份 */}
        <div className="text-center">
          <div className="text-[10px] text-white/50">年份</div>
          <div className="text-sm sm:text-lg font-bold text-white">
            第 {round} / 6 年
          </div>
        </div>

        {/* 金币 */}
        <div className="text-center">
          <div className="text-[10px] text-white/50">金币</div>
          <motion.div
            key={gold}
            initial={{ scale: 1.3, color: '#fde047' }}
            animate={{ scale: 1, color: '#fbbf24' }}
            className="text-lg sm:text-xl font-black flex items-center gap-1 justify-center"
          >
            🪙 <span className="tabular-nums">{gold}</span>
          </motion.div>
        </div>

        {/* 招募等级 + 经验条 */}
        <div className="text-center min-w-[110px]">
          <div className="text-[10px] text-white/50">
            主公府 <span className="text-gold">Lv.{recruitLevel}</span>
            {isMax && <span className="ml-1 text-red-300">MAX</span>}
          </div>
          <div className="h-2 w-full rounded-full bg-black/60 overflow-hidden border border-white/10 mt-1">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-300 via-gold to-amber-600"
              initial={{ width: 0 }}
              animate={{ width: `${expPercent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="text-[9px] text-white/40 mt-0.5 tabular-nums">
            {isMax ? 'MAX' : `${recruitExp}/${expNeed} exp`}
          </div>
        </div>

        {/* 换将令 */}
        <div className="text-center">
          <div className="text-[10px] text-white/50">免费换将</div>
          <motion.div
            key={freeRedrawsLeft}
            initial={{ scale: 1.3, color: '#fde047' }}
            animate={{ scale: 1, color: '#d4af37' }}
            className="text-lg sm:text-xl font-black"
          >
            ⟳ {freeRedrawsLeft}
          </motion.div>
        </div>

        {/* 全军战力 */}
        <div className="text-center">
          <div className="text-[10px] text-white/50">全军战力</div>
          <motion.div
            key={totalPower}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-xl sm:text-2xl font-black text-gold-grad tabular-nums"
          >
            {totalPower}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
