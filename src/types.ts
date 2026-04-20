// 核心数据类型定义

export type Faction = '魏' | '蜀' | '吴' | '群';

export type PointLabel = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  id: string;
  faction: Faction;
  pointLabel: PointLabel;
  pointValue: number; // 3~10, J=11, Q=12, K=13, A=14, 2=15
  name: string;
}

// 牌型枚举（按优先级从高到低）
export type HandTypeKey =
  | 'FIVE_OF_A_KIND'        // 五条
  | 'FLUSH_FULL_HOUSE'      // 同花葫芦
  | 'STRAIGHT_FLUSH'        // 同花顺
  | 'FLUSH_THREE'           // 同花三条
  | 'FOUR_OF_A_KIND'        // 四条
  | 'FLUSH_TWO_PAIR'        // 同花两对
  | 'FLUSH_ONE_PAIR'        // 同花一对
  | 'FULL_HOUSE'            // 葫芦
  | 'FLUSH_HIGH'            // 同花散牌
  | 'STRAIGHT'              // 顺子
  | 'THREE_OF_A_KIND'       // 三条
  | 'TWO_PAIR'              // 两对
  | 'ONE_PAIR'              // 一对
  | 'HIGH_CARD';            // 散牌

export interface HandType {
  key: HandTypeKey;
  name: string;
  multiplier: number;
  priority: number; // 1 最高
}

export interface EvaluateResult {
  handType: HandType;
  pointSum: number;   // 5 张牌点数之和
  power: number;      // pointSum × multiplier
}

// 回合配置
export interface RoundConfig {
  round: number;            // 0 = 开局
  drawCount: number;        // 本回合新抽牌数
  totalCards: number;       // 本回合手上应有的总卡数
  redrawsGain: number;      // 本回合新增换牌次数
  teamsRequired: number;    // 需要填满几个队伍
  description: string;
}

export type SlotLocation =
  | { type: 'hand'; index: number }
  | { type: 'team'; teamIndex: number; slotIndex: number };
