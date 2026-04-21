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

  const yearCn = ['初', '一', '二', '三', '四', '五', '六'][round] ?? String(round);

  return (
    <div
      className={[
        'sticky top-0 z-40 px-3 sm:px-6 py-3',
        'bg-gradient-to-b from-[#1a0f08] via-[#14100a] to-[#0b0807]',
        'border-b-2 border-gold/40',
        'shadow-[0_4px_20px_rgba(0,0,0,0.7)]',
        'flex items-center justify-between gap-3 flex-wrap',
      ].join(' ')}
    >
      {/* 顶部金色细纹装饰 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

      {/* 左侧：标题 + 朱砂印章 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <motion.div
          initial={{ scale: 2, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 180, delay: 0.2 }}
          className="seal-red w-10 h-10 text-base hidden sm:flex"
        >
          将
        </motion.div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gold-grad tracking-[0.3em] leading-none">
            三 國 將 星
          </h1>
          <div className="text-[10px] text-amber-200/50 tracking-widest mt-0.5 hidden sm:block">
            · 牌 局 演 義 ·
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-4 text-xs text-amber-100/50 italic">
          <span className="text-red-400 text-lg">㊉</span>
          <span>{roundDesc}</span>
        </div>
      </div>

      {/* 右侧：数据栏 */}
      <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-end">
        {/* 年份（书法） */}
        <StatCell label="年份">
          <div className="flex items-baseline gap-0.5 text-gold-grad">
            <span className="text-lg sm:text-2xl font-black font-kai">{yearCn}</span>
            <span className="text-[10px] text-amber-200/60">/ 六</span>
          </div>
        </StatCell>

        <Divider />

        {/* 金币 */}
        <StatCell label="金 币">
          <motion.div
            key={gold}
            initial={{ scale: 1.3, color: '#fde047' }}
            animate={{ scale: 1, color: '#fbbf24' }}
            className="text-base sm:text-xl font-black flex items-center gap-1 justify-center"
          >
            <span className="text-yellow-300">🪙</span>
            <span className="tabular-nums">{gold}</span>
          </motion.div>
        </StatCell>

        <Divider />

        {/* 主公府 + 经验条 */}
        <StatCell label={`主公府 · Lv.${recruitLevel}${isMax ? ' (满)' : ''}`}>
          <div className="w-[100px] sm:w-[120px]">
            <div className="h-1.5 w-full rounded-full bg-black/70 overflow-hidden border border-amber-900/40">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600"
                initial={{ width: 0 }}
                animate={{ width: `${expPercent}%` }}
                transition={{ duration: 0.4 }}
                style={{
                  boxShadow: '0 0 4px rgba(251,191,36,0.6)',
                }}
              />
            </div>
            <div className="text-[9px] text-amber-200/50 mt-0.5 tabular-nums text-center">
              {isMax ? '—— MAX ——' : `${recruitExp} / ${expNeed} exp`}
            </div>
          </div>
        </StatCell>

        <Divider />

        {/* 换将令 */}
        <StatCell label="免费换将">
          <motion.div
            key={freeRedrawsLeft}
            initial={{ scale: 1.3, color: '#fde047' }}
            animate={{ scale: 1, color: '#d4af37' }}
            className="text-base sm:text-xl font-black flex items-center gap-1 justify-center"
          >
            <span>⟳</span>
            <span className="tabular-nums">{freeRedrawsLeft}</span>
          </motion.div>
        </StatCell>

        <Divider />

        {/* 全军战力 */}
        <StatCell label="全军战力" emphasis>
          <motion.div
            key={totalPower}
            initial={{ y: -8, opacity: 0, scale: 1.2 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="text-xl sm:text-2xl font-black text-gold-grad tabular-nums"
          >
            {totalPower}
          </motion.div>
        </StatCell>
      </div>
    </div>
  );
}

function StatCell({
  label,
  children,
  emphasis,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={`text-center ${emphasis ? 'min-w-[70px]' : ''}`}>
      <div
        className={[
          'text-[9px] tracking-[0.2em]',
          emphasis ? 'text-gold' : 'text-amber-200/55',
        ].join(' ')}
      >
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Divider() {
  return (
    <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-amber-700/40 to-transparent" />
  );
}
