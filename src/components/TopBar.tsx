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
        'sticky top-0 z-40 px-3 sm:px-6 py-3 wood-dark',
        'border-b-4 border-amber-900',
        'flex items-center justify-between gap-3 flex-wrap',
      ].join(' ')}
      style={{
        boxShadow:
          '0 4px 12px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,200,120,0.25), inset 0 -4px 8px rgba(0,0,0,0.4)',
      }}
    >
      {/* 顶部青铜金属条 */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background:
            'linear-gradient(90deg, #4a2e18 0%, #a8753a 20%, #d4af37 50%, #a8753a 80%, #4a2e18 100%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      />

      {/* 左侧标题 */}
      <div className="flex items-center gap-3 flex-shrink-0 relative">
        <motion.div
          initial={{ scale: 2, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 180, delay: 0.2 }}
          className="seal-red w-11 h-11 text-base hidden sm:flex flex-shrink-0"
        >
          將
        </motion.div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gold-grad tracking-[0.3em] leading-none font-kai">
            三 國 將 星
          </h1>
          <div className="text-[10px] text-amber-200/60 tracking-[0.4em] mt-1 hidden sm:block">
            · 牌 局 演 義 ·
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-4 text-xs text-amber-100/70 italic">
          <span className="text-red-500 text-base">㊉</span>
          <span>{roundDesc}</span>
        </div>
      </div>

      {/* 右侧数据栏 */}
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
        <StatCell label="年份">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl sm:text-2xl font-black font-kai text-gold-grad">
              {yearCn}
            </span>
            <span className="text-[10px] text-amber-200/60">/ 六</span>
          </div>
        </StatCell>

        <Divider />

        <StatCell label="金 幣">
          <motion.div
            key={gold}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-xl font-black flex items-center gap-1 justify-center text-amber-200 font-kai"
          >
            <span className="text-yellow-300">🪙</span>
            <span className="tabular-nums">{gold}</span>
          </motion.div>
        </StatCell>

        <Divider />

        <StatCell label={`主公府 Lv.${recruitLevel}${isMax ? '·滿' : ''}`}>
          <div className="w-[110px] sm:w-[130px]">
            <div
              className="h-2 w-full rounded-full overflow-hidden border border-amber-900"
              style={{
                background: '#1a0f08',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              <motion.div
                className="h-full"
                initial={{ width: 0 }}
                animate={{ width: `${expPercent}%` }}
                transition={{ duration: 0.4 }}
                style={{
                  background: 'linear-gradient(180deg, #fde68a 0%, #d4af37 40%, #8b6914 100%)',
                  boxShadow: '0 0 6px rgba(251,191,36,0.7), inset 0 1px 0 rgba(255,245,200,0.5)',
                }}
              />
            </div>
            <div className="text-[9px] text-amber-200/60 mt-1 tabular-nums text-center">
              {isMax ? '━━ MAX ━━' : `${recruitExp} / ${expNeed} 威望`}
            </div>
          </div>
        </StatCell>

        <Divider />

        <StatCell label="免费换将">
          <motion.div
            key={freeRedrawsLeft}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-xl font-black flex items-center gap-1 justify-center text-gold-grad font-kai"
          >
            <span>⟳</span>
            <span className="tabular-nums">{freeRedrawsLeft}</span>
          </motion.div>
        </StatCell>

        <Divider />

        <StatCell label="全軍戰力" emphasis>
          <motion.div
            key={totalPower}
            initial={{ y: -8, opacity: 0, scale: 1.2 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="text-xl sm:text-2xl font-black text-gold-grad tabular-nums font-kai"
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
          'text-[9px] tracking-[0.2em] font-kai',
          emphasis ? 'text-gold-grad font-black' : 'text-amber-200/70',
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
    <div
      className="hidden sm:block h-10 w-[2px]"
      style={{
        background:
          'linear-gradient(180deg, transparent 0%, #8b5a28 20%, #d4af37 50%, #8b5a28 80%, transparent 100%)',
      }}
    />
  );
}
