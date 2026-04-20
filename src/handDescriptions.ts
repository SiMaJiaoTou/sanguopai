import type { HandTypeKey } from './types';

/**
 * 每种牌型的一句话说明（游戏内提示文案）
 * 说明含义：这个牌型「长什么样」+「为什么值这个倍率」
 */
export const HAND_DESCRIPTIONS: Record<HandTypeKey, string> = {
  FIVE_OF_A_KIND:
    '五将同点 · 5 张点数完全相同（如 5 张 A），三国至尊牌型，万中无一',
  FLUSH_FULL_HOUSE:
    '同阵三带二 · 同一阵营中 3 同点 + 2 同点，将星云集、同心同德',
  STRAIGHT_FLUSH:
    '同阵连珠 · 同一阵营 5 张点数连续，势如破竹的连环兵阵',
  FLUSH_THREE:
    '同阵三条 · 同一阵营中 3 同点 + 2 张散牌，三英合璧之势',
  FOUR_OF_A_KIND:
    '四将同点 · 4 张点数相同 + 1 张单牌，四虎同阵，锋芒毕露',
  FLUSH_TWO_PAIR:
    '同阵双对 · 同一阵营 2 对 + 1 散，双璧辉映、旗鼓相当',
  FLUSH_ONE_PAIR:
    '同阵一对 · 同一阵营 1 对 + 3 散，同袍双将，小有声势',
  FULL_HOUSE:
    '葫芦（三带二）· 3 同点 + 2 同点，混编兵团，核心稳固',
  FLUSH_HIGH:
    '同阵散牌 · 同一阵营 5 张点数互不相同，全军同色而无链',
  STRAIGHT:
    '顺子 · 5 张点数连续（不同阵营），列阵推进、循序而战',
  THREE_OF_A_KIND:
    '三条 · 3 同点 + 2 张散牌，三人成众，初具雏形',
  TWO_PAIR:
    '两对 · 2 对同点 + 1 张散牌，双将辅佐，略有可观',
  ONE_PAIR:
    '一对 · 1 对同点 + 3 张散牌，仅得一将之助，聊胜于无',
  HIGH_CARD:
    '散牌（高牌）· 5 张皆不相同、非同阵营、无连续，一盘散沙',
};
