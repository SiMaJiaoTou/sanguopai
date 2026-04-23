import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card, Faction } from '../types';
import { FACTION_THEME, HERO_TABLE } from '../data';

interface Props {
  deck: Card[];
}

type Row = {
  value: number;
  label: string;
  faction: Record<Faction, { remaining: string[]; total: number }>;
  totalRemaining: number;
  totalAll: number;
};

/**
 * 牌库查看抽屉：
 * - 右下角常驻按钮；鼠标悬浮/点击都会打开
 * - 弹出右侧抽屉，用表格呈现每个点数 × 每个势力 下剩余武将
 * - 每格显示 "剩余/总数" + 剩余武将名字（逗号分隔，已招走的划掉）
 */
export function DeckDrawer({ deck }: Props) {
  const [open, setOpen] = useState(false);

  const rows = useMemo<Row[]>(() => {
    // 先把剩余 deck 按 (value, faction) 建索引
    const remain = new Map<string, Set<string>>(); // key: `${value}|${faction}` → Set<name>
    for (const c of deck) {
      const k = `${c.pointValue}|${c.faction}`;
      let s = remain.get(k);
      if (!s) {
        s = new Set();
        remain.set(k, s);
      }
      s.add(c.name);
    }

    const list: Row[] = [];
    for (const row of HERO_TABLE) {
      const facMap: Row['faction'] = {
        魏: { remaining: [], total: 0 },
        蜀: { remaining: [], total: 0 },
        吴: { remaining: [], total: 0 },
        群: { remaining: [], total: 0 },
      };
      let totRemain = 0;
      let totAll = 0;
      for (const f of ['魏', '蜀', '吴', '群'] as const) {
        const names = row.heroes[f];
        facMap[f].total = names.length;
        totAll += names.length;
        const remSet = remain.get(`${row.value}|${f}`) ?? new Set<string>();
        facMap[f].remaining = names.filter((n) => remSet.has(n));
        totRemain += facMap[f].remaining.length;
      }
      list.push({
        value: row.value,
        label: row.label,
        faction: facMap,
        totalRemaining: totRemain,
        totalAll: totAll,
      });
    }
    return list;
  }, [deck]);

  const totalRemaining = deck.length;

  return (
    <>
      {/* 触发按钮 —— 固定在右下角（避开 GM 令牌按钮），支持 hover 与 click */}
      {/* 注意：外层 div 负责 fixed 定位；内层 btn-seal 的 position:relative 不能放在 fixed 元素上 */}
      <div
        className="fixed z-30"
        style={{ bottom: 20, right: 80 }}
      >
        <button
          onMouseEnter={() => setOpen(true)}
          onClick={() => setOpen(true)}
          className="btn-seal btn-seal-gold px-4 py-2.5 font-kai tracking-[0.25em] text-sm"
          title="查看剩余牌库（悬浮或点击）"
        >
          <span className="mr-1">📜</span>
          <span className="text-[13px]">查看牌库</span>
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-black/40 text-gold-grad tabular-nums font-black">
            {totalRemaining}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* 背景蒙层：点击关闭 */}
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
              onMouseLeave={() => setOpen(false)}
              className="fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[640px] overflow-hidden flex flex-col"
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
                    牌库剩余武将（按点数/势力）
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
                  凡{' '}
                  <span className="text-gold-grad font-black tabular-nums">
                    {totalRemaining}
                  </span>{' '}
                  /{' '}
                  <span className="text-amber-200/60 tabular-nums">
                    {rows.reduce((s, r) => s + r.totalAll, 0)}
                  </span>{' '}
                  员可招
                </span>
                <span className="text-[10px] text-amber-200/55 italic">
                  · 玩家与诸侯共享 ·
                </span>
              </div>

              {/* 表格本体 */}
              <div className="flex-1 overflow-auto px-3 py-3">
                <table
                  className="w-full border-collapse font-kai"
                  style={{ tableLayout: 'fixed' }}
                >
                  <colgroup>
                    <col style={{ width: 64 }} />
                    <col />
                    <col />
                    <col />
                    <col />
                    <col style={{ width: 56 }} />
                  </colgroup>
                  <thead>
                    <tr
                      className="text-[10px] text-amber-200/80 tracking-widest"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(90,58,28,0.85) 0%, rgba(42,26,16,0.95) 100%)',
                      }}
                    >
                      <th className="py-2 px-2 text-center border-b-2 border-amber-900/70 sticky top-0 z-[1]">
                        点数
                      </th>
                      {(['魏', '蜀', '吴', '群'] as const).map((f) => (
                        <th
                          key={f}
                          className={`py-2 px-2 text-center border-b-2 border-amber-900/70 sticky top-0 z-[1] ${FACTION_THEME[f].accent}`}
                        >
                          {f}
                        </th>
                      ))}
                      <th className="py-2 px-2 text-center border-b-2 border-amber-900/70 sticky top-0 z-[1]">
                        合计
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const empty = r.totalRemaining === 0;
                      return (
                        <tr
                          key={r.value}
                          className={empty ? 'opacity-40' : ''}
                          style={{
                            background:
                              idx % 2 === 0
                                ? 'rgba(58,36,24,0.35)'
                                : 'rgba(26,15,8,0.5)',
                          }}
                        >
                          {/* 点数格 */}
                          <td className="align-middle text-center py-2 px-1 border-b border-amber-900/30">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="jade-seal w-7 h-7 flex items-center justify-center text-[11px] font-black"
                                style={{ letterSpacing: 0 }}
                              >
                                {r.label}
                              </span>
                              <span className="text-[9px] text-amber-200/55 tabular-nums">
                                战力 {r.value}
                              </span>
                            </div>
                          </td>
                          {/* 四个势力的格 */}
                          {(['魏', '蜀', '吴', '群'] as const).map((f) => {
                            const cell = r.faction[f];
                            const allOut = cell.total > 0 && cell.remaining.length === 0;
                            return (
                              <td
                                key={f}
                                className="align-top py-1.5 px-1.5 border-b border-amber-900/30"
                                style={{
                                  background: allOut
                                    ? 'rgba(40,20,10,0.55)'
                                    : 'transparent',
                                }}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <div
                                    className={`text-[10px] tabular-nums font-black ${
                                      cell.remaining.length === 0
                                        ? 'text-amber-200/35'
                                        : 'text-gold-grad'
                                    }`}
                                  >
                                    {cell.remaining.length}/{cell.total}
                                  </div>
                                  <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                                    {cell.remaining.length === 0 ? (
                                      <span className="text-[10px] text-amber-200/25 italic">
                                        —
                                      </span>
                                    ) : (
                                      cell.remaining.map((name) => (
                                        <span
                                          key={name}
                                          className="text-[10.5px] text-amber-100/90 leading-tight"
                                          style={{
                                            letterSpacing: '0.04em',
                                          }}
                                        >
                                          {name}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                          {/* 合计 */}
                          <td className="align-middle text-center py-2 px-1 border-b border-amber-900/30">
                            <span
                              className={`text-[11px] tabular-nums font-black ${
                                empty
                                  ? 'text-amber-200/30'
                                  : r.totalRemaining === r.totalAll
                                    ? 'text-emerald-300'
                                    : 'text-gold-grad'
                              }`}
                            >
                              {r.totalRemaining}/{r.totalAll}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* 合计行 */}
                  <tfoot>
                    <tr
                      className="text-[11px] tabular-nums"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(58,36,24,0.85) 0%, rgba(26,15,8,0.95) 100%)',
                      }}
                    >
                      <td className="py-2 px-2 text-center text-amber-200/80 tracking-widest border-t-2 border-amber-900/60 font-black">
                        合计
                      </td>
                      {(['魏', '蜀', '吴', '群'] as const).map((f) => {
                        const rem = rows.reduce(
                          (s, r) => s + r.faction[f].remaining.length,
                          0,
                        );
                        const tot = rows.reduce(
                          (s, r) => s + r.faction[f].total,
                          0,
                        );
                        return (
                          <td
                            key={f}
                            className="py-2 px-2 text-center border-t-2 border-amber-900/60"
                          >
                            <span
                              className={`font-black ${FACTION_THEME[f].accent}`}
                            >
                              {rem}/{tot}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-center border-t-2 border-amber-900/60 text-gold-grad font-black">
                        {totalRemaining}/
                        {rows.reduce((s, r) => s + r.totalAll, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-5 py-3 text-[10px] text-amber-200/55 italic text-center font-kai border-t border-amber-900/60">
                · 本牌库由主公与诸侯共享 · 先招者得 · 空格为该势力无可招之人 ·
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
