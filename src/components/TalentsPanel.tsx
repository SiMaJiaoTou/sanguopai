import { motion } from 'framer-motion';
import type { TalentInstance } from '../talents';

interface Props {
  talents: TalentInstance[];
  mode: 'normal' | 'empowered';
  doubleThisRoundActive: boolean;
}

/**
 * 天赐能力展示窗口（右侧栏）：
 * - 标准模式下只显示"未启用"提示
 * - 加强模式下列出已获得的天赐（带类型徽记、彩色描边）
 */
export function TalentsPanel({ talents, mode, doubleThisRoundActive }: Props) {
  const passives = talents.filter((t) => t.kind === 'passive');
  const oneshots = talents.filter((t) => t.kind === 'oneshot');

  return (
    <div className="relative rounded-lg wood-panel bronze-border rivets wood-dark">
      <div className="rivet-b" />
      <div className="flex items-center justify-between mb-2 ink-underline relative">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-base">㊉</span>
          <div className="text-gold-grad font-black tracking-[0.25em] font-kai">
            天 赐 谱
          </div>
        </div>
        <div className="text-[10px] text-amber-100/60 italic">
          {mode === 'empowered' ? (
            <>
              凡{' '}
              <span className="text-gold-grad tabular-nums font-black">
                {talents.length}
              </span>{' '}
              赐
            </>
          ) : (
            '未启用'
          )}
        </div>
      </div>

      {mode === 'normal' && (
        <div className="text-[11px] text-amber-200/55 italic font-kai text-center py-4 leading-relaxed">
          · 本局为标准模式 ·<br />
          未开启天赐系统
        </div>
      )}

      {mode === 'empowered' && talents.length === 0 && (
        <div className="text-[11px] text-amber-200/55 italic font-kai text-center py-4 leading-relaxed">
          · 尚未获得天赐 ·<br />
          第 2、4 年将显天命
        </div>
      )}

      {mode === 'empowered' && talents.length > 0 && (
        <div className="space-y-2">
          {[...passives, ...oneshots].map((t) => {
            const willConsumeNow =
              t.kind === 'oneshot' && doubleThisRoundActive &&
              t.templateId === 'double_this_round';
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative flex items-start gap-2.5 p-2.5 rounded"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(42,26,16,0.8) 0%, rgba(26,15,8,0.6) 100%)',
                  border: `1.5px solid ${t.accent}66`,
                  boxShadow: `inset 0 1px 0 rgba(255,220,180,0.08), 0 0 6px ${t.accent}22`,
                }}
              >
                {/* 图标徽章 */}
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full text-base"
                  style={{
                    width: 32,
                    height: 32,
                    background: `radial-gradient(circle at 30% 25%, ${t.accent}88 0%, ${t.accent}33 55%, transparent 90%)`,
                    border: `1.5px solid ${t.accent}`,
                    boxShadow: `0 0 6px ${t.accent}66`,
                  }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span
                      className="font-kai font-black tracking-widest text-[13px]"
                      style={{
                        background: `linear-gradient(180deg, #fff5cc 0%, ${t.accent} 70%, #6b4a10 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {t.name}
                    </span>
                    <span
                      className="text-[9px] tracking-widest font-black"
                      style={{
                        color: t.accent,
                        padding: '1px 5px',
                        border: `1px solid ${t.accent}88`,
                        borderRadius: 2,
                      }}
                    >
                      {t.kind === 'passive' ? '永续' : '一次'}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-100/75 leading-snug font-kai tracking-wider">
                    {t.description}
                  </div>
                </div>
                {willConsumeNow && (
                  <motion.span
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="absolute top-1 right-1 text-[9px] font-kai font-black tracking-widest"
                    style={{ color: t.accent }}
                  >
                    本年 ✦
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
