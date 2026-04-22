import type { Card, EvaluateResult, RankTypeKey } from './types';

/**
 * 点数牌型（乘区 1，互斥取最高）
 * 按 PRD-Revision 1.2 严格定义
 */
export const RANK_TYPES: Record<
  RankTypeKey,
  { key: RankTypeKey; name: string; score: number; priority: number }
> = {
  FIVE_OF_A_KIND:  { key: 'FIVE_OF_A_KIND',  name: '一字阵',   score: 12, priority: 1 },
  FOUR_OF_A_KIND:  { key: 'FOUR_OF_A_KIND',  name: '雁行阵',   score: 9,  priority: 2 },
  FULL_HOUSE:      { key: 'FULL_HOUSE',      name: '锥形阵',   score: 6,  priority: 3 },
  STRAIGHT:        { key: 'STRAIGHT',        name: '长蛇阵',   score: 7,  priority: 4 },
  THREE_OF_A_KIND: { key: 'THREE_OF_A_KIND', name: '鹤翼阵',   score: 4,  priority: 5 },
  TWO_PAIR:        { key: 'TWO_PAIR',        name: '方圆阵',   score: 3,  priority: 6 },
  ONE_PAIR:        { key: 'ONE_PAIR',        name: '锋矢阵',   score: 2,  priority: 7 },
  HIGH_CARD:       { key: 'HIGH_CARD',       name: '散阵',     score: 1,  priority: 8 },
};

/** 阵营同心附加值（叠加项） */
export const SUIT_BONUS = {
  FLUSH: { key: 'FLUSH' as const, name: '阵营同心', bonus: 5 },
  NONE: { key: 'NONE' as const, name: '未同心', bonus: 0 },
};

/** 顺子判定：5 张互不相同且点数连续 */
function isStraight(sortedDescValues: number[]): boolean {
  const unique = new Set(sortedDescValues);
  if (unique.size !== 5) return false;
  for (let i = 0; i < 4; i++) {
    if (sortedDescValues[i] - sortedDescValues[i + 1] !== 1) return false;
  }
  return true;
}

function getCountsDesc(cards: Card[]): number[] {
  const map = new Map<number, number>();
  for (const c of cards) map.set(c.pointValue, (map.get(c.pointValue) ?? 0) + 1);
  return Array.from(map.values()).sort((a, b) => b - a);
}

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.faction === cards[0].faction);
}

function countsEq(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * 核心评估函数
 * 战力 = pointSum × (rankScore + suitBonus)（无封顶）
 */
export function evaluateHand(cards: Card[]): EvaluateResult | null {
  if (!cards || cards.length !== 5) return null;

  const sorted = cards.slice().sort((a, b) => b.pointValue - a.pointValue);
  const values = sorted.map((c) => c.pointValue);
  const counts = getCountsDesc(sorted);
  const flush = isFlush(sorted);
  const straight = isStraight(values);
  const pointSum = values.reduce((s, v) => s + v, 0);

  // 点数牌型（互斥取最高）
  let rankType = RANK_TYPES.HIGH_CARD;
  if (countsEq(counts, [5])) rankType = RANK_TYPES.FIVE_OF_A_KIND;
  else if (countsEq(counts, [4, 1])) rankType = RANK_TYPES.FOUR_OF_A_KIND;
  else if (countsEq(counts, [3, 2])) rankType = RANK_TYPES.FULL_HOUSE;
  else if (straight) rankType = RANK_TYPES.STRAIGHT;
  else if (countsEq(counts, [3, 1, 1])) rankType = RANK_TYPES.THREE_OF_A_KIND;
  else if (countsEq(counts, [2, 2, 1])) rankType = RANK_TYPES.TWO_PAIR;
  else if (countsEq(counts, [2, 1, 1, 1])) rankType = RANK_TYPES.ONE_PAIR;

  const suitBonus = flush ? SUIT_BONUS.FLUSH.bonus : SUIT_BONUS.NONE.bonus;
  const multiplier = rankType.score + suitBonus;
  const rawPower = pointSum * multiplier;

  return {
    rankType,
    suitBonus,
    isFlush: flush,
    multiplier,
    pointSum,
    rawPower,
    power: rawPower,
    capped: false,
  };
}
