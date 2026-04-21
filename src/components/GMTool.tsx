import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  onGrantGold: (amount: number) => void;
  onMaxLevel?: () => void;
  onFillHand?: () => void;
}

const GOLD_TIERS = [
  { amount: 10,  label: '小额打赏', icon: '🪙', desc: '+10 金币' },
  { amount: 50,  label: '封赏',     icon: '💰', desc: '+50 金币' },
  { amount: 200, label: '大赏',     icon: '🏆', desc: '+200 金币' },
  { amount: 1000, label: '国库',     icon: '🗄', desc: '+1000 金币' },
  { amount: 9999, label: '富甲天下', icon: '👑', desc: '+9999 金币' },
];

export function GMTool({ onGrantGold, onMaxLevel, onFillHand }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 悬浮触发图标 —— 固定右下 */}
      <motion.button
        whileHover={{ scale: 1.08, rotate: 8 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className={[
          'fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full',
          'flex items-center justify-center text-lg',
          'lacquer-red border-2 border-amber-900',
          'shadow-[0_4px_12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,180,140,0.4)]',
          'select-none',
        ].join(' ')}
        style={{
          textShadow: '0 1px 2px rgba(0,0,0,0.7)',
        }}
        title="GM 工具（开发调试）"
      >
        <span className="font-kai font-black text-amber-100 tracking-widest">令</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* 背景遮罩（点击关闭） */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
            >
              {/* 弹出面板（居中，点面板本身不关闭） */}
              <motion.div
                initial={{ opacity: 0, scale: 0.7, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                onClick={(e) => e.stopPropagation()}
                className={[
                  'relative z-50 w-full max-w-[340px] max-h-[90vh] overflow-y-auto',
                  'rounded-lg wood-panel bronze-border rivets wood-dark',
                ].join(' ')}
              >
                <div className="rivet-b" />

                <div className="flex items-center justify-between mb-3 ink-underline">
                  <div className="flex items-center gap-2">
                    <div className="seal-red w-7 h-7 text-xs">令</div>
                    <div className="text-gold-grad font-black tracking-[0.25em] font-kai text-base">
                      天 降 令 牌
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-amber-200/60 hover:text-gold text-lg leading-none w-7 h-7 flex items-center justify-center rounded border border-amber-900 hover:border-gold bg-black/40"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-[10px] text-amber-100/50 italic mb-3 text-center">
                  ◈ GM 调试工具 · 测试用 ◈
                </div>

                {/* 金币档位 */}
                <div className="space-y-2">
                  {GOLD_TIERS.map((tier) => (
                    <button
                      key={tier.amount}
                      onClick={() => {
                        onGrantGold(tier.amount);
                      }}
                      className={[
                        'btn-wood w-full text-left flex items-center gap-3 py-2 px-3',
                        'hover:brightness-110',
                      ].join(' ')}
                    >
                      <span className="text-2xl leading-none flex-shrink-0">{tier.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black tracking-widest">{tier.label}</div>
                        <div className="text-[10px] text-amber-200/70 tabular-nums">
                          {tier.desc}
                        </div>
                      </div>
                      <span className="text-gold-grad text-lg font-black">＋</span>
                    </button>
                  ))}
                </div>

                {/* 其它作弊项 */}
                {(onMaxLevel || onFillHand) && (
                  <>
                    <div className="my-3 h-px bg-gradient-to-r from-transparent via-amber-700 to-transparent" />
                    <div className="space-y-2">
                      {onMaxLevel && (
                        <button
                          onClick={onMaxLevel}
                          className="btn-wood w-full text-left flex items-center gap-3 py-2 px-3"
                        >
                          <span className="text-2xl leading-none">👑</span>
                          <div className="flex-1">
                            <div className="text-sm font-black tracking-widest">主公晋升</div>
                            <div className="text-[10px] text-amber-200/70">直升 Lv.6 · 满级</div>
                          </div>
                        </button>
                      )}
                      {onFillHand && (
                        <button
                          onClick={onFillHand}
                          className="btn-wood w-full text-left flex items-center gap-3 py-2 px-3"
                        >
                          <span className="text-2xl leading-none">🎲</span>
                          <div className="flex-1">
                            <div className="text-sm font-black tracking-widest">天降奇兵</div>
                            <div className="text-[10px] text-amber-200/70">免费招募 5 员武将</div>
                          </div>
                        </button>
                      )}
                    </div>
                  </>
                )}

                <div className="mt-3 pt-2 border-t border-amber-900 text-[10px] text-amber-100/40 italic text-center">
                  · 此乃测试之令 · 正式对弈请关之 ·
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
