import type { Card, EvaluateResult, HandType, HandTypeKey } from './types';

/**
 * 14 种牌型定义 —— 严格按 PRD 倍率表 (2.3)
 */
export const HAND_TYPES: Record<HandTypeKey, HandType> = {
  FIVE_OF_A_KIND:    { key: 'FIVE_OF_A_KIND',    name: '五条',       multiplier: 20, priority: 1 },
  FLUSH_FULL_HOUSE:  { key: 'FLUSH_FULL_HOUSE',  name: '同花葫芦',   multiplier: 20, priority: 2 },
  STRAIGHT_FLUSH:    { key: 'STRAIGHT_FLUSH',    name: '同花顺',     multiplier: 20, priority: 3 },
  FLUSH_THREE:       { key: 'FLUSH_THREE',       name: '同花三条',   multiplier: 15, priority: 4 },
  FOUR_OF_A_KIND:    { key: 'FOUR_OF_A_KIND',    name: '四条',       multiplier: 15, priority: 5 },
  FLUSH_TWO_PAIR:    { key: 'FLUSH_TWO_PAIR',    name: '同花两对',   multiplier: 12, priority: 6 },
  FLUSH_ONE_PAIR:    { key: 'FLUSH_ONE_PAIR',    name: '同花一对',   multiplier: 10, priority: 7 },
  FULL_HOUSE:        { key: 'FULL_HOUSE',        name: '葫芦',       multiplier: 10, priority: 8 },
  FLUSH_HIGH:        { key: 'FLUSH_HIGH',        name: '同花散牌',   multiplier: 8,  priority: 9 },
  STRAIGHT:          { key: 'STRAIGHT',          name: '顺子',       multiplier: 8,  priority: 10 },
  THREE_OF_A_KIND:   { key: 'THREE_OF_A_KIND',   name: '三条',       multiplier: 6,  priority: 11 },
  TWO_PAIR:          { key: 'TWO_PAIR',          name: '两对',       multiplier: 4,  priority: 12 },
  ONE_PAIR:          { key: 'ONE_PAIR',          name: '一对',       multiplier: 2,  priority: 13 },
  HIGH_CARD:         { key: 'HIGH_CARD',         name: '散牌',       multiplier: 1,  priority: 14 },
};

/**
 * 判定是否为顺子
 * 点数范围：3~15 (2=15, A=14, K=13, Q=12, J=11, 3~10=3~10)
 * 规则：5 张互不相同且点数连续。
 * 特别处理 A-2-3-4-5 对应的"环形顺子"：
 *   因为 A=14, 2=15, 其余最小是 3，所以自然形成 3-4-5-14-15 的两头；
 *   按 PRD 未显式说明，这里只接受严格连续，即 desc 后差值全为 1。
 *   额外允许把 2(15) 当作紧接 A(14) 之后 —— 自然就是 11-12-13-14-15 (J-Q-K-A-2) 最大顺子，已连续，天然支持。
 */
function isStraight(sortedDescValues: number[]): boolean {
  // 必须 5 张不重复
  const unique = new Set(sortedDescValues);
  if (unique.size !== 5) return false;
  for (let i = 0; i < 4; i++) {
    if (sortedDescValues[i] - sortedDescValues[i + 1] !== 1) return false;
  }
  return true;
}

/** 统计同点数频率，降序返回，如 [3,2] / [4,1] / [2,2,1] / [3,1,1] / [2,1,1,1] / [1,1,1,1,1] */
function getCountsDesc(cards: Card[]): number[] {
  const map = new Map<number, number>();
  for (const c of cards) {
    map.set(c.pointValue, (map.get(c.pointValue) ?? 0) + 1);
  }
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
 * @param cards 必须正好 5 张
 */
export function evaluateHand(cards: Card[]): EvaluateResult | null {
  if (!cards || cards.length !== 5) return null;

  // 1. 按 pointValue 降序排序（拷贝，避免污染入参）
  const sorted = cards.slice().sort((a, b) => b.pointValue - a.pointValue);
  const values = sorted.map((c) => c.pointValue);

  // 2. 统计
  const counts = getCountsDesc(sorted);
  const flush = isFlush(sorted);
  const straight = isStraight(values);
  const pointSum = values.reduce((s, v) => s + v, 0);

  // 3. 严格按优先级匹配
  let handType: HandType;

  if (countsEq(counts, [5])) {
    // 五条
    handType = HAND_TYPES.FIVE_OF_A_KIND;
  } else if (flush && countsEq(counts, [3, 2])) {
    handType = HAND_TYPES.FLUSH_FULL_HOUSE;
  } else if (flush && straight) {
    handType = HAND_TYPES.STRAIGHT_FLUSH;
  } else if (flush && countsEq(counts, [3, 1, 1])) {
    handType = HAND_TYPES.FLUSH_THREE;
  } else if (countsEq(counts, [4, 1])) {
    handType = HAND_TYPES.FOUR_OF_A_KIND;
  } else if (flush && countsEq(counts, [2, 2, 1])) {
    handType = HAND_TYPES.FLUSH_TWO_PAIR;
  } else if (flush && countsEq(counts, [2, 1, 1, 1])) {
    handType = HAND_TYPES.FLUSH_ONE_PAIR;
  } else if (countsEq(counts, [3, 2])) {
    handType = HAND_TYPES.FULL_HOUSE;
  } else if (flush && countsEq(counts, [1, 1, 1, 1, 1]) && !straight) {
    handType = HAND_TYPES.FLUSH_HIGH;
  } else if (straight) {
    // 非同花顺子
    handType = HAND_TYPES.STRAIGHT;
  } else if (countsEq(counts, [3, 1, 1])) {
    handType = HAND_TYPES.THREE_OF_A_KIND;
  } else if (countsEq(counts, [2, 2, 1])) {
    handType = HAND_TYPES.TWO_PAIR;
  } else if (countsEq(counts, [2, 1, 1, 1])) {
    handType = HAND_TYPES.ONE_PAIR;
  } else {
    handType = HAND_TYPES.HIGH_CARD;
  }

  return {
    handType,
    pointSum,
    power: pointSum * handType.multiplier,
  };
}
