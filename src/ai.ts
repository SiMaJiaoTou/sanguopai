import type { Card, RecruitLevel } from './types';
import { evaluateHand } from './evaluate';
import {
  ROUND_CONFIGS,
  LEVEL_EXP_REQUIRED,
  LEVEL_UNLOCK_TABLE,
  levelUnlockedValues,
} from './data';

/** AI 名录（诸侯名头） */
export const AI_WARLORDS: { name: string; title: string }[] = [
  { name: '袁绍',   title: '四世三公' },
  { name: '袁术',   title: '僭号仲氏' },
  { name: '刘表',   title: '荆襄八俊' },
  { name: '马腾',   title: '西凉铁骑' },
  { name: '公孙瓒', title: '白马义从' },
  { name: '张鲁',   title: '汉中师君' },
  { name: '刘璋',   title: '益州牧守' },
];

export interface AIState {
  id: string;
  name: string;
  title: string;
  hand: Card[];
  teams: (Card | null)[][];        // 2 × 5
  gold: number;
  recruitLevel: RecruitLevel;
  recruitExp: number;
  buyCount: number;                // AI 自身的买卡计数（影响下次价格）
  freeRedrawsLeft: number;         // 自己累计的免费换牌次数
  lastTotalPower: number;
  hp: number;
  eliminatedAtRound: number | null;
}

/** 每名玩家/AI 初始血量 */
export const INITIAL_HP = 500;

/** 创建 7 个初始 AI */
export function createInitialAIs(): AIState[] {
  return AI_WARLORDS.map((w, i) => ({
    id: `ai_${i}`,
    name: w.name,
    title: w.title,
    hand: [],
    teams: [
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    gold: 4,
    recruitLevel: 1,
    recruitExp: 0,
    buyCount: 0,
    freeRedrawsLeft: 0,
    lastTotalPower: 0,
    hp: INITIAL_HP,
    eliminatedAtRound: null,
  }));
}

/** 从牌库中按等级解锁池抽一张，并返回剩余牌库（可选 filter） */
function drawOneUnlockedFromDeck(
  deck: Card[],
  level: number,
  filter?: (c: Card) => boolean,
): { card: Card | null; rest: Card[] } {
  const unlocked = levelUnlockedValues(level);
  const indices: number[] = [];
  for (let i = 0; i < deck.length; i++) {
    if (!unlocked.has(deck[i].pointValue)) continue;
    if (filter && !filter(deck[i])) continue;
    indices.push(i);
  }
  if (indices.length === 0) return { card: null, rest: deck };
  const pickIdx = indices[Math.floor(Math.random() * indices.length)];
  const card = deck[pickIdx];
  const rest = deck.slice(0, pickIdx).concat(deck.slice(pickIdx + 1));
  return { card, rest };
}

/** 买卡价格（1, 2, 3, …） */
function aiBuyCardPrice(buyCount: number): number {
  return 1 + buyCount;
}

/** 付费换牌固定成本 */
const PAID_REDRAW_COST = 2;

/** 推荐的目标等级（由年份自动爬升） */
function targetRecruitLevel(roundIdx: number): RecruitLevel {
  // 大致节奏：
  // y1 → Lv2, y2 → Lv3, y3 → Lv4, y4 → Lv5, y5 → Lv6, y6 → Lv6
  if (roundIdx >= 5) return 6;
  if (roundIdx >= 4) return 5;
  if (roundIdx >= 3) return 4;
  if (roundIdx >= 2) return 3;
  return 2;
}

/** 评估一张卡"对当前 AI 牌组的战略价值"—— 用于决定要不要换 */
function cardValue(c: Card, aiLevel: number): number {
  // 简化：点数本身 + 如果点数接近 aiLevel 解锁上限给加权
  const unlocked = levelUnlockedValues(aiLevel);
  let base = c.pointValue;
  if (!unlocked.has(c.pointValue)) base -= 3; // 超出当前池（理论不会出现）
  // 稀有度奖励（点数>=11）
  if (c.pointValue >= 11) base += 2;
  return base;
}

export interface AITurnResult {
  ai: AIState;
  deck: Card[];
  totalPower: number;
}

/**
 * 为 AI 模拟完整一回合（更像真人玩家）：
 *  1) 年度收入 + 经验自动升级
 *  2) 按"目标等级"用金币主动升级主公府（1 金 → +1 威望）
 *  3) 先把阵上武将收回手牌，评估当前最优 5（或 10）张组合的战力
 *  4) 反复决策：买卡 / 换牌 / 升级，每一步用预算估值模型选择收益最大者，
 *     直到没有合理收益或钱包见底
 *  5) 最终贪心组阵并记录 lastTotalPower
 */
export function simulateAITurn(
  ai: AIState,
  deck: Card[],
  nextRoundIdx: number,
): AITurnResult {
  const cfg = ROUND_CONFIGS[nextRoundIdx];
  if (!cfg) return { ai, deck, totalPower: ai.lastTotalPower };

  let workingDeck = deck.slice();
  const nextAI: AIState = {
    ...ai,
    hand: ai.hand.slice(),
    teams: ai.teams.map((t) => t.slice()),
  };

  // ===== 1) 年度收入 + 自动升级经验 =====
  nextAI.gold += cfg.yearIncome;
  nextAI.freeRedrawsLeft += cfg.freeRedrawsGain;

  let lv = nextAI.recruitLevel;
  let exp = nextAI.recruitExp + cfg.expGain;
  while (lv < 6 && exp >= LEVEL_EXP_REQUIRED[lv]) {
    exp -= LEVEL_EXP_REQUIRED[lv];
    lv = (lv + 1) as RecruitLevel;
  }
  if (lv >= 6) exp = 0;
  nextAI.recruitLevel = lv;
  nextAI.recruitExp = exp;

  const teamsNeed = cfg.teamsRequired;
  const slotsTotal = teamsNeed * 5;

  // AI 手牌规模上限（按阶段限制，强迫早期囤钱升本）：
  //   第 1 ~ 2 年（进入 round 1 / 2）：最多 7 张手牌，7 张之后只升本
  //   第 3 年以后（进入 round 3+）：最多 11 张手牌
  const handCapByPhase = nextRoundIdx <= 2 ? 7 : 11;
  // 若本年需要的上阵槽位 > 上限（多队列时），至少保证能上满阵（+2 余量）
  const handCap = Math.max(handCapByPhase, slotsTotal + 2);

  // ===== 2) 主动花金币升等级（达到目标前不停） =====
  const target = targetRecruitLevel(nextRoundIdx);
  // 为避免把所有钱都花光，升级预算 ≤ 当前金币的 60%
  const upgradeBudgetCap = Math.floor(nextAI.gold * 0.6);
  let upgradeSpent = 0;
  while (
    nextAI.recruitLevel < target &&
    nextAI.gold >= 1 &&
    upgradeSpent < upgradeBudgetCap
  ) {
    nextAI.gold -= 1;
    upgradeSpent += 1;
    nextAI.recruitExp += 1;
    const need = LEVEL_EXP_REQUIRED[nextAI.recruitLevel];
    if (nextAI.recruitExp >= need) {
      nextAI.recruitExp -= need;
      nextAI.recruitLevel = (nextAI.recruitLevel + 1) as RecruitLevel;
      if (nextAI.recruitLevel >= 6) {
        nextAI.recruitExp = 0;
        break;
      }
    }
  }

  // ===== 3) 把阵上武将收回手牌（所有卡都参与下一轮决策） =====
  for (let ti = 0; ti < nextAI.teams.length; ti++) {
    for (let si = 0; si < nextAI.teams[ti].length; si++) {
      const c = nextAI.teams[ti][si];
      if (c) {
        nextAI.hand.push(c);
        nextAI.teams[ti][si] = null;
      }
    }
  }

  // ===== 4) 决策循环：买/换/升，直到收益不再 =====
  // 每一步基于"若采取此行动后，当前最优组阵的预估战力提升"做贪心决策
  const estimateBestPower = (hand: Card[]): number => {
    // 完整模拟组阵，返回最优总战力
    if (hand.length === 0) return 0;
    const teams = greedyPlace(hand, teamsNeed);
    let total = 0;
    for (let ti = 0; ti < teamsNeed; ti++) {
      total += teamPowerOf(teams[ti] ?? []);
    }
    return total;
  };

  // 限制决策最大步数，防止病态循环
  let steps = 0;
  const MAX_STEPS = 40;

  while (steps < MAX_STEPS) {
    steps++;
    let bestAction: 'buy' | 'redraw' | 'upgrade' | null = null;
    let bestGain = 0;
    const currentBest = estimateBestPower(nextAI.hand);

    // 评估：买一张新卡的边际收益（期望值）
    const nextBuyPrice = aiBuyCardPrice(nextAI.buyCount);
    // 按阶段限制手牌上限：达到上限后完全不买（强迫余钱升本）
    const canAffordBuy =
      nextAI.gold >= nextBuyPrice && nextAI.hand.length < handCap;
    // 还没有满到上阵数量时强行买；足量时看是否能挤下低价值的
    if (canAffordBuy) {
      // 期望收益近似：基于 pointValue 平均的一张新卡替换最差卡
      const lvUnlocked = Array.from(levelUnlockedValues(nextAI.recruitLevel));
      const avgValue =
        lvUnlocked.reduce((s, v) => s + v, 0) / Math.max(1, lvUnlocked.length);
      const worstExisting =
        nextAI.hand.length > 0
          ? Math.min(...nextAI.hand.map((c) => cardValue(c, nextAI.recruitLevel)))
          : 0;
      // 若手牌不足直接视为大收益
      const neededSlots = slotsTotal - nextAI.hand.length;
      const buyGain =
        neededSlots > 0
          ? 50 + avgValue * (teamsNeed >= 2 ? 6 : 3) // 强激励补满阵
          : Math.max(0, (avgValue - worstExisting) * (teamsNeed >= 2 ? 6 : 3));
      if (buyGain > bestGain) {
        bestGain = buyGain;
        bestAction = 'buy';
      }
    }

    // 评估：主动换掉手牌里最差的一张（若免费或值得付费）
    // 仅在 hand >= slotsTotal 且有明显的"拖累卡"时考虑
    if (
      nextAI.hand.length >= slotsTotal &&
      (nextAI.freeRedrawsLeft > 0 || nextAI.gold >= PAID_REDRAW_COST)
    ) {
      const sortedHand = nextAI.hand
        .map((c, i) => ({ c, i, v: cardValue(c, nextAI.recruitLevel) }))
        .sort((a, b) => a.v - b.v);
      const worst = sortedHand[0];
      if (worst) {
        const lvUnlocked = Array.from(levelUnlockedValues(nextAI.recruitLevel));
        const avgValue =
          lvUnlocked.reduce((s, v) => s + v, 0) /
          Math.max(1, lvUnlocked.length);
        // 期望收益：平均值 - 最差值
        const expectedGain = Math.max(0, (avgValue - worst.v) * 5);
        const useFree = nextAI.freeRedrawsLeft > 0;
        const costPenalty = useFree ? 0 : PAID_REDRAW_COST * 4; // 金币惩罚系数
        const netGain = expectedGain - costPenalty;
        if (netGain > bestGain) {
          bestGain = netGain;
          bestAction = 'redraw';
        }
      }
    }

    // 评估：继续升级
    // - 未达目标等级：优先升级
    // - 已达目标但 hand 已满（达到 handCap）：继续把余钱投入升本至 Lv.6
    const handFullNoBuy = nextAI.hand.length >= handCap;
    const canUpgradeToTarget = nextAI.recruitLevel < target;
    const canUpgradePastTarget =
      !canUpgradeToTarget &&
      handFullNoBuy &&
      nextAI.recruitLevel < 6;
    if ((canUpgradeToTarget || canUpgradePastTarget) && nextAI.gold >= 1) {
      const need = LEVEL_EXP_REQUIRED[nextAI.recruitLevel] - nextAI.recruitExp;
      // 手牌已满时强烈激励升本（替代买卡消费出口），给更高分数
      const base = need <= nextAI.gold ? 35 : 8;
      const upgradeGain = handFullNoBuy ? base + 20 : base;
      if (upgradeGain > bestGain) {
        bestGain = upgradeGain;
        bestAction = 'upgrade';
      }
    }

    if (!bestAction || bestGain <= 0) break;

    // 执行最优动作
    if (bestAction === 'buy') {
      const price = aiBuyCardPrice(nextAI.buyCount);
      const r = drawOneUnlockedFromDeck(workingDeck, nextAI.recruitLevel);
      if (!r.card) {
        // 池子空了，没得买 → 退出买卡
        break;
      }
      workingDeck = r.rest;
      nextAI.hand.push(r.card);
      nextAI.gold -= price;
      nextAI.buyCount += 1;
    } else if (bestAction === 'redraw') {
      // 把最差的一张换掉
      const sortedHand = nextAI.hand
        .map((c, i) => ({ c, i, v: cardValue(c, nextAI.recruitLevel) }))
        .sort((a, b) => a.v - b.v);
      const worst = sortedHand[0];
      if (!worst) break;
      // 把被换掉的放回 deck，再抽一张
      const removed = nextAI.hand.splice(worst.i, 1)[0];
      workingDeck = workingDeck.concat(removed);
      const r = drawOneUnlockedFromDeck(workingDeck, nextAI.recruitLevel);
      if (!r.card) {
        // 抽不到，还原
        nextAI.hand.splice(worst.i, 0, removed);
        break;
      }
      workingDeck = r.rest;
      nextAI.hand.push(r.card);
      // 结算换牌成本
      if (nextAI.freeRedrawsLeft > 0) nextAI.freeRedrawsLeft -= 1;
      else nextAI.gold -= PAID_REDRAW_COST;

      // 如果换完战力反而下降，记录但仍保留（随机性的一部分）
      const afterBest = estimateBestPower(nextAI.hand);
      if (afterBest < currentBest - 5) {
        // 非常罕见，忽略回滚
      }
    } else if (bestAction === 'upgrade') {
      nextAI.gold -= 1;
      nextAI.recruitExp += 1;
      const need = LEVEL_EXP_REQUIRED[nextAI.recruitLevel];
      if (nextAI.recruitExp >= need) {
        nextAI.recruitExp -= need;
        nextAI.recruitLevel = (nextAI.recruitLevel + 1) as RecruitLevel;
        if (nextAI.recruitLevel >= 6) nextAI.recruitExp = 0;
      }
    }
  }

  // ===== 5) 最终贪心组阵 =====
  const teams = greedyPlace(nextAI.hand, teamsNeed);
  nextAI.teams = [
    teams[0] ?? [null, null, null, null, null],
    teams[1] ?? [null, null, null, null, null],
  ];
  const placed = new Set<string>();
  for (const t of teams) for (const c of t) if (c) placed.add(c.id);
  nextAI.hand = nextAI.hand.filter((c) => !placed.has(c.id));

  const power0 = teamPowerOf(nextAI.teams[0]);
  const power1 = teamsNeed >= 2 ? teamPowerOf(nextAI.teams[1]) : 0;
  const total = power0 + power1;
  nextAI.lastTotalPower = total;

  return { ai: nextAI, deck: workingDeck, totalPower: total };
}

/** 某队的战力：满 5 张就走 evaluateHand，否则武勇和 × 1 */
function teamPowerOf(team: (Card | null)[]): number {
  const full = team.filter((c): c is Card => !!c);
  if (full.length === 5) {
    const ev = evaluateHand(full);
    return ev ? ev.power : 0;
  }
  return full.reduce((s, c) => s + c.pointValue, 0);
}

/**
 * 贪心布阵：从 hand 中挑 5 张组合出最高战力 × teamsNeed 次
 * 规模：hand <= 20 左右，C(20,5) = 15504 可接受
 */
function greedyPlace(
  hand: Card[],
  teamsNeed: number,
): (Card | null)[][] {
  const result: (Card | null)[][] = [];
  let pool = hand.slice();
  for (let t = 0; t < teamsNeed; t++) {
    if (pool.length < 5) {
      const team: (Card | null)[] = [null, null, null, null, null];
      for (let i = 0; i < Math.min(5, pool.length); i++) team[i] = pool[i];
      result.push(team);
      pool = [];
      continue;
    }
    const best = pickBestFive(pool);
    const team: (Card | null)[] = [null, null, null, null, null];
    for (let i = 0; i < 5; i++) team[i] = best[i];
    const pickedIds = new Set(best.map((c) => c.id));
    pool = pool.filter((c) => !pickedIds.has(c.id));
    result.push(team);
  }
  return result;
}

/** 枚举 C(n,5) 选战力最高的 5 张 */
function pickBestFive(pool: Card[]): Card[] {
  if (pool.length <= 5) return pool.slice(0, 5);

  const sorted = pool.slice().sort((a, b) => b.pointValue - a.pointValue);
  const candidates = sorted.slice(0, Math.min(12, sorted.length));
  const n = candidates.length;

  let bestPower = -1;
  let bestPick: Card[] = candidates.slice(0, 5);

  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const pick = [
              candidates[a],
              candidates[b],
              candidates[c],
              candidates[d],
              candidates[e],
            ];
            const ev = evaluateHand(pick);
            const p = ev ? ev.power : 0;
            if (p > bestPower) {
              bestPower = p;
              bestPick = pick;
            }
          }
        }
      }
    }
  }
  return bestPick;
}

/**
 * 淘汰规则（每回合）：
 * 1. 存活的所有玩家 + AI 随机两两配对（单数时轮空者本回合免战）
 * 2. 每对比较 totalPower，输者 hp -1；平手双方都不扣血
 * 3. hp 归零者本回合被淘汰
 */
export interface StandingEntry {
  kind: 'player' | 'ai';
  id: string;          // 玩家为 'player'，AI 为 ai.id
  name: string;
  totalPower: number;
  hp: number;
  eliminated: boolean;
}

export function buildStandings(
  playerTotalPower: number,
  playerHp: number,
  playerEliminated: boolean,
  ais: AIState[],
): StandingEntry[] {
  const list: StandingEntry[] = [];
  list.push({
    kind: 'player',
    id: 'player',
    name: '主公',
    totalPower: playerTotalPower,
    hp: playerHp,
    eliminated: playerEliminated,
  });
  for (const a of ais) {
    list.push({
      kind: 'ai',
      id: a.id,
      name: a.name,
      totalPower: a.lastTotalPower,
      hp: a.hp,
      eliminated: a.eliminatedAtRound !== null,
    });
  }
  // 按战力降序
  list.sort((a, b) => b.totalPower - a.totalPower);
  return list;
}

export interface DuelEntry {
  aId: string;
  aName: string;
  aPower: number;
  bId: string;
  bName: string;
  bPower: number;
  winnerId: string | null; // null = 平手
}

export interface DuelResult {
  duels: DuelEntry[];
  byeId: string | null;    // 轮空者 id（单数时）
  byeName: string | null;
}

/**
 * 随机配对对战：
 * 入参 entries = 所有存活的玩家/AI 简化条目
 * 返回对战明细 + 每个人新血量（map: id → 扣血数）
 */
export function runDuels(
  entries: { id: string; name: string; totalPower: number }[],
): { result: DuelResult; hpDelta: Record<string, number> } {
  const shuffled = entries.slice();
  // Fisher-Yates
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const duels: DuelEntry[] = [];
  const hpDelta: Record<string, number> = {};
  for (const e of shuffled) hpDelta[e.id] = 0;

  let byeId: string | null = null;
  let byeName: string | null = null;
  let i = 0;
  while (i < shuffled.length) {
    if (i === shuffled.length - 1) {
      // 单数剩 1 人 → 轮空
      byeId = shuffled[i].id;
      byeName = shuffled[i].name;
      i++;
      break;
    }
    const a = shuffled[i];
    const b = shuffled[i + 1];
    let winnerId: string | null;
    const diff = Math.abs(a.totalPower - b.totalPower);
    if (a.totalPower > b.totalPower) {
      winnerId = a.id;
      hpDelta[b.id] -= diff;
    } else if (b.totalPower > a.totalPower) {
      winnerId = b.id;
      hpDelta[a.id] -= diff;
    } else {
      winnerId = null;
    }
    duels.push({
      aId: a.id,
      aName: a.name,
      aPower: a.totalPower,
      bId: b.id,
      bName: b.name,
      bPower: b.totalPower,
      winnerId,
    });
    i += 2;
  }

  return {
    result: { duels, byeId, byeName },
    hpDelta,
  };
}

/** 解锁表的展示（供 DeckDrawer 可读映射） */
export { LEVEL_UNLOCK_TABLE };
