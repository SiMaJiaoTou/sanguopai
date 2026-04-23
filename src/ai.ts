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
  teams: (Card | null)[][];        // 2 × 5，固定 2 队保留
  gold: number;
  recruitLevel: RecruitLevel;
  recruitExp: number;
  lastTotalPower: number;          // 上一回合结算的总战力（用于排名）
  hp: number;                      // 生命值（3 点）
  eliminatedAtRound: number | null; // null = 存活；数字 = 在第 N 年被淘汰
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
    lastTotalPower: 0,
    hp: INITIAL_HP,
    eliminatedAtRound: null,
  }));
}

/** 从牌库中按等级解锁池抽一张，并返回剩余牌库 */
function drawOneUnlockedFromDeck(
  deck: Card[],
  level: number,
): { card: Card | null; rest: Card[] } {
  const unlocked = levelUnlockedValues(level);
  const indices: number[] = [];
  for (let i = 0; i < deck.length; i++) {
    if (unlocked.has(deck[i].pointValue)) indices.push(i);
  }
  if (indices.length === 0) return { card: null, rest: deck };
  const pickIdx = indices[Math.floor(Math.random() * indices.length)];
  const card = deck[pickIdx];
  const rest = deck.slice(0, pickIdx).concat(deck.slice(pickIdx + 1));
  return { card, rest };
}

/** 买卡价格（与玩家同步规则：1, 2, 3, ...） */
function aiBuyCardPrice(buyCount: number): number {
  return 1 + buyCount;
}

/** 模拟 AI 一回合行动：结算收入 → 购买 → 布阵 → 返回该回合总战力 */
export interface AITurnResult {
  ai: AIState;
  deck: Card[];
  totalPower: number;
}

/**
 * 为 AI 模拟完整一回合：
 *  1) 获得本回合金币/经验（round >= 1 时才执行）
 *  2) 用剩余金币尽量多买卡（循环买直到钱不够）
 *  3) 贪心组阵：
 *     - 挑出 5 张最高点数 + 同阵营优先组合（穷举小规模）
 *     - 若本回合需要 2 队，则前 5 强 → team0，次 5 强 → team1
 *  4) 返回本回合总战力
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

  // 1) 年度收入 + 经验升级（模拟与 nextRound 同步）
  nextAI.gold += cfg.yearIncome;
  let lv = nextAI.recruitLevel;
  let exp = nextAI.recruitExp + cfg.expGain;
  while (lv < 6 && exp >= LEVEL_EXP_REQUIRED[lv]) {
    exp -= LEVEL_EXP_REQUIRED[lv];
    lv = (lv + 1) as RecruitLevel;
  }
  if (lv >= 6) exp = 0;
  nextAI.recruitLevel = lv;
  nextAI.recruitExp = exp;

  // 2) 买卡策略：
  //    - 先把等级拉到能覆盖最大解锁 (可选)
  //    - 每次花 1 金币升 1 点经验，直到 >=5 等级或金币不足
  //    - 剩余金币用来买卡，直到需要凑满 2 × 5 = 10 张 或 钱不够
  const teamsNeed = cfg.teamsRequired;
  const slotsTotal = teamsNeed * 5;

  // 先尝试把等级升到目标（根据回合）
  const targetLevel =
    nextRoundIdx >= 5 ? 6 : nextRoundIdx >= 3 ? 4 : nextRoundIdx >= 2 ? 3 : 2;
  while (
    nextAI.recruitLevel < targetLevel &&
    nextAI.gold >= 1
  ) {
    nextAI.gold -= 1;
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

  // 计算总持有（手牌 + 已上阵）武将数量，先把阵上武将取回手牌做全局优选
  for (let ti = 0; ti < nextAI.teams.length; ti++) {
    for (let si = 0; si < nextAI.teams[ti].length; si++) {
      const c = nextAI.teams[ti][si];
      if (c) {
        nextAI.hand.push(c);
        nextAI.teams[ti][si] = null;
      }
    }
  }

  // 循环买卡，直到足够上阵或金币不够
  let buyCount = 0; // AI 内部买卡递增计数（不与玩家共享）
  // 估计需要的卡数量：至少达到 slotsTotal + 1 的余量
  const desired = slotsTotal + 1;
  while (nextAI.hand.length < desired) {
    const price = aiBuyCardPrice(buyCount);
    if (nextAI.gold < price) break;
    const r = drawOneUnlockedFromDeck(workingDeck, nextAI.recruitLevel);
    if (!r.card) break;
    workingDeck = r.rest;
    nextAI.hand.push(r.card);
    nextAI.gold -= price;
    buyCount += 1;
  }

  // 3) 贪心布阵
  const teams = greedyPlace(nextAI.hand, teamsNeed);
  nextAI.teams = [
    teams[0] ?? [null, null, null, null, null],
    teams[1] ?? [null, null, null, null, null],
  ];
  // 把剩余没上阵的留在 hand（AI 不需要管手牌形态，留作展示）
  const placed = new Set<string>();
  for (const t of teams) for (const c of t) if (c) placed.add(c.id);
  nextAI.hand = nextAI.hand.filter((c) => !placed.has(c.id));

  // 4) 计算本回合总战力
  const power0 = teamPower(nextAI.teams[0]);
  const power1 = teamsNeed >= 2 ? teamPower(nextAI.teams[1]) : 0;
  const total = power0 + power1;
  nextAI.lastTotalPower = total;

  return { ai: nextAI, deck: workingDeck, totalPower: total };
}

/** 某队的战力：满 5 张就走 evaluateHand，否则武勇和 × 1 */
function teamPower(team: (Card | null)[]): number {
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
      // 不够组一队，直接把剩余塞进这队
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
  // 若恰好 5 张直接返回
  if (pool.length <= 5) return pool.slice(0, 5);

  // 剪枝：先按点数降序排 & 只保留前 12 张（太多的低分卡没意义）
  const sorted = pool.slice().sort((a, b) => b.pointValue - a.pointValue);
  const candidates = sorted.slice(0, Math.min(12, sorted.length));
  const n = candidates.length;

  let bestPower = -1;
  let bestPick: Card[] = candidates.slice(0, 5);

  // 五重循环枚举 C(n,5)
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
