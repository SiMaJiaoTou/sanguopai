import type { RankTypeKey } from './types';

/**
 * 阵法（点数牌型）的一句话说明 —— 全部采用三国阵法/武勇语境
 * 注：阵营同心（原"同花"）作为叠加项单独展示，不在此列
 */
export const RANK_DESCRIPTIONS: Record<RankTypeKey, string> = {
  FIVE_OF_A_KIND:
    '一字阵 · 5名同力猛将化作一字长龙，横向突进，阵法倍率 x10',
  FOUR_OF_A_KIND:
    '方圆阵 · 4人列阵镇守正四方，1个散牌居中调度，阵法倍率 x8',
  FULL_HOUSE:
    '衡轭阵 · 2同牌前排并肩突击，3同牌后排横列压阵，阵法倍率 x6',
  STRAIGHT:
    '雁行阵 · 力量循序渐进，如大雁斜飞般梯次排开，阵法倍率 x5',
  THREE_OF_A_KIND:
    '锋矢阵 · 3同牌构成锐利的>形箭头，2散牌拖后微微散落，阵法倍率 x4',
  TWO_PAIR:
    '偃月阵 · 两对武将对称成弯月角，散牌居中心，阵法倍率 x3',
  ONE_PAIR:
    '双锋阵 · 1对同牌化作双锋并列突进，后方散兵游勇跟随，阵法倍率 x2',
  HIGH_CARD:
    '散阵 · 杂乱无章，各自为战，阵法倍率 x1',
};

export const SUIT_BONUS_DESC =
  '阵营同心 · 5 员将领同属一阵营（魏／蜀／吴／群），旌旗同挥、万众一心，额外 +5 加成';
