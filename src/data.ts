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
      魏: ['曹操', '司马懿', '荀彧'],
      蜀: ['刘备', '诸葛亮', '庞统'],
      吴: ['孙权', '孙策', '周瑜'],
      群: ['吕布', '董卓', '貂蝉'],
    },
  },
  {
    label: 'A',
    value: 14,
    heroes: {
      魏: ['典韦', '许褚', '贾诩'],
      蜀: ['关羽', '赵云', '张飞'],
      吴: ['陆逊', '吕蒙', '鲁肃'],
      群: ['汉灵帝', '张角', '司马徽'],
    },
  },
  {
    label: 'K',
    value: 13,
    heroes: {
      魏: ['郭嘉', '程昱', '荀攸'],
      蜀: ['姜维', '马超', '黄忠'],
      吴: ['甘宁', '黄盖', '程普'],
      群: ['左慈', '华佗', '于吉'],
    },
  },
  {
    label: 'Q',
    value: 12,
    heroes: {
      魏: ['张辽', '张郃', '徐晃'],
      蜀: ['魏延', '法正', '徐庶'],
      吴: ['太史慈', '孙坚', '陆抗'],
      群: ['袁绍', '袁术', '公孙瓒'],
    },
  },
  {
    label: 'J',
    value: 11,
    heroes: {
      魏: ['夏侯渊', '夏侯惇', '曹仁'],
      蜀: ['关兴', '关平', '张苞'],
      吴: ['周泰', '凌统', '徐盛'],
      群: ['刘表', '刘璋', '士燮'],
    },
  },
  {
    label: '10',
    value: 10,
    heroes: {
      魏: ['邓艾', '钟会', '郝昭'],
      蜀: ['黄月英', '关银屏', '马云禄'],
      吴: ['孙尚香', '小乔', '大乔'],
      群: ['卢植', '朱儁', '皇甫嵩'],
    },
  },
  {
    label: '9',
    value: 9,
    heroes: {
      魏: ['于禁', '乐进', '满宠'],
      蜀: ['严颜', '廖化', '周仓'],
      吴: ['韩当', '董袭', '丁奉'],
      群: ['高顺', '陈宫', '吕玲绮'],
    },
  },
  {
    label: '8',
    value: 8,
    heroes: {
      魏: ['卞夫人', '曹丕', '甄姬'],
      蜀: ['王平', '陈到', '马岱'],
      吴: ['潘璋', '蒋钦', '陈武'],
      群: ['马腾', '庞德', '韩遂'],
    },
  },
  {
    label: '7',
    value: 7,
    heroes: {
      魏: ['郭淮', '臧霸', '文聘'],
      蜀: ['黄权', '吴懿', '李严'],
      吴: ['顾雍', '张昭', '张纮'],
      群: ['孟获', '祝融', '兀突骨'],
    },
  },
  {
    label: '6',
    value: 6,
    heroes: {
      魏: ['王异', '王元姬', '张春华'],
      蜀: ['甘夫人', '刘禅', '糜竺'],
      吴: ['步练师', '孙鲁班', '周姬'],
      群: ['蔡文姬', '张宁', '邹氏'],
    },
  },
  {
    label: '5',
    value: 5,
    heroes: {
      魏: ['曹真', '曹洪', '曹纯'],
      蜀: ['马谡', '马良', '沙摩柯'],
      吴: ['诸葛瑾', '诸葛恪', '步骘'],
      群: ['田丰', '许攸', '沮授'],
    },
  },
  {
    label: '4',
    value: 4,
    heroes: {
      魏: ['曹休', '李典', '陈群'],
      蜀: ['蒋琬', '董允', '费祎'],
      吴: ['朱桓', '吕范', '朱然'],
      群: ['文丑', '颜良', '华雄'],
    },
  },
  {
    label: '3',
    value: 3,
    heroes: {
      魏: ['曹植', '王朗', '王双'],
      蜀: ['伊籍', '孙乾', '简雍'],
      吴: ['孙桓', '全琮', '朱治'],
      群: ['张宝', '张梁', '张曼成'],
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
  { round: 0, initialDrawCount: 1, freeRedrawsGain: 2, teamsRequired: 1, description: '开局 · 布阵伊始', yearIncome: 10, expGain: 0 },
  { round: 1, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 1, description: '第一年 · 初显锋芒', yearIncome: 11, expGain: 8 },
  { round: 2, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 1, description: '第二年 · 鏖战中原', yearIncome: 12, expGain: 8 },
  { round: 3, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第三年 · 双军并进', yearIncome: 14, expGain: 8 },
  { round: 4, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第四年 · 合纵连横', yearIncome: 16, expGain: 12 },
  { round: 5, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第五年 · 势如破竹', yearIncome: 18, expGain: 12 },
  { round: 6, initialDrawCount: 0, freeRedrawsGain: 2, teamsRequired: 2, description: '第六年 · 一统河山', yearIncome: 20, expGain: 12 },
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

/** 每级升级到下一级所需经验（exp） · 4/8/12/16/20 递增 */
export const LEVEL_EXP_REQUIRED: Record<number, number> = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
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
    bg: 'card-wei',
    ring: 'ring-blue-500/80',
    accent: 'text-blue-100',
    glyph: '♠',
    text: 'text-slate-100',
  },
  蜀: {
    bg: 'card-shu',
    ring: 'ring-emerald-500/80',
    accent: 'text-emerald-100',
    glyph: '♣',
    text: 'text-yellow-50',
  },
  吴: {
    bg: 'card-wu',
    ring: 'ring-red-500/80',
    accent: 'text-red-100',
    glyph: '♥',
    text: 'text-yellow-50',
  },
  群: {
    bg: 'card-qun',
    ring: 'ring-amber-500/80',
    accent: 'text-amber-100',
    glyph: '♦',
    text: 'text-amber-50',
  },
};
