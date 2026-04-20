import { create } from 'zustand';
import type { Card } from './types';
import { FINAL_ROUND, ROUND_CONFIGS, generateDeck, shuffle } from './data';

/**
 * 状态建模：
 *  - deck：牌库（未抽到手上的卡）
 *  - hand：手牌区（未上阵的卡）
 *  - teams：出战队伍槽，固定 2 个队伍每队 5 槽（null=空）
 *      回合 1~2 只使用 teams[0]；回合 3+ 两个队伍都使用。
 *  - round: 当前回合 0~6
 *  - redrawsLeft: 剩余换牌次数
 *  - isFinished: 是否已经结算完第 6 回合
 */
export interface PowerSnapshot {
  round: number;        // 该快照对应的回合编号（刚结算的那一回合）
  team0Power: number;
  team1Power: number;
  totalPower: number;
}

export interface GameState {
  deck: Card[];
  hand: Card[];
  teams: (Card | null)[][]; // 2 × 5
  round: number;
  redrawsLeft: number;
  isFinished: boolean;
  powerHistory: PowerSnapshot[]; // 每回合结算后的战力快照（折线图数据源）

  // 动作
  startNewGame: () => void;
  moveCard: (fromId: string, toSlot: SlotTarget) => void;
  redraw: (cardId: string) => void;
  nextRound: (snapshot: PowerSnapshot) => void;
  settleFinal: (snapshot: PowerSnapshot) => void;
  autoPlace: () => void; // 辅助：把手牌自动放到空槽
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

/** 从牌堆顶抽 n 张 */
function drawFromDeck(deck: Card[], n: number): { drawn: Card[]; rest: Card[] } {
  const drawn = deck.slice(0, n);
  const rest = deck.slice(n);
  return { drawn, rest };
}

/** 查询卡所在位置 */
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

export const useGameStore = create<GameState>((set, get) => ({
  deck: [],
  hand: [],
  teams: createEmptyTeams(),
  round: 0,
  redrawsLeft: 0,
  isFinished: false,
  powerHistory: [],

  startNewGame: () => {
    const shuffled = shuffle(generateDeck());
    const cfg = ROUND_CONFIGS[0];
    const { drawn, rest } = drawFromDeck(shuffled, cfg.drawCount);
    set({
      deck: rest,
      hand: drawn,
      teams: createEmptyTeams(),
      round: 0,
      redrawsLeft: cfg.redrawsGain,
      isFinished: false,
      powerHistory: [],
    });
  },

  moveCard: (fromId, toSlot) => {
    const state = get();
    const loc = findLocation(state, fromId);
    if (!loc) return;

    // 深拷贝引用（浅复制数组足够，因为 Card 不可变）
    const hand = state.hand.slice();
    const teams = state.teams.map((t) => t.slice());

    // 取出源卡
    let moving: Card | null = null;
    if (loc.zone === 'hand') {
      moving = hand.splice(loc.index, 1)[0] ?? null;
    } else {
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
      // 若目标已有卡：若源是 hand，则被挤出的卡回 hand；若源是另一个 team 槽，则交换
      if (existing) {
        if (loc.zone === 'hand') {
          hand.push(existing);
        } else {
          teams[loc.teamIndex][loc.slotIndex] = existing;
        }
      }
    }

    set({ hand, teams });
  },

  redraw: (cardId) => {
    const state = get();
    if (state.redrawsLeft <= 0) return;
    const loc = findLocation(state, cardId);
    if (!loc) return;

    const hand = state.hand.slice();
    const teams = state.teams.map((t) => t.slice());
    let removed: Card | null = null;

    if (loc.zone === 'hand') {
      removed = hand.splice(loc.index, 1)[0] ?? null;
    } else {
      removed = teams[loc.teamIndex][loc.slotIndex];
      teams[loc.teamIndex][loc.slotIndex] = null;
    }
    if (!removed) return;

    // 塞回 deck 并洗牌
    const newDeck = shuffle([...state.deck, removed]);
    if (newDeck.length === 0) return;
    const newCard = newDeck.shift()!;

    if (loc.zone === 'hand') {
      hand.splice(loc.index, 0, newCard);
    } else {
      teams[loc.teamIndex][loc.slotIndex] = newCard;
    }

    set({
      deck: newDeck,
      hand,
      teams,
      redrawsLeft: state.redrawsLeft - 1,
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
    const { drawn, rest } = drawFromDeck(state.deck, cfg.drawCount);

    set({
      deck: rest,
      hand: [...state.hand, ...drawn],
      round: nextRoundIdx,
      redrawsLeft: state.redrawsLeft + cfg.redrawsGain,
      powerHistory: [...state.powerHistory, snapshot],
    });
  },

  settleFinal: (snapshot) => {
    const state = get();
    if (state.isFinished) return;
    // 避免重复推入：若最后一次快照已经是终局回合，则覆盖
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
}));
