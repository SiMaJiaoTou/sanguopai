import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RANK_TYPES, SUIT_BONUS, POWER_CAP } from '../evaluate';
import { RANK_DESCRIPTIONS, SUIT_BONUS_DESC } from '../handDescriptions';
import type { RankTypeKey } from '../types';

interface Props {
  activeRankKeys?: RankTypeKey[];
  anyFlush?: boolean;
}

const ORDERED: RankTypeKey[] = [
  'FIVE_OF_A_KIND',
  'FOUR_OF_A_KIND',
  'FULL_HOUSE',
  'STRAIGHT',
  'THREE_OF_A_KIND',
  'TWO_PAIR',
  'ONE_PAIR',
  'HIGH_CARD',
];

function jadeTone(s: number): string {
  if (s >= 10) return 'jade-red';
  if (s >= 6) return 'jade-gold';
  return '';
}

export function HandTypeTable({ activeRankKeys = [], anyFlush = false }: Props) {
  const active = new Set(activeRankKeys);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="relative rounded-lg wood-panel bronze-border rivets wood-dark">
      <div className="rivet-b" />

      {/* 卷首：朱砂题签 + 回纹页眉 */}
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="scroll-tag text-[11px]">兵法谱</span>
          <span className="text-[10px] text-amber-200/55 italic tracking-widest hidden sm:inline">
            八阵图鉴
          </span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="btn-wood text-[10px] px-2 py-1"
        >
          {expanded ? '合册 ▴' : '展卷 ▾'}
        </button>
      </div>
      <div className="ornament-meander mb-3" />

      {/* 题辞 · 公式 */}
      <div
        className="text-[11px] text-amber-100/75 mb-4 text-center font-kai tracking-wider px-2 py-1.5"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(139, 90, 40, 0.18) 50%, transparent 100%)',
          borderTop: '1px solid rgba(139, 90, 40, 0.4)',
          borderBottom: '1px solid rgba(139, 90, 40, 0.4)',
        }}
      >
        軍勢 ＝ 武勇和 × (
        <span className="text-gold-grad font-black">阵法</span>
        <span className="mx-0.5 opacity-50">＋</span>
        <span className="text-red-300 font-black">同心</span>
        ) · 封顶 {POWER_CAP}
      </div>

      {/* 乘区一 · 阵法 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="seal-dot" />
        <div className="text-[10px] text-amber-200/80 tracking-[0.35em] font-kai font-black">
          乘 区 一 · 阵 法
        </div>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-amber-600/70 via-amber-700/30 to-transparent" />
      </div>

      {/* 竹简列表 */}
      <div className="space-y-1 mb-4">
        {ORDERED.map((k) => {
          const t = RANK_TYPES[k];
          const desc = RANK_DESCRIPTIONS[k];
          const isActive = active.has(k);
          return (
            <motion.div
              key={k}
              layout
              className={[
                'bamboo-strip relative pr-2.5 py-2 rounded-r-md',
                isActive ? 'active' : '',
              ].join(' ')}
              style={{
                background: isActive
                  ? 'linear-gradient(90deg, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.08) 60%, transparent 100%)'
                  : 'linear-gradient(90deg, rgba(139,90,40,0.08) 0%, transparent 70%)',
                boxShadow: isActive
                  ? 'inset 0 0 18px rgba(212,175,55,0.25)'
                  : 'none',
              }}
              title={desc}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={[
                      'text-[10px] font-kai tabular-nums w-5 text-right',
                      isActive ? 'text-gold-grad font-black' : 'text-amber-200/35',
                    ].join(' ')}
                  >
                    {t.priority}
                  </span>
                  <span
                    className={[
                      'text-sm font-black font-kai tracking-[0.15em]',
                      isActive ? 'text-gold-grad' : 'text-amber-50/90',
                    ].join(' ')}
                  >
                    {t.name}
                  </span>
                  {isActive && (
                    <motion.span
                      initial={{ scale: 0, x: -6 }}
                      animate={{ scale: 1, x: 0 }}
                      className="text-[9px] text-red-200 px-1.5 py-[1px] rounded-sm font-black tracking-widest"
                      style={{
                        background: 'linear-gradient(180deg, #c82828, #5a0808)',
                        border: '1px solid #2a0404',
                        boxShadow: 'inset 0 1px 0 rgba(255,180,160,0.5)',
                        textShadow: '0 1px 1px rgba(0,0,0,0.8)',
                      }}
                    >
                      当前
                    </motion.span>
                  )}
                </div>

                {/* 玉璧倍率 */}
                <div
                  className={`jade-disc ${jadeTone(t.score)}`}
                  style={{
                    width: 30,
                    height: 30,
                    fontSize: 13,
                  }}
                >
                  <span>+{t.score}</span>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {(expanded || isActive) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 6 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div
                      className={[
                        'text-[11px] leading-relaxed pr-2 font-kai',
                        isActive ? 'text-amber-100/90' : 'text-amber-100/55',
                      ].join(' ')}
                      style={{
                        paddingLeft: 2,
                        borderLeft: isActive
                          ? '2px solid rgba(212,175,55,0.5)'
                          : '2px solid rgba(139,90,40,0.25)',
                        marginLeft: 4,
                      }}
                    >
                      <span style={{ paddingLeft: 8, display: 'inline-block' }}>
                        {desc}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* 乘区二 · 同心 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="seal-dot" />
        <div className="text-[10px] text-amber-200/80 tracking-[0.35em] font-kai font-black">
          乘 区 二 · 同 心
        </div>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-amber-600/70 via-amber-700/30 to-transparent" />
      </div>

      <motion.div
        layout
        className={[
          'bamboo-strip relative pr-2.5 py-2 rounded-r-md',
          anyFlush ? 'active' : '',
        ].join(' ')}
        style={{
          background: anyFlush
            ? 'linear-gradient(90deg, rgba(200,40,40,0.22) 0%, rgba(212,175,55,0.12) 60%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(139,90,40,0.08) 0%, transparent 70%)',
          boxShadow: anyFlush ? 'inset 0 0 18px rgba(200,40,40,0.25)' : 'none',
        }}
        title={SUIT_BONUS_DESC}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={[
                'text-sm font-black font-kai tracking-[0.15em]',
                anyFlush ? 'text-red-300' : 'text-amber-50/90',
              ].join(' ')}
            >
              {SUIT_BONUS.FLUSH.name}
            </span>
            {anyFlush && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-[9px] text-red-200 px-1.5 py-[1px] rounded-sm font-black tracking-widest"
                style={{
                  background: 'linear-gradient(180deg, #c82828, #5a0808)',
                  border: '1px solid #2a0404',
                  boxShadow: 'inset 0 1px 0 rgba(255,180,160,0.5)',
                  textShadow: '0 1px 1px rgba(0,0,0,0.8)',
                }}
              >
                当前
              </motion.span>
            )}
          </div>
          <div
            className="jade-disc jade-red"
            style={{ width: 30, height: 30, fontSize: 13 }}
          >
            <span>+{SUIT_BONUS.FLUSH.bonus}</span>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {(expanded || anyFlush) && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 6 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div
                className={[
                  'text-[11px] leading-relaxed pr-2 font-kai',
                  anyFlush ? 'text-amber-100/90' : 'text-amber-100/55',
                ].join(' ')}
                style={{
                  borderLeft: anyFlush
                    ? '2px solid rgba(200,40,40,0.5)'
                    : '2px solid rgba(139,90,40,0.25)',
                  marginLeft: 4,
                }}
              >
                <span style={{ paddingLeft: 8, display: 'inline-block' }}>
                  {SUIT_BONUS_DESC}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="ornament-meander mt-4 mb-2" />
      <div className="text-[10px] text-amber-100/50 leading-relaxed pt-1 italic text-center font-kai">
        范例 · 蜀军同心 · 锥形阵 → 乘区 ( 6 + 5 ) = 11
      </div>
    </div>
  );
}
