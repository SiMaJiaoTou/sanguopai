import { create } from 'zustand';
import type { Card, RecruitLevel } from './types';
import {
  FINAL_ROUND,
  ROUND_CONFIGS,
  generateDeck,
  shuffle,
  ECONOMY_CONFIG,
  LEVEL_EXP_REQUIRED,
  levelUnlockedValues,
} from './data';

export interface PowerSnapshot {
  round: number;
  team0Power: number;
  team1Power: number;
  totalPower: number;
  gold: number;
  recruitLevel: number;
}

export interface GameState {
  deck: Card[];                       // 全局未抽出的卡牌（含所有点数，但买牌只会抽出已解锁的）
  hand: Card[];
  teams: (Card | null)[][];           // 2 × 5
  round: number;
  isFinished: boolean;
  powerHistory: PowerSnapshot[];

  // 经济
  gold: number;
  buyCount: number;                   // 本局已买牌次数（用于递增价格）

  // 招募
  recruitLevel: RecruitLevel;
  recruitExp: number;                 // 当前等级的经验值

  // 换牌
  freeRedrawsLeft: number;

  // 提示
  lastMessage: string | null;         // 简短操作反馈（如"招募失败：已无可招卡"）

  // 动作
  startNewGame: () => void;
  moveCard: (fromId: string, toSlot: SlotTarget) => void;
  redraw: (cardId: string) => void;   // 智能换牌：有免费次数用免费，否则付 2 金币
  buyCard: () => void;
  upgradeLevel: () => void;           // 花金币 +1 exp，若满则升级
  nextRound: (snapshot: PowerSnapshot) => void;
  settleFinal: (snapshot: PowerSnapshot) => void;
  autoPlace: () => void;
  clearMessage: () => void;

  // GM 调试接口
  gmGrantGold: (amount: number) => void;
  gmMaxLevel: () => void;
  gmFillHand: () => void;
}

export type SlotTarget =
  | { type: 'hand' }
  | { type: 'team'; teamIndex: number; slotIndex: number };

function createEmptyTeams(): (Card | null)[][] {
  return [
    [null, null, null, null, null],
    [null, null, null, null, null],
  ];
}

function findLocation(
  state: Pick<GameState, 'hand' | 'teams'>,
  cardId: string,
):
  | { zone: 'hand'; index: number }
  | { zone: 'team'; teamIndex: number; slotIndex: number }
  | null {
  const hi = state.hand.findIndex((c) => c.id === cardId);
  if (hi >= 0) return { zone: 'hand', index: hi };
  for (let ti = 0; ti < state.teams.length; ti++) {
    for (let si = 0; si < state.teams[ti].length; si++) {
      if (state.teams[ti][si]?.id === cardId) {
        return { zone: 'team', teamIndex: ti, slotIndex: si };
      }
    }
  }
  return null;
}

export function buyCardPrice(buyCount: number): number {
  return ECONOMY_CONFIG.buyCardBasePrice + buyCount * ECONOMY_CONFIG.buyCardPriceDelta;
}

/** 从 deck 中按当前等级解锁池抽一张；失败返回 null */
function drawOneUnlocked(deck: Card[], level: number): { card: Card | null; rest: Card[] } {
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

export const useGameStore = create<GameState>((set, get) => ({
  deck: [],
  hand: [],
  teams: createEmptyTeams(),
  round: 0,
  isFinished: false,
  powerHistory: [],
  gold: 0,
  buyCount: 0,
  recruitLevel: 1,
  recruitExp: 0,
  freeRedrawsLeft: 0,
  lastMessage: null,

  startNewGame: () => {
    const shuffled = shuffle(generateDeck());
    const cfg = ROUND_CONFIGS[0];
    // 开局抽 5 张，但只能抽到 Lv1 解锁池内的（3~6 点）
    const level = 1;
    let working = shuffled;
    const drawn: Card[] = [];
    for (let i = 0; i < cfg.initialDrawCount; i++) {
      const r = drawOneUnlocked(working, level);
      if (r.card) {
        drawn.push(r.card);
        working = r.rest;
      }
    }
    set({
      deck: working,
      hand: drawn,
      teams: createEmptyTeams(),
      round: 0,
      isFinished: false,
      powerHistory: [],
      gold: ECONOMY_CONFIG.initialGold,
      buyCount: 0,
      recruitLevel: 1,
      recruitExp: 0,
      freeRedrawsLeft: cfg.freeRedrawsGain,
      lastMessage: '新局开始 · 点击【招募】按钮买卡组建军团',
    });
  },

  moveCard: (fromId, toSlot) => {
    const state = get();
    const loc = findLocation(state, fromId);
    if (!loc) return;
    const hand = state.hand.slice();
    const teams = state.teams.map((t) => t.slice());

    let moving: Card | null = null;
    if (loc.zone === 'hand') moving = hand.splice(loc.index, 1)[0] ?? null;
    else {
      moving = teams[loc.teamIndex][loc.slotIndex];
      teams[loc.teamIndex][loc.slotIndex] = null;
    }
    if (!moving) return;

    if (toSlot.type === 'hand') {
      hand.push(moving);
    } else {
      const { teamIndex, slotIndex } = toSlot;
      const existing = teams[teamIndex][slotIndex];
      teams[teamIndex][slotIndex] = moving;
      if (existing) {
        if (loc.zone === 'hand') hand.push(existing);
        else teams[loc.teamIndex][loc.slotIndex] = existing;
      }
    }
    set({ hand, teams });
  },

  redraw: (cardId) => {
    const state = get();
    const loc = findLocation(state, cardId);
    if (!loc) return;

    // 计算是否足够支付
    const useFree = state.freeRedrawsLeft > 0;
    if (!useFree && state.gold < ECONOMY_CONFIG.paidRedrawCost) {
      set({ lastMessage: '金币不足，无法付费换牌' });
      return;
    }

    const hand = state.hand.slice();
    const teams = state.teams.map((t) => t.slice());
    let removed: Card | null = null;
    if (loc.zone === 'hand') removed = hand.splice(loc.index, 1)[0] ?? null;
    else {
      removed = teams[loc.teamIndex][loc.slotIndex];
      teams[loc.teamIndex][loc.slotIndex] = null;
    }
    if (!removed) return;

    // 从当前等级解锁池中换一张
    const pool = shuffle([...state.deck, removed]);
    const r = drawOneUnlocked(pool, state.recruitLevel);
    if (!r.card) {
      set({ lastMessage: '已无可换的武将（当前等级池耗尽）' });
      return;
    }
    if (loc.zone === 'hand') hand.splice(loc.index, 0, r.card);
    else teams[loc.teamIndex][loc.slotIndex] = r.card;

    set({
      deck: r.rest,
      hand,
      teams,
      freeRedrawsLeft: useFree ? state.freeRedrawsLeft - 1 : state.freeRedrawsLeft,
      gold: useFree ? state.gold : state.gold - ECONOMY_CONFIG.paidRedrawCost,
      lastMessage: useFree ? '已使用免费换将令' : `付费换牌 -${ECONOMY_CONFIG.paidRedrawCost} 金币`,
    });
  },

  buyCard: () => {
    const state = get();
    if (state.isFinished) return;
    const price = buyCardPrice(state.buyCount);
    if (state.gold < price) {
      set({ lastMessage: `金币不足！招募需 ${price} 金币` });
      return;
    }
    const r = drawOneUnlocked(state.deck, state.recruitLevel);
    if (!r.card) {
      set({ lastMessage: '当前等级卡池已耗尽，请升级解锁' });
      return;
    }
    set({
      deck: r.rest,
      hand: [...state.hand, r.card],
      gold: state.gold - price,
      buyCount: state.buyCount + 1,
      lastMessage: `招募成功：${r.card.name} -${price} 金币`,
    });
  },

  upgradeLevel: () => {
    const state = get();
    if (state.recruitLevel >= 6) {
      set({ lastMessage: '已达满级 (Lv.6)' });
      return;
    }
    const need = LEVEL_EXP_REQUIRED[state.recruitLevel];
    const remaining = need - state.recruitExp;
    // 升一级所需金币 = 剩余所需经验（1 金币 = 1 经验）
    if (state.gold < remaining) {
      set({ lastMessage: `升级需 ${remaining} 金币（当前 ${state.gold}）` });
      return;
    }
    const nextLevel = (state.recruitLevel + 1) as RecruitLevel;
    set({
      gold: state.gold - remaining,
      recruitLevel: nextLevel,
      recruitExp: 0,
      lastMessage: `招募等级提升至 Lv.${nextLevel}！解锁新卡池`,
    });
  },

  nextRound: (snapshot) => {
    const state = get();
    if (state.isFinished) return;
    if (state.round >= FINAL_ROUND) {
      set({ isFinished: true, powerHistory: [...state.powerHistory, snapshot] });
      return;
    }
    const nextRoundIdx = state.round + 1;
    const cfg = ROUND_CONFIGS[nextRoundIdx];
    if (!cfg) return;

    // 自动升级经验结算
    let level = state.recruitLevel;
    let exp = state.recruitExp + cfg.expGain;
    while (level < 6 && exp >= LEVEL_EXP_REQUIRED[level]) {
      exp -= LEVEL_EXP_REQUIRED[level];
      level = (level + 1) as RecruitLevel;
    }
    if (level >= 6) exp = 0;

    set({
      round: nextRoundIdx,
      freeRedrawsLeft: state.freeRedrawsLeft + cfg.freeRedrawsGain,
      gold: state.gold + cfg.yearIncome,
      powerHistory: [...state.powerHistory, snapshot],
      recruitLevel: level,
      recruitExp: exp,
      lastMessage: `进入${cfg.description} · 收入 +${cfg.yearIncome} 金币，经验 +${cfg.expGain}`,
    });
  },

  settleFinal: (snapshot) => {
    const state = get();
    if (state.isFinished) return;
    const last = state.powerHistory[state.powerHistory.length - 1];
    const history =
      last && last.round === snapshot.round
        ? [...state.powerHistory.slice(0, -1), snapshot]
        : [...state.powerHistory, snapshot];
    set({ isFinished: true, powerHistory: history });
  },

  autoPlace: () => {
    const state = get();
    const hand = state.hand.slice();
    const teams = state.teams.map((t) => t.slice());
    const cfg = ROUND_CONFIGS[state.round];
    const teamsNeed = cfg.teamsRequired;
    for (let ti = 0; ti < teamsNeed; ti++) {
      for (let si = 0; si < 5; si++) {
        if (teams[ti][si] === null && hand.length > 0) {
          teams[ti][si] = hand.shift()!;
        }
      }
    }
    set({ hand, teams });
  },

  clearMessage: () => set({ lastMessage: null }),

  // ================= GM 调试 =================
  gmGrantGold: (amount) => {
    const s = get();
    set({
      gold: s.gold + amount,
      lastMessage: `【天降令牌】金库 +${amount} 金币`,
    });
  },

  gmMaxLevel: () => {
    set({
      recruitLevel: 6,
      recruitExp: 0,
      lastMessage: '【天降令牌】主公府直升 Lv.6',
    });
  },

  gmFillHand: () => {
    const s = get();
    let working = s.deck;
    const drawn: Card[] = [];
    for (let i = 0; i < 5; i++) {
      const r = drawOneUnlocked(working, s.recruitLevel);
      if (!r.card) break;
      drawn.push(r.card);
      working = r.rest;
    }
    set({
      deck: working,
      hand: [...s.hand, ...drawn],
      lastMessage: `【天降令牌】召唤 ${drawn.length} 员武将`,
    });
  },
}));
