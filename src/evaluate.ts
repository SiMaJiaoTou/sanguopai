import type { Card, EvaluateResult, RankTypeKey } from './types';
import type { EvalContext } from './talents';
import { adjustedPointValue, hasThreeBrothers } from './talents';

/**
 * 点数牌型（乘区 1，互斥取最高）
 * 按 PRD-Revision 1.2 严格定义
 */
export const RANK_TYPES: Record<
  RankTypeKey,
  { key: RankTypeKey; name: string; score: number; priority: number }
> = {
  FIVE_OF_A_KIND:  { key: 'FIVE_OF_A_KIND',  name: '一字阵',   score: 10, priority: 1 },
  FOUR_OF_A_KIND:  { key: 'FOUR_OF_A_KIND',  name: '雁行阵',   score: 8,  priority: 2 },
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

/** 经典 5 张顺子：互不相同且点数连续 */
function isStraight(sortedDescValues: number[]): boolean {
  const unique = new Set(sortedDescValues);
  if (unique.size !== 5) return false;
  for (let i = 0; i < 4; i++) {
    if (sortedDescValues[i] - sortedDescValues[i + 1] !== 1) return false;
  }
  return true;
}

/** 长蛇速成：5 张里存在 4 张互不相同且连续的点数 */
function hasFourStraight(sortedDescValues: number[]): boolean {
  // 去重后的不同点数
  const unique = Array.from(new Set(sortedDescValues)).sort((a, b) => b - a);
  if (unique.length < 4) return false;
  for (let i = 0; i + 3 < unique.length; i++) {
    if (
      unique[i] - unique[i + 1] === 1 &&
      unique[i + 1] - unique[i + 2] === 1 &&
      unique[i + 2] - unique[i + 3] === 1
    ) {
      return true;
    }
  }
  return false;
}

function getCountsDesc(cards: Card[]): number[] {
  const map = new Map<number, number>();
  for (const c of cards) map.set(c.pointValue, (map.get(c.pointValue) ?? 0) + 1);
  return Array.from(map.values()).sort((a, b) => b - a);
}

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.faction === cards[0].faction);
}

/**
 * 核心评估函数
 * 战力 = pointSum × (rankScore + suitBonus)（无封顶）
 * 阵法检测基于已放置卡牌的组合：只要满足对应的"对子/三条/顺子"等条件即触发，
 * 不再强制要求 5 张。pointSum 与阵营同心依据实际张数：
 *  - pointSum：所有已放卡牌的调整后点数之和
 *  - flush（阵营同心）：仍要求 5 张且同阵营（narrative 上"5 员同心"）
 *  - straight（长蛇阵）：仍要求 5 张连号（4 张速成由 shortStraight 天赐控制）
 * @param cards 已放置的武将（1 ≤ 长度 ≤ 5）
 * @param ctx 天赐被动上下文（可选）
 */
export function evaluateHand(
  cards: Card[],
  ctx?: EvalContext,
): EvaluateResult | null {
  if (!cards || cards.length === 0) return null;

  const n = cards.length;
  // 阵法判定仍按原始 pointValue（桃园结义不影响点数关系）
  const sorted = cards.slice().sort((a, b) => b.pointValue - a.pointValue);
  const values = sorted.map((c) => c.pointValue);
  const counts = getCountsDesc(sorted);
  // 阵营同心仍要求 5 张同阵营（narrative："5 员将领同属一阵营"）
  const rawFlush = n === 5 && isFlush(sorted);
  const flush = rawFlush && !(ctx?.disableFlush ?? false);
  // 经典长蛇：5 张连号；速成长蛇（shortStraight 天赐）：任意 4 张连号
  const classicStraight = n >= 5 && isStraight(values);
  const shortStraight =
    ctx?.shortStraight && n >= 4 && hasFourStraight(values);
  const straight = classicStraight || !!shortStraight;

  // 勇武和采用经天赐调整过的 pointValue
  let pointSum = cards.reduce((s, c) => s + adjustedPointValue(c, ctx), 0);
  // 散金养士：每 1 金 → +2 基础勇武（队伍基础）
  if (ctx?.goldToProwess) {
    pointSum += (ctx.goldForBonus ?? 0) * 2;
  }

  // ---- 阵法互斥取最高 ----
  // 仅根据 counts（各点数出现次数）判定，不再用 totalCards === 5 做闸
  const maxCount = counts[0] ?? 0;
  const pairGroups = counts.filter((c) => c >= 2).length;

  let rankType = RANK_TYPES.HIGH_CARD;
  if (maxCount >= 5) rankType = RANK_TYPES.FIVE_OF_A_KIND;
  else if (maxCount >= 4) rankType = RANK_TYPES.FOUR_OF_A_KIND;
  else if (maxCount >= 3 && pairGroups >= 2) rankType = RANK_TYPES.FULL_HOUSE;
  else if (straight) rankType = RANK_TYPES.STRAIGHT;
  else if (maxCount >= 3) rankType = RANK_TYPES.THREE_OF_A_KIND;
  else if (pairGroups >= 2) rankType = RANK_TYPES.TWO_PAIR;
  else if (maxCount >= 2) rankType = RANK_TYPES.ONE_PAIR;

  // 阵法倍率（天赐可叠加）
  const rankScoreExtra = ctx?.rankBonusExtra[rankType.key] ?? 0;
  // 【大宛马】：该队伍中每张参与计分的大宛马，阵法倍率 +1
  const dawanCount = cards.filter((c) => c.horseSeal === 'dawan').length;
  // 【白龙马】：留在手牌的数量由外部 ctx 传入
  const bailongCount = ctx?.bailongInHand ?? 0;
  const effectiveRankScore =
    rankType.score + rankScoreExtra + dawanCount + bailongCount;

  const suitBonus = flush
    ? SUIT_BONUS.FLUSH.bonus + (ctx?.flushBonusExtra ?? 0)
    : SUIT_BONUS.NONE.bonus;
  const multiplier = effectiveRankScore + suitBonus;
  let rawPower = pointSum * multiplier;

  // 桃园结义：队伍同时含 关羽/刘备/张飞 → 翻倍
  if (hasThreeBrothers(cards)) {
    rawPower *= 2;
  }

  return {
    rankType: {
      ...rankType,
      score: effectiveRankScore,
    },
    suitBonus,
    isFlush: flush,
    multiplier,
    pointSum,
    rawPower,
    power: rawPower,
    capped: false,
  };
}
