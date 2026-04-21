import type { Card, Faction, PointLabel, RoundConfig } from './types';

/**
 * 武将名单配置（严格按 PRD 表格）
 * 每个 "阵营-点数" 组合下 3 位武将，总计 4 × 13 × 3 = 156 张
 */
type HeroRow = {
  label: PointLabel;
  value: number;
  heroes: Record<Faction, [string, string, string]>;
};

export const HERO_TABLE: HeroRow[] = [
  {
    label: '2',
    value: 15,
    heroes: {
      魏: ['曹操', '曹丕', '曹叡'],
      蜀: ['刘备', '刘禅', '刘封'],
      吴: ['孙权', '孙坚', '孙策'],
      群: ['董卓', '袁绍', '袁术'],
    },
  },
  {
    label: 'A',
    value: 14,
    heroes: {
      魏: ['司马懿', '荀彧', '郭嘉'],
      蜀: ['诸葛亮', '庞统', '法正'],
      吴: ['周瑜', '陆逊', '吕蒙'],
      群: ['吕布', '貂蝉', '华佗'],
    },
  },
  {
    label: 'K',
    value: 13,
    heroes: {
      魏: ['张辽', '许褚', '典韦'],
      蜀: ['关羽', '张飞', '赵云'],
      吴: ['太史慈', '甘宁', '周泰'],
      群: ['张角', '张宝', '张梁'],
    },
  },
  {
    label: 'Q',
    value: 12,
    heroes: {
      魏: ['夏侯惇', '夏侯渊', '曹仁'],
      蜀: ['马超', '黄忠', '魏延'],
      吴: ['黄盖', '程普', '韩当'],
      群: ['颜良', '文丑', '华雄'],
    },
  },
  {
    label: 'J',
    value: 11,
    heroes: {
      魏: ['贾诩', '程昱', '荀攸'],
      蜀: ['姜维', '马岱', '关平'],
      吴: ['鲁肃', '张昭', '张纮'],
      群: ['陈宫', '沮授', '田丰'],
    },
  },
  {
    label: '10',
    value: 10,
    heroes: {
      魏: ['徐晃', '张郃', '于禁'],
      蜀: ['徐庶', '蒋琬', '费祎'],
      吴: ['凌统', '徐盛', '潘璋'],
      群: ['公孙瓒', '陶谦', '刘表'],
    },
  },
  {
    label: '9',
    value: 9,
    heroes: {
      魏: ['乐进', '庞德', '曹洪'],
      蜀: ['王平', '廖化', '张翼'],
      吴: ['丁奉', '蒋钦', '董袭'],
      群: ['高顺', '卢植', '皇甫嵩'],
    },
  },
  {
    label: '8',
    value: 8,
    heroes: {
      魏: ['钟会', '邓艾', '郝昭'],
      蜀: ['马良', '伊籍', '简雍'],
      吴: ['陆抗', '诸葛恪', '顾雍'],
      群: ['左慈', '于吉', '司马徽'],
    },
  },
  {
    label: '7',
    value: 7,
    heroes: {
      魏: ['满宠', '郭淮', '曹真'],
      蜀: ['严颜', '周仓', '关兴'],
      吴: ['陈武', '朱桓', '贺齐'],
      群: ['纪灵', '潘凤', '邢道荣'],
    },
  },
  {
    label: '6',
    value: 6,
    heroes: {
      魏: ['李典', '文聘', '曹休'],
      蜀: ['张苞', '赵广', '黄权'],
      吴: ['步骘', '虞翻', '阚泽'],
      群: ['蔡文姬', '马腾', '韩遂'],
    },
  },
  {
    label: '5',
    value: 5,
    heroes: {
      魏: ['戏志才', '刘晔', '毛玠'],
      蜀: ['孙乾', '麋竺', '麋芳'],
      吴: ['孙尚香', '大乔', '小乔'],
      群: ['李傕', '郭汜', '樊稠'],
    },
  },
  {
    label: '4',
    value: 4,
    heroes: {
      魏: ['曹彰', '牛金', '臧霸'],
      蜀: ['孟获', '祝融', '沙摩柯'],
      吴: ['诸葛瑾', '全琮', '朱然'],
      群: ['丁原', '朱儁', '张鲁'],
    },
  },
  {
    label: '3',
    value: 3,
    heroes: {
      魏: ['蒋济', '辛毗', '杨修'],
      蜀: ['董允', '谯周', '郤正'],
      吴: ['骆统', '凌操', '祖茂'],
      群: ['淳于琼', '审配', '郭图'],
    },
  },
];

export const FACTIONS: Faction[] = ['魏', '蜀', '吴', '群'];

/** 生成全局 156 张卡牌，id 使用递增序列保证全局唯一 */
let __idSeq = 0;
export function generateDeck(): Card[] {
  __idSeq = 0;
  const deck: Card[] = [];
  for (const row of HERO_TABLE) {
    for (const faction of FACTIONS) {
      const names = row.heroes[faction];
      for (const name of names) {
        deck.push({
          id: `card_${++__idSeq}`,
          faction,
          pointLabel: row.label,
          pointValue: row.value,
          name,
        });
      }
    }
  }
  return deck;
}

/** Fisher-Yates 洗牌（纯函数，返回新数组） */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 回合配置表（PRD-Revision 版：去掉 drawCount/totalCards，改为每年经济/经验） */
export const ROUND_CONFIGS: RoundConfig[] = [
  { round: 0, initialDrawCount: 5, freeRedrawsGain: 2, teamsRequired: 1, description: '开局 · 布阵伊始', yearIncome: 0,  expGain: 0 },
  { round: 1, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 1, description: '第一年 · 初显锋芒', yearIncome: 3,  expGain: 2 },
  { round: 2, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 1, description: '第二年 · 鏖战中原', yearIncome: 4,  expGain: 3 },
  { round: 3, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第三年 · 双军并进', yearIncome: 5,  expGain: 3 },
  { round: 4, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第四年 · 合纵连横', yearIncome: 6,  expGain: 4 },
  { round: 5, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第五年 · 势如破竹', yearIncome: 7,  expGain: 4 },
  { round: 6, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第六年 · 一统河山', yearIncome: 8,  expGain: 0 },
];

export const FINAL_ROUND = 6;

/** 经济系统配置（便于策划后续调参） */
export const ECONOMY_CONFIG = {
  initialGold: 4,          // 开局初始金币
  baseIncomePerYear: 3,    // 每回合基础收入（ROUND_CONFIGS 里 yearIncome 已细化，此项为回退默认）
  buyCardBasePrice: 1,     // 第 1 次买牌价格
  buyCardPriceDelta: 1,    // 每多买 1 次 +1 金币
  paidRedrawCost: 2,       // 付费换牌固定 2 金币
  upgradeExpPerGold: 1,    // 花 1 金币 = +1 经验
};

/** 招募等级解锁表 —— 每级解锁的点数（pointValue）集合 */
export const LEVEL_UNLOCK_TABLE: Record<number, number[]> = {
  1: [3, 4, 5, 6],
  2: [3, 4, 5, 6, 7, 8],
  3: [3, 4, 5, 6, 7, 8, 9, 10],
  4: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  5: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  6: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
};

/** 每级升级到下一级所需经验（exp） */
export const LEVEL_EXP_REQUIRED: Record<number, number> = {
  1: 3,
  2: 5,
  3: 7,
  4: 9,
  5: 12,
  6: Infinity, // 满级
};

/** 取某等级解锁的点数集合 */
export function levelUnlockedValues(level: number): Set<number> {
  const key = Math.max(1, Math.min(6, level));
  return new Set(LEVEL_UNLOCK_TABLE[key]);
}

/** 阵营配色主题 */
export const FACTION_THEME: Record<
  Faction,
  { bg: string; ring: string; accent: string; glyph: string; text: string }
> = {
  魏: {
    bg: 'bg-gradient-to-br from-blue-900 to-blue-950',
    ring: 'ring-blue-400/60',
    accent: 'text-slate-200',
    glyph: '♠',
    text: 'text-slate-100',
  },
  蜀: {
    bg: 'bg-gradient-to-br from-red-900 to-red-950',
    ring: 'ring-red-400/60',
    accent: 'text-yellow-200',
    glyph: '♥',
    text: 'text-yellow-100',
  },
  吴: {
    bg: 'bg-gradient-to-br from-emerald-900 to-emerald-950',
    ring: 'ring-emerald-400/60',
    accent: 'text-yellow-200',
    glyph: '♣',
    text: 'text-yellow-100',
  },
  群: {
    bg: 'bg-gradient-to-br from-zinc-800 to-neutral-950',
    ring: 'ring-amber-400/60',
    accent: 'text-amber-200',
    glyph: '♦',
    text: 'text-amber-50',
  },
};
