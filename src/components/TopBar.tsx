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
        'sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-2 wood-dark',
        'border-b-[3px] border-amber-900',
        'flex items-center justify-between gap-3 flex-wrap relative',
      ].join(' ')}
      style={{
        boxShadow:
          '0 6px 16px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,200,120,0.3), inset 0 -5px 10px rgba(0,0,0,0.45)',
      }}
    >
      {/* 顶部青铜金属条 + 云雷纹 */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background:
            'linear-gradient(90deg, #4a2e18 0%, #a8753a 20%, #f7d57a 50%, #a8753a 80%, #4a2e18 100%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      />
      {/* 底部墨色金丝线 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.55) 20%, rgba(255,245,200,0.75) 50%, rgba(212,175,55,0.55) 80%, transparent 100%)',
        }}
      />

      {/* 左侧标题 */}
      <div className="flex items-center gap-3 flex-shrink-0 relative">
        <motion.div
          initial={{ scale: 2, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 180, delay: 0.2 }}
          className="seal-red w-12 h-12 text-lg hidden sm:flex flex-shrink-0 font-kai"
          style={{ letterSpacing: 0 }}
        >
          將
        </motion.div>
        <div>
          <h1
            className="text-xl sm:text-[26px] font-black text-gold-grad tracking-[0.3em] leading-none font-kai"
            style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.7), 0 0 18px rgba(212,175,55,0.25)',
            }}
          >
            三 国 将 星
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="hidden sm:block ornament-clouds flex-1 max-w-[80px]" />
            <span className="text-[10px] text-amber-200/70 tracking-[0.55em] hidden sm:inline font-kai">
              牌 局 演 义
            </span>
            <span className="hidden sm:block ornament-clouds flex-1 max-w-[80px]" />
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-4 text-xs text-amber-100/75 italic font-kai">
          <span className="seal-dot" />
          <span className="tracking-wider">{roundDesc}</span>
        </div>
      </div>

      {/* 右侧数据栏 */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <StatCell label="年 份">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl sm:text-2xl font-black font-kai text-gold-grad">
              {yearCn}
            </span>
            <span className="text-[10px] text-amber-200/60">／六</span>
          </div>
        </StatCell>

        <Divider />

        <StatCell label="金 币">
          <motion.div
            key={gold}
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-xl font-black flex items-center gap-1 justify-center text-amber-200 font-kai"
          >
            <span className="text-yellow-300">🪙</span>
            <span className="tabular-nums">{gold}</span>
          </motion.div>
        </StatCell>

        <Divider />

        <StatCell label={`主公府 Lv.${recruitLevel}${isMax ? ' ·满' : ''}`}>
          <div className="w-[110px] sm:w-[130px]">
            <div
              className="relative h-2 w-full rounded-full overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #0a0604 0%, #1f120a 100%)',
                border: '1px solid #3a2414',
                boxShadow:
                  'inset 0 1px 2px rgba(0,0,0,0.95), 0 1px 0 rgba(255,200,120,0.1)',
              }}
            >
              <motion.div
                className="h-full"
                initial={{ width: 0 }}
                animate={{ width: `${expPercent}%` }}
                transition={{ duration: 0.45 }}
                style={{
                  background:
                    'linear-gradient(180deg, #fff2cc 0%, #f7d57a 30%, #d4af37 60%, #8b5a28 100%)',
                  boxShadow:
                    '0 0 8px rgba(212,175,55,0.85), inset 0 1px 0 rgba(255,245,200,0.65)',
                }}
              />
            </div>
            <div className="text-[9px] text-amber-200/65 mt-1 tabular-nums text-center tracking-wider">
              {isMax ? '━ MAX ━' : `${recruitExp} / ${expNeed} 望`}
            </div>
          </div>
        </StatCell>

        <Divider />

        <StatCell label="免 费 换 将">
          <motion.div
            key={freeRedrawsLeft}
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-xl font-black flex items-center gap-1 justify-center text-gold-grad font-kai"
          >
            <span>⟳</span>
            <span className="tabular-nums">{freeRedrawsLeft}</span>
          </motion.div>
        </StatCell>

        <Divider />

        <StatCell label="全 军 军 势" emphasis>
          <motion.div
            key={totalPower}
            initial={{ y: -8, opacity: 0, scale: 1.25 }}
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
    <div
      className={[
        'text-center relative px-1.5',
        emphasis ? 'min-w-[72px]' : '',
      ].join(' ')}
    >
      <div
        className={[
          'text-[9px] tracking-[0.3em] font-kai leading-none mb-0.5',
          emphasis ? 'text-gold-grad font-black' : 'text-amber-200/75',
        ].join(' ')}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="hidden sm:block bronze-divider" />;
}
