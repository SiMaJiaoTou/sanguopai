import { motion } from 'framer-motion';

interface Props {
  onChoose: (mode: 'normal' | 'empowered') => void;
}

export function ModeSelectionModal({ onChoose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(20,10,4,0.9) 0%, rgba(0,0,0,0.96) 100%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <motion.div
        initial={{ scaleY: 0.08, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative w-full max-w-[720px]"
        style={{ transformOrigin: 'center' }}
      >
        <div className="scroll-axis" />

        <div
          className="relative parchment px-6 sm:px-10 py-8 sm:py-12"
          style={{
            borderLeft: '3px solid #5a3a1c',
            borderRight: '3px solid #5a3a1c',
            boxShadow:
              'inset 0 0 60px rgba(100,60,20,0.25), inset 0 0 120px rgba(70,40,10,0.18)',
          }}
        >
          <div className="ornament-meander mb-3 opacity-60" />

          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <div className="text-[10px] text-red-900/65 tracking-[1em] font-kai font-black mb-1">
              天 命 启 示
            </div>
            <div
              className="text-3xl sm:text-4xl font-black font-kai tracking-[0.35em] mb-2"
              style={{
                background: 'linear-gradient(180deg, #7a1818 0%, #3a0404 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              请择乾坤
            </div>
            <div className="text-[11px] text-red-900/55 italic tracking-[0.2em] font-kai mb-8">
              —— 是否接受天赐加持 ——
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
          >
            <ModeCard
              kind="normal"
              title="标 准 模 式"
              subtitle="循章而战"
              desc={['所有规则按原版进行', '公平纯粹的策略对决']}
              onChoose={onChoose}
              accent="#8b6914"
            />
            <ModeCard
              kind="empowered"
              title="威 力 加 强"
              subtitle="天命所归"
              desc={[
                '第 2、4 年开局可五选一天赐',
                '天赐永久生效，层层累加',
                '强度显著提升，节奏更刺激',
              ]}
              onChoose={onChoose}
              accent="#d4af37"
              recommended
            />
          </motion.div>

          <div className="text-[10px] text-red-900/55 italic text-center font-kai">
            · 一经选定，本局不可更改 ·
          </div>
          <div className="ornament-meander mt-6 opacity-60" />
        </div>

        <div className="scroll-axis" />
      </motion.div>
    </motion.div>
  );
}

function ModeCard({
  kind,
  title,
  subtitle,
  desc,
  onChoose,
  accent,
  recommended,
}: {
  kind: 'normal' | 'empowered';
  title: string;
  subtitle: string;
  desc: string[];
  onChoose: (mode: 'normal' | 'empowered') => void;
  accent: string;
  recommended?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ y: 2, scale: 0.99 }}
      onClick={() => onChoose(kind)}
      className="relative text-left p-5 rounded-md font-kai"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,240,210,0.85) 0%, rgba(230,200,155,0.85) 100%)',
        border: `2px solid ${accent}`,
        boxShadow:
          'inset 0 1px 0 rgba(255,240,200,0.6), inset 0 -2px 4px rgba(80,50,20,0.3), 0 4px 10px rgba(0,0,0,0.45)',
      }}
    >
      {recommended && (
        <span
          className="absolute -top-2 -right-2 seal-red flex items-center justify-center"
          style={{
            width: 38,
            height: 38,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0,
            fontFamily: 'STKaiti, serif',
          }}
        >
          荐
        </span>
      )}
      <div className="text-[10px] text-red-900/55 tracking-[0.35em] mb-1">
        {subtitle}
      </div>
      <div
        className="text-xl font-black tracking-[0.3em] mb-3"
        style={{
          background: `linear-gradient(180deg, ${accent} 0%, #3a0404 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {title}
      </div>
      <ul className="space-y-1">
        {desc.map((d, i) => (
          <li
            key={i}
            className="text-[11.5px] text-red-900/75 leading-relaxed tracking-wider flex gap-1.5"
          >
            <span className="text-amber-700">◆</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </motion.button>
  );
}
