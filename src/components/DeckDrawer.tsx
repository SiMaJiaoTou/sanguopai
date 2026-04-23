import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card, Faction } from '../types';
import { FACTION_THEME } from '../data';

interface Props {
  deck: Card[];
}

/**
 * 牌库查看抽屉：
 * - 右下角一个可折叠的按钮 "📜 查看牌库"
 * - 点击弹出右侧竖直抽屉，按点数降序分组，每组列出势力数量
 */
export function DeckDrawer({ deck }: Props) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    // 按点数分组
    const map = new Map<number, { label: string; faction: Record<Faction, Card[]> }>();
    for (const c of deck) {
      let entry = map.get(c.pointValue);
      if (!entry) {
        entry = {
          label: c.pointLabel,
          faction: { 魏: [], 蜀: [], 吴: [], 群: [] },
        };
        map.set(c.pointValue, entry);
      }
      entry.faction[c.faction].push(c);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([value, entry]) => ({
        value,
        label: entry.label,
        total:
          entry.faction['魏'].length +
          entry.faction['蜀'].length +
          entry.faction['吴'].length +
          entry.faction['群'].length,
        faction: entry.faction,
      }));
  }, [deck]);

  const totalRemaining = deck.length;

  return (
    <>
      {/* 触发按钮 —— 固定在右下 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 btn-seal btn-seal-gold px-4 py-2.5 font-kai tracking-[0.25em] text-sm"
        title="查看剩余牌库"
      >
        <span className="mr-1">📜</span>
        <span className="text-[13px]">查看牌库</span>
        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-black/40 text-gold-grad tabular-nums font-black">
          {totalRemaining}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* 背景蒙层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* 抽屉本体 */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[420px] overflow-hidden flex flex-col"
              style={{
                background:
                  'linear-gradient(180deg, #2a1810 0%, #1a0f08 100%)',
                borderLeft: '3px solid #8b5a28',
                boxShadow: '-4px 0 20px rgba(0,0,0,0.7)',
              }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-amber-900/60 wood-dark">
                <div className="flex items-center gap-2">
                  <span className="scroll-tag text-[11px]">兵 籍 册</span>
                  <span className="text-[10px] text-amber-200/55 italic tracking-widest hidden sm:inline">
                    牌库剩余武将
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="btn-wood text-xs px-3 py-1.5"
                >
                  关 闭
                </button>
              </div>

              <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-amber-900/40">
                <span className="text-[11px] text-amber-100/70 font-kai tracking-widest">
                  凡 <span className="text-gold-grad font-black tabular-nums">{totalRemaining}</span> 员可招
                </span>
                <span className="text-[10px] text-amber-200/55 italic">
                  · 玩家与诸侯共享 ·
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                {grouped.length === 0 && (
                  <div className="text-center text-amber-200/50 text-sm italic font-kai py-8">
                    · 牌库空空，无人可招 ·
                  </div>
                )}
                {grouped.map((g) => (
                  <div
                    key={g.value}
                    className="rounded-md border border-amber-900/50"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(58,36,24,0.5) 0%, rgba(26,15,8,0.75) 100%)',
                    }}
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/40">
                      <div className="flex items-center gap-2">
                        <span
                          className="jade-seal text-[11px] w-7 h-7 flex items-center justify-center"
                          style={{ letterSpacing: 0 }}
                        >
                          {g.label}
                        </span>
                        <span className="text-[11px] text-amber-200/70 tracking-widest font-kai">
                          战力 <span className="text-gold-grad tabular-nums font-black">{g.value}</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-100/70 tabular-nums font-kai font-black">
                        {g.total} 员
                      </span>
                    </div>

                    <div className="px-2 py-2 space-y-1">
                      {(['魏', '蜀', '吴', '群'] as const).map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-kai font-black ${FACTION_THEME[f].accent}`}
                            style={{
                              minWidth: 22,
                              textAlign: 'center',
                              background: 'rgba(20,10,4,0.55)',
                              border: '1px solid rgba(139,90,40,0.55)',
                            }}
                          >
                            {f}
                          </span>
                          <span className="text-[10px] text-amber-100/50 tabular-nums font-kai mr-1">
                            ×{g.faction[f].length}
                          </span>
                          <span className="text-[11px] text-amber-100/80 truncate flex-1 font-kai">
                            {g.faction[f].map((c) => c.name).join(' · ') || (
                              <span className="text-amber-200/30 italic">— 已招空 —</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 text-[10px] text-amber-200/55 italic text-center font-kai border-t border-amber-900/60">
                · 本牌库由玩家与诸侯共享 · 招募先得先得 ·
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
