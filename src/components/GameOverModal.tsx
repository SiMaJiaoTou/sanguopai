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
      ? '一 统 天 下'
      : totalPower >= 1100
        ? '问 鼎 中 原'
        : totalPower >= 700
          ? '割 据 一 方'
          : totalPower >= 400
            ? '小 有 声 望'
            : '草 莽 英 雄';

  const epitaph =
    totalPower >= 1500
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
        className="relative w-full max-w-[560px]"
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
            {rank}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.15 }}
            className="text-[12px] text-red-900/65 italic mb-7 tracking-[0.15em] font-kai"
          >
            —— {epitaph} ——
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
