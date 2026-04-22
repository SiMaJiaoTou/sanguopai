import type { RankTypeKey } from './types';

/**
 * 8 种牌型 → 古代阵法的映射
 * 倍率保持不变，仅是文案与视觉包装
 */
export interface Formation {
  key: RankTypeKey;
  name: string;           // 阵法名（如"一字阵"）
  rankName: string;       // 原牌型名（如"五条"）
  description: string;    // 阵型描述
  broadcast: string;      // 播报文案
  /** 5 员的站位坐标 [x, y, z]，中心 (0,0,0) */
  formation: [number, number, number][];
}

export const FORMATIONS: Record<RankTypeKey, Formation> = {
  FIVE_OF_A_KIND: {
    key: 'FIVE_OF_A_KIND',
    name: '一字阵',
    rankName: '五条',
    description: '呈横向一字排开，平推之势',
    broadcast: '汇聚 5 名武勇相同的猛将，触发【一字阵】，军势乘 x12 倍！',
    formation: [
      [-2.75, 0, 0],
      [-1.375, 0, 0],
      [0, 0, 0],
      [1.375, 0, 0],
      [2.75, 0, 0],
    ],
  },
  FOUR_OF_A_KIND: {
    key: 'FOUR_OF_A_KIND',
    name: '雁行阵',
    rankName: '四条',
    description: '呈斜线排列，如大雁斜飞',
    broadcast: '寻得 4 名武勇相同的猛将，触发【雁行阵】，军势乘 x9 倍！',
    formation: [
      [-2.75, 0, -1.65],
      [-1.375, 0, -0.825],
      [0, 0, 0],
      [1.375, 0, 0.825],
      [2.75, 0, 1.65],
    ],
  },
  FULL_HOUSE: {
    key: 'FULL_HOUSE',
    name: '锥形阵',
    rankName: '葫芦',
    description: '前锋尖锐，后阵宽阔的三角形',
    broadcast: '寻得 3 名及另 2 名武勇相同的猛将，触发【锥形阵】，军势乘 x6 倍！',
    formation: [
      [0, 0, 1.925],     // 前锋
      [-1.375, 0, 0],    // 中军
      [1.375, 0, 0],
      [-2.75, 0, -1.65], // 后卫
      [2.75, 0, -1.65],
    ],
  },
  STRAIGHT: {
    key: 'STRAIGHT',
    name: '长蛇阵',
    rankName: '顺子',
    description: '蜿蜒曲折，首尾相顾的折线',
    broadcast: '汇聚 5 名武勇步步连贯的将领，触发【长蛇阵】，军势乘 x7 倍！',
    formation: [
      [-2.75, 0, 1.1],
      [-1.375, 0, -1.1],
      [0, 0, 1.1],
      [1.375, 0, -1.1],
      [2.75, 0, 1.1],
    ],
  },
  THREE_OF_A_KIND: {
    key: 'THREE_OF_A_KIND',
    name: '鹤翼阵',
    rankName: '三条',
    description: '左右张开如鹤翼的 V 字形',
    broadcast: '寻得 3 名武勇相同的将领，触发【鹤翼阵】，军势乘 x4 倍！',
    formation: [
      [0, 0, -1.375],      // 主将居中靠后
      [-1.375, 0, 0.6875],
      [1.375, 0, 0.6875],
      [-2.75, 0, 1.925],   // 两翼向前延伸
      [2.75, 0, 1.925],
    ],
  },
  TWO_PAIR: {
    key: 'TWO_PAIR',
    name: '方圆阵',
    rankName: '两对',
    description: '菱形防御圈',
    broadcast: '寻得 2 对武勇相同的将领，触发【方圆阵】，军势乘 x3 倍！',
    formation: [
      [0, 0, 0],          // 中心
      [0, 0, 1.925],      // 前
      [0, 0, -1.925],     // 后
      [-2.475, 0, 0],     // 左
      [2.475, 0, 0],      // 右
    ],
  },
  ONE_PAIR: {
    key: 'ONE_PAIR',
    name: '锋矢阵',
    rankName: '一对',
    description: '箭头状突击阵，中央突出的进攻阵型',
    broadcast: '寻得 2 名武勇相同的将领，触发【锋矢阵】，军势乘 x2 倍！',
    formation: [
      [0, 0, 1.925],      // 尖端主将
      [0, 0, 0],          // 箭头柄
      [0, 0, -1.65],
      [-1.65, 0, -0.825],
      [1.65, 0, -0.825],
    ],
  },
  HIGH_CARD: {
    key: 'HIGH_CARD',
    name: '散阵',
    rankName: '散牌',
    description: '凌乱无序的散兵游勇',
    broadcast: '各自为战，阵型散乱，触发【散阵】，军势乘 x1 倍。',
    // 散阵用伪随机但稳定的坐标（不随帧变化）
    formation: [
      [-2.475, 0, 1.2375],
      [-0.825, 0, -1.5125],
      [0.9625, 0, 0.55],
      [2.475, 0, -0.9625],
      [-1.65, 0, -0.4125],
    ],
  },
};

/** 同花（阵营同心）附加文案 */
export const FLUSH_BROADCAST = '5 名将领同属一阵营，触发【阵营同心】，军势额外 +5！';
