import type { RankTypeKey } from './types';

/**
 * 点数牌型的一句话说明
 * 注：花色（同花）作为叠加项单独展示，不在此列
 */
export const RANK_DESCRIPTIONS: Record<RankTypeKey, string> = {
  FIVE_OF_A_KIND:
    '五将同点 · 5 张点数完全相同，三国至尊牌型，万中无一',
  FOUR_OF_A_KIND:
    '四将同点 · 4 张点数相同 + 1 张单牌，四虎同阵、锋芒毕露',
  FULL_HOUSE:
    '葫芦（三带二）· 3 同点 + 2 同点，混编兵团，核心稳固',
  STRAIGHT:
    '顺子 · 5 张点数连续，列阵推进、循序而战',
  THREE_OF_A_KIND:
    '三条 · 3 同点 + 2 张散牌，三人成众，初具雏形',
  TWO_PAIR:
    '两对 · 2 对同点 + 1 张散牌，双将辅佐，略有可观',
  ONE_PAIR:
    '一对 · 1 对同点 + 3 张散牌，仅得一将之助，聊胜于无',
  HIGH_CARD:
    '散牌（高牌）· 5 张互不相同，一盘散沙',
};

export const SUIT_BONUS_DESC =
  '同花 · 5 张牌全来自同一阵营（魏/蜀/吴/群），额外 +5 附加值';
