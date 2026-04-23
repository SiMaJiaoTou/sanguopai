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
import {
  type AIState,
  createInitialAIs,
  simulateAITurn,
  runDuels,
  type DuelResult,
  INITIAL_HP,
} from './ai';
import {
  type TalentInstance,
  rollTalents,
  buildEvalContext,
} from './talents';

export type GameMode = 'normal' | 'empowered';

export interface PowerSnapshot {
  round: number;
  team0Power: number;
  team1Power: number;
  totalPower: number;
  gold: number;
  recruitLevel: number;
  /** 本回合玩家是否触发至少一次同心（用于天赐结算） */
  anyFlush?: boolean;
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

  // 七路诸侯 AI
  ais: AIState[];
  playerHp: number;                        // 玩家剩余血量（初始 3）
  playerEliminatedAtRound: number | null;  // 玩家被淘汰的年份
  /** 每回合对战战报 */
  duelLog: { round: number; result: DuelResult; hpDelta: Record<string, number> }[];

  // 威力加强模式（天赐系统）
  mode: GameMode;
  modeChosen: boolean;             // 用户是否已经选过模式（用来决定要不要弹初始弹窗）
  talents: TalentInstance[];       // 已获取的天赐
  pendingTalentChoices: TalentInstance[] | null; // 本回合 3 选 1 的候选（null = 无待选）
  pendingTalentRound: number | null;             // 待选是哪一年触发的
  /** 一次性天赐：本回合效果生效标记 */
  doubleThisRoundActive: boolean;

  // 动作
  startNewGame: () => void;
  chooseMode: (mode: GameMode) => void;
  pickTalent: (talentId: string) => void;
  moveCard: (fromId: string, toSlot: SlotTarget) => void;
  redraw: (cardId: string) => void;   // 智能换牌：有免费次数用免费，否则付 2 金币
  buyCard: () => void;
  upgradeLevel: () => void;           // 花金币 +1 exp，若满则升级
  nextRound: (snapshot: PowerSnapshot) => void;
  settleFinal: (snapshot: PowerSnapshot) => void;
  autoPlace: () => void;
  recallAll: () => void;
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
  ais: [],
  playerHp: INITIAL_HP,
  playerEliminatedAtRound: null,
  duelLog: [],
  mode: 'normal',
  modeChosen: false,
  talents: [],
  pendingTalentChoices: null,
  pendingTalentRound: null,
  doubleThisRoundActive: false,

  startNewGame: () => {
    const shuffled = shuffle(generateDeck());
    const cfg = ROUND_CONFIGS[0];
    // 开局抽 5 张，但只能抽到 Lv1 解锁池内的（3~6 点）
    const level = 1;
    let working = shuffled;
    const drawn: Card[] = [];

    // 强制起手：一张刘备（蜀 · 15 点）
    const liubeiIdx = working.findIndex(
      (c) => c.faction === '蜀' && c.name === '刘备',
    );
    if (liubeiIdx >= 0) {
      drawn.push(working[liubeiIdx]);
      working = working.slice(0, liubeiIdx).concat(working.slice(liubeiIdx + 1));
    }

    // 剩余手牌从 Lv.1 解锁池中抽取，直到达到 initialDrawCount
    while (drawn.length < cfg.initialDrawCount) {
      const r = drawOneUnlocked(working, level);
      if (!r.card) break;
      drawn.push(r.card);
      working = r.rest;
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
      ais: createInitialAIs(),
      playerHp: INITIAL_HP,
      playerEliminatedAtRound: null,
      duelLog: [],
      // 保留 mode/modeChosen（用户本轮已选的模式跨重开延续）
      talents: [],
      pendingTalentChoices: null,
      pendingTalentRound: null,
      doubleThisRoundActive: false,
    });
  },

  chooseMode: (mode) => {
    set({ mode, modeChosen: true, lastMessage: mode === 'empowered' ? '已开启【威力加强模式】' : '沿用标准模式' });
  },

  pickTalent: (talentId) => {
    const state = get();
    const choices = state.pendingTalentChoices;
    if (!choices) return;
    const picked = choices.find((t) => t.id === talentId);
    if (!picked) return;

    // 新天赐入账（除 instant：应用即消耗）
    let nextTalents = state.talents;
    if (picked.kind === 'passive' || picked.kind === 'oneshot') {
      nextTalents = [...state.talents, picked];
    }

    // 应用天赐效果
    let deck = state.deck.slice();
    let hand = state.hand.slice();
    let teams = state.teams.map((t) => t.slice());
    let gold = state.gold;
    let playerHp = state.playerHp;
    let freeRedrawsLeft = state.freeRedrawsLeft;
    let doubleThisRoundActive = state.doubleThisRoundActive;
    let tips: string[] = [`获得天赐：${picked.name}`];

    const drawOne = (
      level: number,
      filter?: (c: Card) => boolean,
    ): Card | null => {
      const unlocked = levelUnlockedValues(level);
      const indices: number[] = [];
      for (let i = 0; i < deck.length; i++) {
        const c = deck[i];
        if (!unlocked.has(c.pointValue)) continue;
        if (filter && !filter(c)) continue;
        indices.push(i);
      }
      if (indices.length === 0) return null;
      const pickIdx = indices[Math.floor(Math.random() * indices.length)];
      const c = deck[pickIdx];
      deck = deck.slice(0, pickIdx).concat(deck.slice(pickIdx + 1));
      return c;
    };

    switch (picked.templateId) {
      case 'gold_8':
        gold += 8;
        tips.push('+8 金币');
        break;
      case 'no_flush_plus_gold':
        gold += 15;
        tips.push('+15 金币，从此同心效果被封印');
        break;
      case 'random_two_cards': {
        for (let i = 0; i < 2; i++) {
          const c = drawOne(state.recruitLevel);
          if (c) {
            hand.push(c);
            tips.push(`募得 ${c.name}`);
          }
        }
        break;
      }
      case 'full_heal':
        playerHp = INITIAL_HP;
        tips.push('气血已满');
        break;
      case 'draw_15': {
        const c = drawOne(state.recruitLevel, (c) => c.pointValue === 15);
        // 若当前等级没解锁 15，放宽一次，不限解锁
        const fallback = c
          ? c
          : (() => {
              const idxs: number[] = [];
              for (let i = 0; i < deck.length; i++) {
                if (deck[i].pointValue === 15) idxs.push(i);
              }
              if (idxs.length === 0) return null;
              const k = idxs[Math.floor(Math.random() * idxs.length)];
              const picked = deck[k];
              deck = deck.slice(0, k).concat(deck.slice(k + 1));
              return picked;
            })();
        if (fallback) {
          hand.push(fallback);
          tips.push(`天降 ${fallback.name}（战力 15）`);
        } else {
          tips.push('牌库已无 15 点武将');
        }
        break;
      }
      case 'double_this_round':
        doubleThisRoundActive = true;
        tips.push('本回合军势将翻倍');
        break;
      case 'random_reroll_all': {
        // 先把所有手牌 + 阵上武将放回牌库
        const backToDeck: Card[] = [];
        for (const c of hand) backToDeck.push(c);
        for (const t of teams) for (const c of t) if (c) backToDeck.push(c);
        deck = deck.concat(backToDeck);
        // 洗牌
        deck = shuffle(deck);
        // 统计原来持有多少张
        const originalCount = backToDeck.length;
        // 重新按当前等级抽同样数量
        hand = [];
        teams = createEmptyTeams();
        for (let i = 0; i < originalCount; i++) {
          const c = drawOne(state.recruitLevel);
          if (!c) break;
          hand.push(c);
        }
        tips.push(`乾坤一掷 · 换得 ${hand.length} 员新将`);
        break;
      }
      case 'free_redraws_3':
        freeRedrawsLeft += 3;
        tips.push('+3 免费换将令');
        break;
      default:
        // passive 天赐无直接结算，只入账
        break;
    }

    set({
      deck,
      hand,
      teams,
      gold,
      playerHp,
      freeRedrawsLeft,
      doubleThisRoundActive,
      talents: nextTalents,
      pendingTalentChoices: null,
      pendingTalentRound: null,
      lastMessage: tips.join(' · '),
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
    if (state.gold < 1) {
      set({ lastMessage: '金币不足（需 1 金币购买 1 威望）' });
      return;
    }
    const need = LEVEL_EXP_REQUIRED[state.recruitLevel];
    const newExp = state.recruitExp + 1;
    if (newExp >= need) {
      // 购买这一点经验后恰好升级
      const nextLevel = (state.recruitLevel + 1) as RecruitLevel;
      set({
        gold: state.gold - 1,
        recruitLevel: nextLevel,
        recruitExp: 0,
        lastMessage: `招募等级提升至 Lv.${nextLevel}！解锁新卡池`,
      });
    } else {
      set({
        gold: state.gold - 1,
        recruitExp: newExp,
        lastMessage: `威望 +1（${newExp}/${need}）`,
      });
    }
  },

  nextRound: (snapshot) => {
    const state = get();
    if (state.isFinished) return;

    // 最终回合 → settleFinal 处理
    if (state.round >= FINAL_ROUND) {
      set({ isFinished: true, powerHistory: [...state.powerHistory, snapshot] });
      return;
    }
    const nextRoundIdx = state.round + 1;
    const cfg = ROUND_CONFIGS[nextRoundIdx];
    if (!cfg) return;

    // 天赐（oneshot）：本回合战力翻倍
    let settledPlayerPower = snapshot.totalPower;
    if (state.doubleThisRoundActive) {
      settledPlayerPower *= 2;
    }
    // 用于排名与对战的 snapshot 覆盖
    const battleSnapshot: PowerSnapshot = {
      ...snapshot,
      totalPower: settledPlayerPower,
    };

    // === 1. 模拟 7 位 AI 的行动（共享同一副牌库 deck） ===
    let workingDeck = state.deck.slice();
    const newAIs: AIState[] = [];
    for (const ai of state.ais) {
      if (ai.eliminatedAtRound !== null) {
        newAIs.push(ai);
        continue;
      }
      const r = simulateAITurn(ai, workingDeck, nextRoundIdx);
      workingDeck = r.deck;
      newAIs.push(r.ai);
    }

    // === 2. 玩家自己的年度结算 ===
    let level = state.recruitLevel;
    let exp = state.recruitExp + cfg.expGain;
    while (level < 6 && exp >= LEVEL_EXP_REQUIRED[level]) {
      exp -= LEVEL_EXP_REQUIRED[level];
      level = (level + 1) as RecruitLevel;
    }
    if (level >= 6) exp = 0;

    // 天赐：结算同心时获得 +8 金币
    let bonusGold = 0;
    const hasFlushGold = state.talents.some((t) => t.templateId === 'flush_gives_8_gold');
    if (hasFlushGold && snapshot.anyFlush) {
      bonusGold += 8;
    }

    // === 3. 随机两两对战：输者按战力差扣血 ===
    const duelEntries: { id: string; name: string; totalPower: number }[] = [];
    duelEntries.push({
      id: 'player',
      name: '主公',
      totalPower: settledPlayerPower,
    });
    for (const a of newAIs) {
      if (a.eliminatedAtRound === null) {
        duelEntries.push({
          id: a.id,
          name: a.name,
          totalPower: a.lastTotalPower,
        });
      }
    }
    const { result: duelResult, hpDelta } = runDuels(duelEntries);

    let newPlayerHp = state.playerHp + (hpDelta['player'] ?? 0);
    if (newPlayerHp < 0) newPlayerHp = 0;

    // 更新 AI 血量 & 淘汰状态
    const aisAfterDuel: AIState[] = newAIs.map((a) => {
      if (a.eliminatedAtRound !== null) return a;
      const delta = hpDelta[a.id] ?? 0;
      const nextHp = Math.max(0, a.hp + delta);
      if (nextHp <= 0) {
        return {
          ...a,
          hp: 0,
          eliminatedAtRound: snapshot.round,
        };
      }
      return { ...a, hp: nextHp };
    });

    let playerEliminatedAtRound = state.playerEliminatedAtRound;
    let eliminationMsg = '';
    if (newPlayerHp <= 0) {
      playerEliminatedAtRound = snapshot.round;
      eliminationMsg = ` · 主公血量耗尽，于第 ${snapshot.round} 年兵败！`;
    } else {
      const fallen = aisAfterDuel
        .filter((a) => a.eliminatedAtRound === snapshot.round)
        .map((a) => a.name);
      if (fallen.length > 0) {
        eliminationMsg = ` · 诸侯【${fallen.join('、')}】兵败身死`;
      }
    }

    const newDuelLog = [
      ...state.duelLog,
      { round: snapshot.round, result: duelResult, hpDelta },
    ];

    // 若玩家被淘汰 → 游戏结束（但仍保存 snapshot）
    if (playerEliminatedAtRound !== null) {
      set({
        deck: workingDeck,
        ais: aisAfterDuel,
        round: snapshot.round, // 停留在被淘汰的那一年
        isFinished: true,
        powerHistory: [...state.powerHistory, battleSnapshot],
        playerHp: newPlayerHp,
        playerEliminatedAtRound,
        duelLog: newDuelLog,
        doubleThisRoundActive: false,
        lastMessage: `诸侯混战 · 主公出局${eliminationMsg}`,
      });
      return;
    }

    // 天赐候选：威力加强模式下，进入第 2 / 第 4 年的年初触发
    let pendingTalentChoices: TalentInstance[] | null = state.pendingTalentChoices;
    let pendingTalentRound: number | null = state.pendingTalentRound;
    let talentMsg = '';
    if (
      state.mode === 'empowered' &&
      (nextRoundIdx === 2 || nextRoundIdx === 4)
    ) {
      pendingTalentChoices = rollTalents(state.talents);
      pendingTalentRound = nextRoundIdx;
      if (pendingTalentChoices.length > 0) {
        talentMsg = ' · 天赐之兆降临，三选其一';
      }
    }

    // 消耗 oneshot 天赐（double_this_round）
    let nextTalents = state.talents;
    if (state.doubleThisRoundActive) {
      nextTalents = state.talents.filter((t) => t.templateId !== 'double_this_round');
    }

    set({
      deck: workingDeck,
      ais: aisAfterDuel,
      round: nextRoundIdx,
      freeRedrawsLeft: state.freeRedrawsLeft + cfg.freeRedrawsGain,
      gold: state.gold + cfg.yearIncome + bonusGold,
      powerHistory: [...state.powerHistory, battleSnapshot],
      recruitLevel: level,
      recruitExp: exp,
      playerHp: newPlayerHp,
      playerEliminatedAtRound,
      duelLog: newDuelLog,
      doubleThisRoundActive: false,
      talents: nextTalents,
      pendingTalentChoices,
      pendingTalentRound,
      lastMessage: `进入${cfg.description} · 收入 +${cfg.yearIncome} 金币，经验 +${cfg.expGain}${eliminationMsg}${talentMsg}`,
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

    // 终局也做一次两两对战结算血量（最后一年的 AI 已经在前一次 nextRound 中模拟过）
    const duelEntries: { id: string; name: string; totalPower: number }[] = [];
    duelEntries.push({
      id: 'player',
      name: '主公',
      totalPower: snapshot.totalPower,
    });
    for (const a of state.ais) {
      if (a.eliminatedAtRound === null) {
        duelEntries.push({
          id: a.id,
          name: a.name,
          totalPower: a.lastTotalPower,
        });
      }
    }
    const { result: duelResult, hpDelta } = runDuels(duelEntries);
    let newPlayerHp = state.playerHp + (hpDelta['player'] ?? 0);
    if (newPlayerHp < 0) newPlayerHp = 0;
    const aisAfterDuel: AIState[] = state.ais.map((a) => {
      if (a.eliminatedAtRound !== null) return a;
      const delta = hpDelta[a.id] ?? 0;
      const nextHp = Math.max(0, a.hp + delta);
      if (nextHp <= 0) {
        return { ...a, hp: 0, eliminatedAtRound: snapshot.round };
      }
      return { ...a, hp: nextHp };
    });

    set({
      isFinished: true,
      powerHistory: history,
      playerHp: newPlayerHp,
      ais: aisAfterDuel,
      duelLog: [...state.duelLog, { round: snapshot.round, result: duelResult, hpDelta }],
    });
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

  recallAll: () => {
    const state = get();
    const hand = state.hand.slice();
    const teams = state.teams.map((t) => t.slice());
    let moved = 0;
    for (let ti = 0; ti < teams.length; ti++) {
      for (let si = 0; si < teams[ti].length; si++) {
        const c = teams[ti][si];
        if (c) {
          hand.push(c);
          teams[ti][si] = null;
          moved++;
        }
      }
    }
    if (moved === 0) {
      set({ lastMessage: '阵上尚无武将可撤' });
      return;
    }
    set({ hand, teams, lastMessage: `已撤回 ${moved} 员武将` });
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
