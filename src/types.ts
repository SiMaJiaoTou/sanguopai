// 核心数据类型定义

export type Faction = '魏' | '蜀' | '吴' | '群';

export type PointLabel =
  | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  id: string;
  faction: Faction;
  pointLabel: PointLabel;
  pointValue: number; // 3~10, J=11, Q=12, K=13, A=14, 2=15
  name: string;
}

/** 点数牌型（乘区 1） */
export type RankTypeKey =
  | 'FIVE_OF_A_KIND'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'TWO_PAIR'
  | 'ONE_PAIR'
  | 'HIGH_CARD';

export interface EvaluateResult {
  rankType: { key: RankTypeKey; name: string; score: number; priority: number };
  suitBonus: number;      // 同花 +5，否则 0
  isFlush: boolean;
  multiplier: number;     // rankType.score + suitBonus
  pointSum: number;       // 5 张点数总和
  rawPower: number;       // pointSum × multiplier
  power: number;          // 最终军势（= rawPower，无封顶）
  capped: boolean;        // 保留字段，恒为 false
}

/** 回合配置 */
export interface RoundConfig {
  round: number;
  initialDrawCount: number; // 开局抽牌数
  freeRedrawsGain: number;  // 本回合新增免费换牌次数
  teamsRequired: number;    // 需要填满几个队伍
  description: string;
  yearIncome: number;       // 本回合结束时的金币收入
  expGain: number;          // 本回合结束时自动获得的招募经验
}

export type SlotLocation =
  | { type: 'hand'; index: number }
  | { type: 'team'; teamIndex: number; slotIndex: number };

/** 招募等级 1~6 */
export type RecruitLevel = 1 | 2 | 3 | 4 | 5 | 6;
