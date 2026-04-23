import type { Card, HorseSeal } from './types';

export interface HorseSealInfo {
  key: HorseSeal;
  name: string;        // 神马名
  sealName: string;    // 印章名 / 定位
  color: string;       // 主色（#rgb）
  sealChar: string;    // 印章上的汉字
  effect: string;      // 短描述（2-3 行）
  trigger: string;     // 触发时机
  detail: string;      // 详细机制说明
}

export const HORSE_SEALS: Record<HorseSeal, HorseSealInfo> = {
  dilu: {
    key: 'dilu',
    name: '的卢马',
    sealName: '红印 · 核心双发',
    color: '#ef4444',
    sealChar: '的',
    effect: '参与计分时，基础武勇额外触发一次',
    trigger: '上阵 · 参与计分结算',
    detail:
      '当该武将在场并参与结算时，其勇武值会被二次计算，相当于该武将的武勇值翻倍计入【武勇和】。',
  },
  jueying: {
    key: 'jueying',
    name: '绝影马',
    sealName: '金印 · 经济引擎',
    color: '#f59e0b',
    sealChar: '绝',
    effect: '参与计分时，+3 金',
    trigger: '上阵 · 参与计分结算',
    detail:
      '当该武将在场参与结算时，回合结束立刻获得 3 金币。多张绝影同阵可叠加。',
  },
  chitu: {
    key: 'chitu',
    name: '赤兔马',
    sealName: '紫印 · 资源转换',
    color: '#a855f7',
    sealChar: '赤',
    effect: '被换掉时 +1 免费换牌',
    trigger: '换将时',
    detail:
      '每当你把这张武将换出牌库（免费或付费），立刻获得 +1 次免费换牌次数。',
  },
  bailong: {
    key: 'bailong',
    name: '白龙马',
    sealName: '蓝印 · 战备积蓄',
    color: '#3b82f6',
    sealChar: '白',
    effect: '留在手牌中 → 阵法倍率 +1',
    trigger: '结算时 · 留守手牌',
    detail:
      '如果该武将在本回合结算时处于手牌（未出战），为本回合所有军团的阵法倍率 +1。多张可叠加。',
  },
  dawan: {
    key: 'dawan',
    name: '大宛马',
    sealName: '青印 · 阵前发力',
    color: '#06b6d4',
    sealChar: '宛',
    effect: '上阵参与计分时 → 阵法倍率 +1',
    trigger: '上阵 · 参与计分结算',
    detail:
      '该武将在场并参与结算时，为所在队伍的阵法倍率 +1。多张可叠加。',
  },
};

/**
 * 在初始牌库中随机把 20 张武将打上神马印记（均匀覆盖 5 种）
 * 返回新的牌库（不影响原数组）
 */
export function applyRandomHorseSeals(deck: Card[], count = 20): Card[] {
  if (count <= 0) return deck;
  const n = Math.min(count, deck.length);
  // Fisher-Yates 取前 n
  const indices = Array.from({ length: deck.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const picked = indices.slice(0, n);
  const sealKeys: HorseSeal[] = ['dilu', 'jueying', 'chitu', 'bailong', 'dawan'];
  // 尽量均匀分配：先按顺序每种 n/5 张，多出的随机
  const assigns: HorseSeal[] = [];
  const per = Math.floor(n / sealKeys.length);
  for (const k of sealKeys) {
    for (let i = 0; i < per; i++) assigns.push(k);
  }
  // 余量
  while (assigns.length < n) {
    assigns.push(sealKeys[Math.floor(Math.random() * sealKeys.length)]);
  }
  // 再洗一次
  for (let i = assigns.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [assigns[i], assigns[j]] = [assigns[j], assigns[i]];
  }

  const newDeck = deck.slice();
  for (let i = 0; i < picked.length; i++) {
    const idx = picked[i];
    const c = newDeck[idx];
    newDeck[idx] = { ...c, horseSeal: assigns[i] };
  }
  return newDeck;
}
