import type { Faction, RankTypeKey } from './types';
import { RANK_TYPES } from './evaluate';

/** 天赐能力模板 ID */
export type TalentTemplateId =
  | 'faction_shu_3'
  | 'faction_wu_3'
  | 'faction_wei_3'
  | 'small_card_3'
  | 'gold_8'
  | 'flush_bonus_2'
  | 'no_flush_plus_gold'
  | 'random_two_cards'
  | 'rank_bonus_2'
  | 'per_hand_card_2'
  | 'full_heal'
  | 'draw_15'
  | 'double_this_round'
  | 'three_brothers_double'
  | 'random_reroll_all'
  | 'flush_gives_8_gold'
  | 'free_redraws_3'
  | 'short_straight'
  | 'point_15_as_30'
  | 'point_3_as_14'
  | 'gold_to_prowess';

export interface TalentInstance {
  /** 每次 roll 生成的唯一 id */
  id: string;
  templateId: TalentTemplateId;
  name: string;
  description: string;
  /** passive = 永久生效 · instant = 抽到即消耗 · oneshot = 本回合生效一次后自动移除 */
  kind: 'passive' | 'instant' | 'oneshot';
  /** rank_bonus_2 带一个具体阵法 key */
  rankKey?: RankTypeKey;
  /** UI 主色（#rgb） */
  accent: string;
  icon: string;
}

interface Template {
  templateId: TalentTemplateId;
  name: string;
  description: string | ((payload?: { rankKey?: RankTypeKey }) => string);
  kind: 'passive' | 'instant' | 'oneshot';
  accent: string;
  icon: string;
  /** 可以多次叠加？（默认 false） */
  stackable?: boolean;
}

const TEMPLATES: Record<TalentTemplateId, Template> = {
  faction_shu_3: {
    templateId: 'faction_shu_3',
    name: '蜀汉兴复',
    description: '所有【蜀】武将结算勇武时 +3',
    kind: 'passive',
    accent: '#10b981',
    icon: '🟢',
  },
  faction_wu_3: {
    templateId: 'faction_wu_3',
    name: '江东虎踞',
    description: '所有【吴】武将结算勇武时 +3',
    kind: 'passive',
    accent: '#ef4444',
    icon: '🔴',
  },
  faction_wei_3: {
    templateId: 'faction_wei_3',
    name: '魏武挟令',
    description: '所有【魏】武将结算勇武时 +3',
    kind: 'passive',
    accent: '#3b82f6',
    icon: '🔵',
  },
  small_card_3: {
    templateId: 'small_card_3',
    name: '卒变上将',
    description: '所有点数 < 5 的武将，勇武 +3',
    kind: 'passive',
    accent: '#a3e635',
    icon: '🌾',
  },
  gold_8: {
    templateId: 'gold_8',
    name: '库银进贡',
    description: '立即获得 +8 金币',
    kind: 'instant',
    accent: '#fbbf24',
    icon: '💰',
  },
  flush_bonus_2: {
    templateId: 'flush_bonus_2',
    name: '上下同欲',
    description: '【阵营同心】的倍率加成 +2',
    kind: 'passive',
    accent: '#f472b6',
    icon: '⚑',
  },
  no_flush_plus_gold: {
    templateId: 'no_flush_plus_gold',
    name: '散财之道',
    description: '永久无法触发【同心】 · 立即获得 +15 金币',
    kind: 'passive',
    accent: '#fcd34d',
    icon: '💎',
  },
  random_two_cards: {
    templateId: 'random_two_cards',
    name: '贤士来投',
    description: '立即从牌库随机获得 2 张武将',
    kind: 'instant',
    accent: '#67e8f9',
    icon: '🤝',
  },
  rank_bonus_2: {
    templateId: 'rank_bonus_2',
    name: '阵法精研',
    description: ({ rankKey } = {}) => {
      const name = rankKey ? RANK_TYPES[rankKey].name : '某阵法';
      return `【${name}】倍率加成 +2`;
    },
    kind: 'passive',
    accent: '#c084fc',
    icon: '📜',
    stackable: true, // 可对不同阵法各选一次
  },
  per_hand_card_2: {
    templateId: 'per_hand_card_2',
    name: '手握百员',
    description: '待命手牌每有 1 员，基础勇武 +2',
    kind: 'passive',
    accent: '#fb923c',
    icon: '🖐',
  },
  full_heal: {
    templateId: 'full_heal',
    name: '华佗再世',
    description: '立即将主公的气血补满',
    kind: 'instant',
    accent: '#fca5a5',
    icon: '❤',
  },
  draw_15: {
    templateId: 'draw_15',
    name: '王佐之才',
    description: '立即抽取一张战力 15 的武将',
    kind: 'instant',
    accent: '#fde047',
    icon: '★',
  },
  double_this_round: {
    templateId: 'double_this_round',
    name: '奇谋一击',
    description: '本回合你的军势最终战斗力翻倍（一次性）',
    kind: 'oneshot',
    accent: '#f87171',
    icon: '⚡',
  },
  three_brothers_double: {
    templateId: 'three_brothers_double',
    name: '桃园结义',
    description: '当队伍同时包含【关羽 · 刘备 · 张飞】时，该队战力翻倍',
    kind: 'passive',
    accent: '#fecaca',
    icon: '🍑',
  },
  random_reroll_all: {
    templateId: 'random_reroll_all',
    name: '乾坤一掷',
    description: '依据当前等级，重新替换你所有的武将（手牌与场上）',
    kind: 'instant',
    accent: '#a78bfa',
    icon: '🎲',
  },
  flush_gives_8_gold: {
    templateId: 'flush_gives_8_gold',
    name: '同心同利',
    description: '每当结算时触发【同心】，额外获得 +8 金币',
    kind: 'passive',
    accent: '#fde68a',
    icon: '🪙',
  },
  free_redraws_3: {
    templateId: 'free_redraws_3',
    name: '换将令牌',
    description: '立即获得 3 次免费换牌',
    kind: 'instant',
    accent: '#93c5fd',
    icon: '🔄',
  },
  short_straight: {
    templateId: 'short_straight',
    name: '长蛇速成',
    description: '【长蛇阵】只需四张连号武将即可触发',
    kind: 'passive',
    accent: '#34d399',
    icon: '🐍',
  },
  point_15_as_30: {
    templateId: 'point_15_as_30',
    name: '王者归朝',
    description: '所有战力 15 的武将，结算时勇武视为 30',
    kind: 'passive',
    accent: '#facc15',
    icon: '👑',
  },
  point_3_as_14: {
    templateId: 'point_3_as_14',
    name: '卒升车将',
    description: '所有战力 3 的武将，结算时勇武视为 14',
    kind: 'passive',
    accent: '#84cc16',
    icon: '⚙',
  },
  gold_to_prowess: {
    templateId: 'gold_to_prowess',
    name: '散金养士',
    description: '结算时，你每持 1 金币，基础勇武 +2',
    kind: 'passive',
    accent: '#eab308',
    icon: '💹',
  },
};

let __talentSeq = 0;
function nextId(): string {
  return `talent_${++__talentSeq}_${Date.now().toString(36)}`;
}

function instantiate(
  t: Template,
  payload?: { rankKey?: RankTypeKey },
): TalentInstance {
  const desc =
    typeof t.description === 'function' ? t.description(payload) : t.description;
  return {
    id: nextId(),
    templateId: t.templateId,
    name: t.name,
    description: desc,
    kind: t.kind,
    rankKey: payload?.rankKey,
    accent: t.accent,
    icon: t.icon,
  };
}

/** 从当前可用模板集中随机生成 4 个候选（不重复） */
export function rollTalents(owned: TalentInstance[]): TalentInstance[] {
  // 排除已拥有的（非 stackable）
  const ownedTemplateIds = new Set(
    owned.filter((t) => {
      const tmpl = TEMPLATES[t.templateId];
      return tmpl && !tmpl.stackable;
    }).map((t) => t.templateId),
  );

  // 收集已使用过的 rank_bonus_2 锁死的 rankKey（避免重复）
  const usedRanks = new Set(
    owned.filter((t) => t.templateId === 'rank_bonus_2').map((t) => t.rankKey!),
  );

  const allRankKeys = Object.keys(RANK_TYPES) as RankTypeKey[];
  const availableRanks = allRankKeys.filter((k) => !usedRanks.has(k));

  // 构造候选池
  const pool: { tmpl: Template; payload?: { rankKey?: RankTypeKey } }[] = [];
  for (const tmpl of Object.values(TEMPLATES)) {
    if (tmpl.templateId === 'rank_bonus_2') {
      if (availableRanks.length === 0) continue;
      // 对每个还没选过的阵法都当作一个独立候选
      for (const rk of availableRanks) {
        pool.push({ tmpl, payload: { rankKey: rk } });
      }
      continue;
    }
    if (ownedTemplateIds.has(tmpl.templateId)) continue;
    pool.push({ tmpl });
  }

  // 洗牌取前 5（若候选池不足 5，取尽）
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const picks = pool.slice(0, 4);
  return picks.map(({ tmpl, payload }) => instantiate(tmpl, payload));
}

// ======================================================================
// 被动天赐 → 聚合的评估上下文
// ======================================================================

export interface EvalContext {
  /** 每个阵营武将 pointValue 的加成 */
  factionBonus: Record<Faction, number>;
  /** 点数 < 5 的武将额外加成 */
  smallCardBonus: number;
  /** 同心倍率额外加成 */
  flushBonusExtra: number;
  /** 禁用同心 */
  disableFlush: boolean;
  /** 每个阵法 score 的额外加成 */
  rankBonusExtra: Partial<Record<RankTypeKey, number>>;
  /** 点数 == 15 的武将勇武固定替换（王者归朝） */
  value15As: number | null;
  /** 点数 == 3 的武将勇武固定替换（卒升车将） */
  value3As: number | null;
  /** 长蛇阵只需 4 张连号（长蛇速成） */
  shortStraight: boolean;
  /** 散金养士：每 1 金币 → 队伍基础勇武 +2（由 App/evaluate 外层叠加） */
  goldToProwess: boolean;
  /** 当前金币数（evaluate 外部提供）—— 仅用于 goldToProwess 计算 */
  goldForBonus: number;
  /** 【白龙马】手牌中该印记的数量 → 阵法倍率 +1 每张 */
  bailongInHand: number;
}

export function buildEvalContext(
  talents: TalentInstance[],
  opts: { gold?: number; bailongInHand?: number } = {},
): EvalContext {
  const ctx: EvalContext = {
    factionBonus: { 魏: 0, 蜀: 0, 吴: 0, 群: 0 },
    smallCardBonus: 0,
    flushBonusExtra: 0,
    disableFlush: false,
    rankBonusExtra: {},
    value15As: null,
    value3As: null,
    shortStraight: false,
    goldToProwess: false,
    goldForBonus: opts.gold ?? 0,
    bailongInHand: opts.bailongInHand ?? 0,
  };
  for (const t of talents) {
    switch (t.templateId) {
      case 'faction_shu_3':
        ctx.factionBonus['蜀'] += 3;
        break;
      case 'faction_wu_3':
        ctx.factionBonus['吴'] += 3;
        break;
      case 'faction_wei_3':
        ctx.factionBonus['魏'] += 3;
        break;
      case 'small_card_3':
        ctx.smallCardBonus += 3;
        break;
      case 'flush_bonus_2':
        ctx.flushBonusExtra += 2;
        break;
      case 'no_flush_plus_gold':
        ctx.disableFlush = true;
        break;
      case 'rank_bonus_2':
        if (t.rankKey) {
          ctx.rankBonusExtra[t.rankKey] =
            (ctx.rankBonusExtra[t.rankKey] ?? 0) + 2;
        }
        break;
      case 'point_15_as_30':
        ctx.value15As = 30;
        break;
      case 'point_3_as_14':
        ctx.value3As = 14;
        break;
      case 'short_straight':
        ctx.shortStraight = true;
        break;
      case 'gold_to_prowess':
        ctx.goldToProwess = true;
        break;
      default:
        break;
    }
  }
  return ctx;
}

/** 每张武将根据上下文计算出的"调整后 pointValue"（用于勇武/点数和显示） */
export function adjustedPointValue(
  card: { faction: Faction; pointValue: number; horseSeal?: string },
  ctx?: EvalContext,
): number {
  if (!ctx) {
    // 没有 ctx 时仅处理 horseSeal dilu 的翻倍（神马印记是全模式生效，不依赖天赐）
    return card.horseSeal === 'dilu' ? card.pointValue * 2 : card.pointValue;
  }
  // 固定替换优先（王者归朝 / 卒升车将）
  let pv = card.pointValue;
  if (pv === 15 && ctx.value15As !== null) pv = ctx.value15As;
  else if (pv === 3 && ctx.value3As !== null) pv = ctx.value3As;
  // 阵营加成
  pv += ctx.factionBonus[card.faction] ?? 0;
  // 小点数加成（按原始 pointValue 判定）
  if (card.pointValue < 5) pv += ctx.smallCardBonus;
  // 【的卢马】双发：本张武将的勇武值额外触发一次
  if (card.horseSeal === 'dilu') pv *= 2;
  return pv;
}

/** 桃园结义：队伍是否同时包含关羽、刘备、张飞 */
export function hasThreeBrothers(
  teamCards: { name: string; faction: Faction }[],
): boolean {
  const needed = ['关羽', '刘备', '张飞'];
  const names = new Set(teamCards.map((c) => c.name));
  return needed.every((n) => names.has(n));
}
