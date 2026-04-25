import type { RankTypeKey } from './types';

export interface Formation {
  key: RankTypeKey;
  name: string;
  rankName: string;
  description: string;
  broadcast: string;      // 播报文案
  /** 5 员的站位坐标 [x, y, z]，中心 (0,0,0) */
  formation: [number, number, number][];
  /** 阵法连线特效：连接的节点索引对 */
  links?: [number, number][];
}

export const FORMATIONS: Record<RankTypeKey, Formation> = {
  FIVE_OF_A_KIND: {
    key: 'FIVE_OF_A_KIND',
    name: '一字阵',
    rankName: '五条',
    description: '5名同力猛将化作一字长龙，横向突进',
    broadcast: '汇聚 5 名猛将化作长龙，触发【一字阵】，军势乘 x10 倍！',
    formation: [
      [-2.4, 0, 0],
      [-1.2, 0, 0],
      [0, 0, 0],
      [1.2, 0, 0],
      [2.4, 0, 0],
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  FOUR_OF_A_KIND: {
    key: 'FOUR_OF_A_KIND',
    name: '方圆阵',
    rankName: '四条',
    description: '4人列阵镇守正四方，1个散牌居中调度',
    broadcast: '寻得 4 名猛将镇守四方，触发【方圆阵】，军势乘 x8 倍！',
    formation: [
      [-1.5, 0, -1.5], // 0: 同牌1
      [-1.5, 0, 1.5],  // 1: 同牌2
      [1.5, 0, -1.5],  // 2: 同牌3
      [1.5, 0, 1.5],   // 3: 同牌4
      [0, 0, 0],       // 4: 散牌（居中）
    ],
    links: [[0, 1], [1, 3], [3, 2], [2, 0]],
  },
  FULL_HOUSE: {
    key: 'FULL_HOUSE',
    name: '衡轭阵',
    rankName: '葫芦',
    description: '2同牌前排并肩突击，3同牌后排横列压阵',
    broadcast: '前排突击后排压阵，触发【衡轭阵】，军势乘 x6 倍！',
    formation: [
      [-1.5, 0, -1.6], // 0: 3条之1
      [-1.5, 0, 0],    // 1: 3条之2
      [-1.5, 0, 1.6],  // 2: 3条之3
      [1.5, 0, -1.0],  // 3: 2条之1
      [1.5, 0, 1.0],   // 4: 2条之2
    ],
    links: [[0, 1], [1, 2], [0, 3], [2, 4]],
  },
  STRAIGHT: {
    key: 'STRAIGHT',
    name: '雁行阵',
    rankName: '顺子',
    description: '力量循序渐进，如大雁斜飞般梯次排开',
    broadcast: '力量循序渐进梯次排开，触发【雁行阵】，军势乘 x5 倍！',
    formation: [
      [-2.0, 0, 2.0],
      [-1.0, 0, 1.0],
      [0, 0, 0],
      [1.0, 0, -1.0],
      [2.0, 0, -2.0],
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  THREE_OF_A_KIND: {
    key: 'THREE_OF_A_KIND',
    name: '锋矢阵',
    rankName: '三条',
    description: '3同牌构成锐利的>形箭头，2散牌拖后微微散落',
    broadcast: '3 名猛将构成箭头突击，触发【锋矢阵】，军势乘 x4 倍！',
    formation: [
      [2.0, 0, 0],      // 0: 箭头
      [0.5, 0, -1.5],   // 1: 翼
      [0.5, 0, 1.5],    // 2: 翼
      [-1.2, 0, -0.6],  // 3: 散兵 1
      [-2.2, 0, 1.8],   // 4: 散兵 2
    ],
    links: [[1, 0], [2, 0]],
  },
  TWO_PAIR: {
    key: 'TWO_PAIR',
    name: '偃月阵',
    rankName: '两对',
    description: '两对武将对称成弯月角，散牌居中心',
    broadcast: '两对将领化作弯月角，触发【偃月阵】，军势乘 x3 倍！',
    formation: [
      [-0.5, 0, -1.2], // 0: 对1之上
      [-0.5, 0, 1.2],  // 1: 对1之下
      [1.5, 0, -2.2],  // 2: 对2之上
      [1.5, 0, 2.2],   // 3: 对2之下
      [-2.0, 0, 0],    // 4: 散牌（居后中心）
    ],
    links: [[2, 0], [0, 4], [4, 1], [1, 3]],
  },
  ONE_PAIR: {
    key: 'ONE_PAIR',
    name: '双锋阵',
    rankName: '一对',
    description: '1对同牌化作双锋并列突进，后方散兵游勇跟随',
    broadcast: '寻得 2 名将领化作双锋，触发【双锋阵】，军势乘 x2 倍！',
    formation: [
      [1.5, 0, -1.0],  // 0: 对1
      [1.5, 0, 1.0],   // 1: 对2
      [-1.2, 0, -2.2], // 2: 散兵 1
      [-2.0, 0, -0.2], // 3: 散兵 2
      [-0.8, 0, 2.0],  // 4: 散兵 3
    ],
    links: [[0, 1]],
  },
  HIGH_CARD: {
    key: 'HIGH_CARD',
    name: '散阵',
    rankName: '散牌',
    description: '杂乱无章，各自为战',
    broadcast: '各自为战，阵型散乱，触发【散阵】，军势乘 x1 倍。',
    formation: [
      [-1.8, 0, -2.5], // 0: 极左后
      [2.2, 0, -1.0],  // 1: 右前
      [-0.5, 0, 0.8],  // 2: 中心偏后
      [1.0, 0, 2.8],   // 3: 极右前
      [-2.5, 0, 1.2],  // 4: 左中
    ],
    links: [],
  },
};

/** 同花（阵营同心）附加文案 */
export const FLUSH_BROADCAST = '5 名将领同属一阵营，触发【阵营同心】，军势额外 +5！';
