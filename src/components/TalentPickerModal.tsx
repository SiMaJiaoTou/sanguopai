import { motion } from 'framer-motion';
import type { TalentInstance } from '../talents';

interface Props {
  round: number;
  choices: TalentInstance[];
  onPick: (talentId: string) => void;
}

export function TalentPickerModal({ round, choices, onPick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(20,10,4,0.9) 0%, rgba(0,0,0,0.96) 100%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[1280px] my-auto"
      >
        <div className="text-center mb-6">
          <div className="text-[11px] text-amber-200/65 tracking-[0.6em] font-kai mb-2">
            第 {round} 年 · 天 命 显 征
          </div>
          <div
            className="text-3xl sm:text-4xl font-black font-kai tracking-[0.3em]"
            style={{
              background:
                'linear-gradient(180deg, #fff5cc 0%, #f7d57a 40%, #d4af37 70%, #6b4a10 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.75))',
            }}
          >
            请 五 择 其 一
          </div>
          <div className="text-[11px] text-amber-200/55 italic mt-2 font-kai">
            · 天赐一经选定，永随本局，影响结算 ·
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {choices.map((t, i) => (
            <TalentCard
              key={t.id}
              talent={t}
              delay={0.1 + i * 0.07}
              onPick={onPick}
            />
          ))}
        </div>

        {choices.length === 0 && (
          <div className="text-center text-amber-200/60 italic font-kai py-6">
            · 天道无为，暂无可择之赐 ·
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * 单张天赐卡 —— 使用纯 CSS transform 做 hover 动效，
 * 避免 framer-motion 的 layout 重排导致 hover 卡顿
 */
function TalentCard({
  talent: t,
  delay,
  onPick,
}: {
  talent: TalentInstance;
  delay: number;
  onPick: (id: string) => void;
}) {
  // 独立 class 避免多张卡的样式冲突
  const cls = `talent-card-${t.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <motion.button
      initial={{ y: 30, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 180 }}
      onClick={() => onPick(t.id)}
      className={`${cls} relative p-4 rounded-lg text-left font-kai overflow-hidden`}
      style={{
        background:
          'linear-gradient(180deg, #2a1810 0%, #1a0f08 100%)',
        border: `2px solid ${t.accent}`,
        boxShadow: `0 0 18px ${t.accent}55, 0 8px 20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,240,200,0.22)`,
        // 注意：使用 transform 不会触发 layout 重排
        transition:
          'transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s',
        willChange: 'transform',
        cursor: 'pointer',
        minHeight: 230,
      }}
    >
      {/* 光晕 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: `radial-gradient(ellipse at top, ${t.accent}55 0%, transparent 65%)`,
        }}
      />

      {/* 顶部图标 + 类型 */}
      <div className="relative flex items-start justify-between mb-2">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 40,
            height: 40,
            fontSize: 20,
            background: `radial-gradient(circle at 30% 25%, ${t.accent}88 0%, ${t.accent}44 50%, transparent 85%)`,
            border: `2px solid ${t.accent}`,
            boxShadow: `0 0 8px ${t.accent}77`,
          }}
        >
          {t.icon}
        </div>
        <span
          className="text-[9px] tracking-[0.3em] uppercase font-black"
          style={{
            color: t.accent,
            padding: '2px 6px',
            border: `1px solid ${t.accent}88`,
            borderRadius: 3,
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          {t.kind === 'passive'
            ? '永续'
            : t.kind === 'instant'
              ? '即效'
              : '一次'}
        </span>
      </div>

      {/* 名字 */}
      <div
        className="relative text-[17px] sm:text-lg font-black tracking-[0.22em] mb-2 leading-tight"
        style={{
          color: '#fff',
          background: `linear-gradient(180deg, #fff5cc 0%, ${t.accent} 70%, #6b4a10 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 0 6px ${t.accent}aa)`,
        }}
      >
        {t.name}
      </div>

      {/* 描述 */}
      <div className="relative text-[11.5px] text-amber-100/85 leading-relaxed tracking-wider">
        {t.description}
      </div>

      {/* 选择按钮提示 */}
      <div className="relative mt-3 text-center">
        <span
          className="inline-block text-[11px] tracking-[0.35em] font-black px-3 py-1"
          style={{
            color: t.accent,
            border: `1px solid ${t.accent}`,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 3,
          }}
        >
          择 此
        </span>
      </div>

      <style>{`
        .${cls}:hover {
          transform: translateY(-6px) scale(1.03);
          box-shadow:
            0 0 26px ${t.accent}99,
            0 14px 28px rgba(0,0,0,0.85),
            inset 0 1px 0 rgba(255,240,200,0.3);
        }
        .${cls}:active {
          transform: translateY(-2px) scale(0.99);
        }
      `}</style>
    </motion.button>
  );
}
