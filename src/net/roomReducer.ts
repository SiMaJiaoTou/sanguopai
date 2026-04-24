// 房间 reducer · host 端用来 dispatch 玩家意图
// -------------------------------------------------------------------
// 核心：纯函数 applyAction(room, from, action) → newRoom
// 共享牌库、同心发金、神马印记等机制与单机 store 保持一致

import type { Card, RecruitLevel } from '../types';
import {
  ROUND_CONFIGS,
  LEVEL_EXP_REQUIRED,
  ECONOMY_CONFIG,
  FINAL_ROUND,
  generateDeck,
  shuffle,
  levelUnlockedValues,
} from '../data';
import { buyCardPrice } from '../store';
import type { GameMode, PowerSnapshot } from '../store';
import type { GameAction } from './protocol';
import type { RoomState, PlayerSlot } from './roomTypes';
import { rollTalents, buildEvalContext } from '../talents';
import type { TalentInstance } from '../talents';
import { evaluateHand } from '../evaluate';
import { simulateAITurn, runDuels, INITIAL_HP } from '../ai';
import { applyRandomHorseSeals } from '../horseSeals';

// ------------------ 小工具 ------------------
function empty2x5(): (Card | null)[][] {
  return [
    [null, null, null, null, null],
    [null, null, null, null, null],
  ];
}

function findPlayerIdx(room: RoomState, peerId: string): number {
  return room.players.findIndex((p) => p.peerId === peerId);
}

function replacePlayer(
  room: RoomState,
  idx: number,
  next: PlayerSlot,
): RoomState {
  const players = room.players.slice();
  players[idx] = next;
  return { ...room, players };
}

function findLoc(
  slot: PlayerSlot,
  cardId: string,
):
  | { zone: 'hand'; index: number }
  | { zone: 'team'; teamIndex: number; slotIndex: number }
  | null {
  const hi = slot.hand.findIndex((c) => c.id === cardId);
  if (hi >= 0) return { zone: 'hand', index: hi };
  for (let ti = 0; ti < slot.teams.length; ti++) {
    for (let si = 0; si < slot.teams[ti].length; si++) {
      if (slot.teams[ti][si]?.id === cardId) {
        return { zone: 'team', teamIndex: ti, slotIndex: si };
      }
    }
  }
  return null;
}

/** 从 deck 中抽一张（当前等级解锁 + 可选 filter），返回新 deck & 卡 */
function drawOneFromDeck(
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
  const c = deck[pickIdx];
  return {
    card: c,
    rest: deck.slice(0, pickIdx).concat(deck.slice(pickIdx + 1)),
  };
}

// ------------------ 初始化 ------------------
export function createInitialRoom(
  roomCode: string,
  hostPeerId: string,
): RoomState {
  return {
    roomCode,
    hostPeerId,
    mode: 'normal',
    modeChosen: false,
    phase: 'lobby',
    round: 0,
    isFinished: false,
    players: Array.from({ length: 8 }, (_, i) => ({
      seatIdx: i,
      peerId: null,
      name: '',
      connected: false,
      isAI: false,
      hand: [],
      teams: empty2x5(),
      gold: 0,
      buyCount: 0,
      recruitLevel: 1 as RecruitLevel,
      recruitExp: 0,
      freeRedrawsLeft: 0,
      hp: INITIAL_HP,
      eliminatedAtRound: null,
      talents: [],
      pendingTalentChoices: null,
      pendingTalentRound: null,
      doubleThisRoundActive: false,
      ready: false,
      lastTotalPower: 0,
      lastHpDelta: 0,
    })),
    deck: [],
    powerHistoryByPeer: {},
    duelLog: [],
    lastMessage: null,
  };
}

/** 加入房间：找到第一个空座位写入 peerId/name */
export function joinPlayer(
  room: RoomState,
  peerId: string,
  name: string,
): RoomState {
  // 已存在就直接返回（重连情况在 HostEngine 里另外处理）
  if (room.players.some((p) => p.peerId === peerId)) return room;
  const idx = room.players.findIndex((p) => p.peerId === null);
  if (idx < 0) return room; // 满员
  const players = room.players.slice();
  players[idx] = {
    ...players[idx],
    peerId,
    name,
    connected: true,
    isAI: false,
  };
  return { ...room, players };
}

/** 某 peer 离开：保留座位数据，标记 isAI=true 交 AI 托管；或者主动退出就清空座位 */
export function markPeerGone(
  room: RoomState,
  peerId: string,
  hardLeave: boolean,
): RoomState {
  const idx = findPlayerIdx(room, peerId);
  if (idx < 0) return room;
  const slot = room.players[idx];
  if (room.phase === 'lobby' || hardLeave) {
    // 大厅阶段直接清空座位
    const players = room.players.slice();
    players[idx] = {
      seatIdx: idx,
      peerId: null,
      name: '',
      connected: false,
      isAI: false,
      hand: [],
      teams: empty2x5(),
      gold: 0,
      buyCount: 0,
      recruitLevel: 1 as RecruitLevel,
      recruitExp: 0,
      freeRedrawsLeft: 0,
      hp: INITIAL_HP,
      eliminatedAtRound: null,
      talents: [],
      pendingTalentChoices: null,
      pendingTalentRound: null,
      doubleThisRoundActive: false,
      ready: false,
      lastTotalPower: 0,
      lastHpDelta: 0,
    };
    return { ...room, players };
  }
  // 游戏中：标记掉线并移交 AI 托管
  return replacePlayer(room, idx, {
    ...slot,
    connected: false,
    isAI: true,
    aiPersona: slot.aiPersona ?? {
      name: slot.name || '诸侯',
      title: '托管',
    },
    // AI 托管者视作已就绪 / 已放弃天赐选择 —— 避免阻塞阶段推进
    ready: true,
    pendingTalentChoices: null,
    pendingTalentRound: null,
  });
}

// ------------------ dispatch ------------------
export function applyAction(
  room: RoomState,
  from: string,
  action: GameAction,
): RoomState {
  const idx = findPlayerIdx(room, from);
  if (idx < 0 && action.type !== 'chooseMode' && action.type !== 'startGame') {
    return room;
  }
  switch (action.type) {
    case 'chooseMode':
      if (from !== room.hostPeerId) return room;
      return {
        ...room,
        mode: action.mode,
        modeChosen: true,
        lastMessage:
          action.mode === 'empowered'
            ? '主公开启【威力加强模式】'
            : '主公沿用标准模式',
      };

    case 'startGame':
      if (from !== room.hostPeerId) return room;
      if (room.phase !== 'lobby') return room;
      return startGame(room);

    case 'buyCard':
      return applyBuy(room, idx);
    case 'upgradeLevel':
      return applyUpgrade(room, idx);
    case 'moveCard':
      return applyMoveCard(room, idx, action.fromId, action.to);
    case 'redraw':
      return applyRedraw(room, idx, action.cardId);
    case 'autoPlace':
      return applyAutoPlace(room, idx);
    case 'recallAll':
      return applyRecallAll(room, idx);
    case 'pickTalent':
      return applyPickTalent(room, idx, action.talentId);
    case 'ready':
      return applyReady(room, idx, true);
    case 'unready':
      return applyReady(room, idx, false);
    default:
      return room;
  }
}

// ------------------ startGame ------------------
function startGame(room: RoomState): RoomState {
  // 洗牌 + 可选盖神马印
  let deck = shuffle(generateDeck());
  if (room.mode === 'empowered') {
    deck = applyRandomHorseSeals(deck, 20);
  }

  // 把所有已占座位发手牌；空位 AI 托管
  const players = room.players.map((p) => {
    if (p.peerId === null && !p.isAI) {
      // 空位 → 填 AI 诸侯
      return { ...p };
    }
    return { ...p };
  });
  // 空位用"诸侯"名字填入 AI
  const aiNames = [
    { name: '袁绍', title: '四世三公' },
    { name: '袁术', title: '僭号仲氏' },
    { name: '刘表', title: '荆襄八俊' },
    { name: '马腾', title: '西凉铁骑' },
    { name: '公孙瓒', title: '白马义从' },
    { name: '张鲁', title: '汉中师君' },
    { name: '刘璋', title: '益州牧守' },
  ];
  let aiCursor = 0;
  for (let i = 0; i < players.length; i++) {
    if (players[i].peerId === null) {
      const persona = aiNames[aiCursor++ % aiNames.length];
      players[i] = {
        ...players[i],
        isAI: true,
        aiPersona: persona,
        name: persona.name,
        gold: ECONOMY_CONFIG.initialGold,
        hp: INITIAL_HP,
      };
    } else {
      players[i] = {
        ...players[i],
        gold: ECONOMY_CONFIG.initialGold,
        hp: INITIAL_HP,
      };
    }
  }

  // 人类玩家 & AI 均发起手牌：每人只发 1 张随机战力 15 点的牌（2 点面值 = 战力 15）
  const cfg = ROUND_CONFIGS[0];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const drawn: Card[] = [];
    let working = deck;

    // 战力 15 起手 = pointValue 15（HERO_TABLE 中 label '2' 那行）。
    // 注意：此处绕过等级解锁限制，因为 Lv.1 本来是解锁不到 15 的。
    const candidates: number[] = [];
    for (let k = 0; k < working.length; k++) {
      if (working[k].pointValue === 15) candidates.push(k);
    }
    if (candidates.length > 0) {
      const pickIdx =
        candidates[Math.floor(Math.random() * candidates.length)];
      drawn.push(working[pickIdx]);
      working = working
        .slice(0, pickIdx)
        .concat(working.slice(pickIdx + 1));
    }
    deck = working;
    if (p.isAI) {
      players[i] = { ...players[i], hand: drawn };
    } else {
      players[i] = {
        ...players[i],
        hand: drawn,
        freeRedrawsLeft: cfg.freeRedrawsGain,
        ready: false,
      };
    }
  }

  return {
    ...room,
    phase: 'prep',
    round: 0,
    isFinished: false,
    players,
    deck,
    powerHistoryByPeer: {},
    duelLog: [],
    lastMessage: '战鼓已擂！群雄共逐中原',
  };
}

// ------------------ 操作 ------------------
function applyBuy(room: RoomState, idx: number): RoomState {
  const p = room.players[idx];
  if (room.isFinished || p.eliminatedAtRound !== null) return room;
  const price = buyCardPrice(p.buyCount);
  if (p.gold < price) {
    return { ...room, lastMessage: `${p.name} 金币不足` };
  }
  const r = drawOneFromDeck(room.deck, p.recruitLevel);
  if (!r.card) {
    return { ...room, lastMessage: `${p.name} 牌池已空` };
  }
  const next: PlayerSlot = {
    ...p,
    hand: [...p.hand, r.card],
    gold: p.gold - price,
    buyCount: p.buyCount + 1,
  };
  return {
    ...replacePlayer(room, idx, next),
    deck: r.rest,
    lastMessage: `${p.name} 招募 ${r.card.name}`,
  };
}

function applyUpgrade(room: RoomState, idx: number): RoomState {
  const p = room.players[idx];
  if (p.recruitLevel >= 6 || p.gold < 1 || p.eliminatedAtRound !== null)
    return room;
  const need = LEVEL_EXP_REQUIRED[p.recruitLevel];
  const nextExp = p.recruitExp + 1;
  const next: PlayerSlot =
    nextExp >= need
      ? {
          ...p,
          gold: p.gold - 1,
          recruitLevel: (p.recruitLevel + 1) as RecruitLevel,
          recruitExp: 0,
        }
      : {
          ...p,
          gold: p.gold - 1,
          recruitExp: nextExp,
        };
  return replacePlayer(room, idx, next);
}

function applyMoveCard(
  room: RoomState,
  idx: number,
  fromId: string,
  to:
    | { type: 'hand' }
    | { type: 'team'; teamIndex: number; slotIndex: number },
): RoomState {
  const p = room.players[idx];
  const loc = findLoc(p, fromId);
  if (!loc) return room;
  const hand = p.hand.slice();
  const teams = p.teams.map((t) => t.slice());
  let moving: Card | null = null;
  if (loc.zone === 'hand') moving = hand.splice(loc.index, 1)[0] ?? null;
  else {
    moving = teams[loc.teamIndex][loc.slotIndex];
    teams[loc.teamIndex][loc.slotIndex] = null;
  }
  if (!moving) return room;
  if (to.type === 'hand') {
    hand.push(moving);
  } else {
    const { teamIndex, slotIndex } = to;
    const existing = teams[teamIndex][slotIndex];
    teams[teamIndex][slotIndex] = moving;
    if (existing) {
      if (loc.zone === 'hand') hand.push(existing);
      else teams[loc.teamIndex][loc.slotIndex] = existing;
    }
  }
  return replacePlayer(room, idx, { ...p, hand, teams });
}

function applyRedraw(
  room: RoomState,
  idx: number,
  cardId: string,
): RoomState {
  const p = room.players[idx];
  const loc = findLoc(p, cardId);
  if (!loc) return room;
  const useFree = p.freeRedrawsLeft > 0;
  if (!useFree && p.gold < ECONOMY_CONFIG.paidRedrawCost) {
    return { ...room, lastMessage: `${p.name} 金币不足换牌` };
  }
  const hand = p.hand.slice();
  const teams = p.teams.map((t) => t.slice());
  let removed: Card | null = null;
  if (loc.zone === 'hand') removed = hand.splice(loc.index, 1)[0] ?? null;
  else {
    removed = teams[loc.teamIndex][loc.slotIndex];
    teams[loc.teamIndex][loc.slotIndex] = null;
  }
  if (!removed) return room;
  const pool = shuffle([...room.deck, removed]);
  const r = drawOneFromDeck(pool, p.recruitLevel);
  if (!r.card) {
    return { ...room, lastMessage: '牌池无可换' };
  }
  if (loc.zone === 'hand') hand.splice(loc.index, 0, r.card);
  else teams[loc.teamIndex][loc.slotIndex] = r.card;

  const next: PlayerSlot = {
    ...p,
    hand,
    teams,
    freeRedrawsLeft:
      (useFree ? p.freeRedrawsLeft - 1 : p.freeRedrawsLeft) +
      (removed.horseSeal === 'chitu' ? 1 : 0),
    gold: useFree ? p.gold : p.gold - ECONOMY_CONFIG.paidRedrawCost,
  };
  return {
    ...replacePlayer(room, idx, next),
    deck: r.rest,
    lastMessage:
      removed.horseSeal === 'chitu'
        ? `【赤兔马】归山 · ${p.name} +1 免费换将`
        : useFree
          ? `${p.name} 换将`
          : `${p.name} 付费换将 -${ECONOMY_CONFIG.paidRedrawCost} 金`,
  };
}

function applyAutoPlace(room: RoomState, idx: number): RoomState {
  const p = room.players[idx];
  const hand = p.hand.slice();
  const teams = p.teams.map((t) => t.slice());
  const cfg = ROUND_CONFIGS[room.round];
  const teamsNeed = cfg.teamsRequired;
  for (let ti = 0; ti < teamsNeed; ti++) {
    for (let si = 0; si < 5; si++) {
      if (teams[ti][si] === null && hand.length > 0) {
        teams[ti][si] = hand.shift()!;
      }
    }
  }
  return replacePlayer(room, idx, { ...p, hand, teams });
}

function applyRecallAll(room: RoomState, idx: number): RoomState {
  const p = room.players[idx];
  const hand = p.hand.slice();
  const teams = p.teams.map((t) => t.slice());
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
  if (moved === 0) return room;
  return replacePlayer(room, idx, { ...p, hand, teams });
}

function applyPickTalent(
  room: RoomState,
  idx: number,
  talentId: string,
): RoomState {
  const p = room.players[idx];
  const choices = p.pendingTalentChoices;
  if (!choices) return room;
  const picked = choices.find((t) => t.id === talentId);
  if (!picked) return room;

  let nextTalents = p.talents;
  if (picked.kind === 'passive' || picked.kind === 'oneshot') {
    nextTalents = [...p.talents, picked];
  }
  let deck = room.deck.slice();
  let hand = p.hand.slice();
  let teams = p.teams.map((t) => t.slice());
  let gold = p.gold;
  let hp = p.hp;
  let freeRedrawsLeft = p.freeRedrawsLeft;
  let doubleThisRoundActive = p.doubleThisRoundActive;

  const drawOne = (
    level: number,
    filter?: (c: Card) => boolean,
  ): Card | null => {
    const r = drawOneFromDeck(deck, level, filter);
    deck = r.rest;
    return r.card;
  };

  switch (picked.templateId) {
    case 'gold_8':
      gold += 8;
      break;
    case 'no_flush_plus_gold':
      gold += 15;
      break;
    case 'random_two_cards': {
      for (let i = 0; i < 2; i++) {
        const c = drawOne(p.recruitLevel);
        if (c) hand.push(c);
      }
      break;
    }
    case 'full_heal':
      hp = INITIAL_HP;
      break;
    case 'draw_15': {
      const c = drawOne(p.recruitLevel, (c) => c.pointValue === 15);
      const fallback =
        c ??
        (() => {
          const idxs: number[] = [];
          for (let i = 0; i < deck.length; i++)
            if (deck[i].pointValue === 15) idxs.push(i);
          if (idxs.length === 0) return null;
          const k = idxs[Math.floor(Math.random() * idxs.length)];
          const picked = deck[k];
          deck = deck.slice(0, k).concat(deck.slice(k + 1));
          return picked;
        })();
      if (fallback) hand.push(fallback);
      break;
    }
    case 'double_this_round':
      doubleThisRoundActive = true;
      break;
    case 'random_reroll_all': {
      const back: Card[] = [];
      for (const c of hand) back.push(c);
      for (const t of teams) for (const c of t) if (c) back.push(c);
      deck = shuffle(deck.concat(back));
      const n = back.length;
      hand = [];
      teams = empty2x5();
      for (let i = 0; i < n; i++) {
        const c = drawOne(p.recruitLevel);
        if (!c) break;
        hand.push(c);
      }
      break;
    }
    case 'free_redraws_3':
      freeRedrawsLeft += 3;
      break;
    default:
      break;
  }

  const next: PlayerSlot = {
    ...p,
    hand,
    teams,
    gold,
    hp,
    freeRedrawsLeft,
    doubleThisRoundActive,
    talents: nextTalents,
    pendingTalentChoices: null,
    pendingTalentRound: null,
  };
  return {
    ...replacePlayer(room, idx, next),
    deck,
    lastMessage: `${p.name} 获得天赐【${picked.name}】`,
  };
}

function applyReady(
  room: RoomState,
  idx: number,
  ready: boolean,
): RoomState {
  const p = room.players[idx];
  return replacePlayer(room, idx, { ...p, ready });
}

// ------------------ 回合推进（host 在所有人 ready 后调用） ------------------
/**
 * 所有人准备好 → 结算本回合：
 *   1) 每个 human player 计算其 totalPower + snapshot
 *   2) AI 槽位各自 simulateAITurn 生成 lastTotalPower
 *   3) runDuels 两两对战
 *   4) 应用伤害、淘汰判定
 *   5) 若有人需要天赐 → 进入 talent 阶段；否则进入下一年 prep
 */
export function advanceRound(room: RoomState): RoomState {
  if (room.phase !== 'prep') return room;
  if (room.isFinished) return room;
  const currentRound = room.round;
  const nextRoundIdx = currentRound + 1;

  // 1) 计算每个 human 的 totalPower + 快照（共享同一 deck）
  let deck = room.deck.slice();
  const newPlayers = room.players.slice();
  const snapshots: Record<string, PowerSnapshot> = {};
  const duelEntries: { id: string; name: string; totalPower: number }[] = [];

  for (let i = 0; i < newPlayers.length; i++) {
    const p = newPlayers[i];
    if (p.eliminatedAtRound !== null) continue;

    if (p.isAI) {
      // AI 托管：直接用 simulateAITurn
      const aiState = {
        id: p.peerId ?? `seat_${i}`,
        name: p.aiPersona?.name ?? p.name,
        title: p.aiPersona?.title ?? '',
        hand: p.hand.slice(),
        teams: p.teams.map((t) => t.slice()),
        gold: p.gold,
        recruitLevel: p.recruitLevel,
        recruitExp: p.recruitExp,
        buyCount: p.buyCount,
        freeRedrawsLeft: p.freeRedrawsLeft,
        lastTotalPower: p.lastTotalPower,
        hp: p.hp,
        eliminatedAtRound: p.eliminatedAtRound,
      };
      const r = simulateAITurn(aiState, deck, nextRoundIdx);
      deck = r.deck;
      newPlayers[i] = {
        ...p,
        hand: r.ai.hand,
        teams: r.ai.teams,
        gold: r.ai.gold,
        recruitLevel: r.ai.recruitLevel,
        recruitExp: r.ai.recruitExp,
        buyCount: r.ai.buyCount,
        freeRedrawsLeft: r.ai.freeRedrawsLeft,
        lastTotalPower: r.totalPower,
      };
      duelEntries.push({
        id: aiState.id,
        name: aiState.name,
        totalPower: r.totalPower,
      });
      continue;
    }

    // human：用其 current teams 评估。阵法检测按条件匹配即触发，不再要求 5 张
    const ctx = buildEvalContext(p.talents, {
      gold: p.gold,
      bailongInHand: p.hand.filter((c) => c.horseSeal === 'bailong').length,
    });
    const cfgNow = ROUND_CONFIGS[currentRound];
    const teamsRequired = cfgNow.teamsRequired;

    const team0Cards = p.teams[0].filter((c): c is Card => !!c);
    const team1Cards = p.teams[1].filter((c): c is Card => !!c);
    const e0 = team0Cards.length > 0 ? evaluateHand(team0Cards, ctx) : null;
    const e1 = team1Cards.length > 0 ? evaluateHand(team1Cards, ctx) : null;

    const perHandBonus = p.talents.some(
      (t) => t.templateId === 'per_hand_card_2',
    )
      ? p.hand.length * 2
      : 0;

    // 每队军势 = evaluateHand 结果 + 手握百员加成；空队伍 → 0
    const t0 = e0 ? e0.power + perHandBonus : 0;
    const t1 = e1
      ? e1.power + (teamsRequired >= 2 ? perHandBonus : 0)
      : 0;

    let totalPower = t0 + (teamsRequired >= 2 ? t1 : 0);
    if (p.doubleThisRoundActive) totalPower *= 2;

    const anyFlush = !!(e0?.isFlush || (teamsRequired >= 2 && e1?.isFlush));
    let jueyingOnBoard = 0;
    for (const t of p.teams.slice(0, teamsRequired)) {
      for (const c of t) if (c?.horseSeal === 'jueying') jueyingOnBoard++;
    }

    snapshots[p.peerId!] = {
      round: currentRound,
      team0Power: t0,
      team1Power: teamsRequired >= 2 ? t1 : 0,
      totalPower,
      gold: p.gold,
      recruitLevel: p.recruitLevel,
      anyFlush,
      jueyingOnBoard,
    };
    newPlayers[i] = { ...newPlayers[i], lastTotalPower: totalPower };
    duelEntries.push({
      id: p.peerId!,
      name: p.name,
      totalPower,
    });
  }

  // 2) 年度收入/升级 for humans
  for (let i = 0; i < newPlayers.length; i++) {
    const p = newPlayers[i];
    if (p.isAI || p.eliminatedAtRound !== null) continue;

    let level = p.recruitLevel;
    let exp = p.recruitExp;
    // 年度经验、金币（若已达 FINAL_ROUND 不再加）
    if (currentRound < FINAL_ROUND) {
      const nextCfg = ROUND_CONFIGS[nextRoundIdx];
      exp += nextCfg.expGain;
      while (level < 6 && exp >= LEVEL_EXP_REQUIRED[level]) {
        exp -= LEVEL_EXP_REQUIRED[level];
        level = (level + 1) as RecruitLevel;
      }
      if (level >= 6) exp = 0;

      // 同心金、绝影马金
      let bonusGold = 0;
      const snap = snapshots[p.peerId!];
      if (
        snap &&
        p.talents.some((t) => t.templateId === 'flush_gives_8_gold') &&
        snap.anyFlush
      ) {
        bonusGold += 8;
      }
      if (snap?.jueyingOnBoard) bonusGold += snap.jueyingOnBoard * 3;

      newPlayers[i] = {
        ...p,
        recruitLevel: level,
        recruitExp: exp,
        gold: p.gold + nextCfg.yearIncome + bonusGold,
        freeRedrawsLeft: p.freeRedrawsLeft + nextCfg.freeRedrawsGain,
        // 消耗 oneshot
        talents: p.doubleThisRoundActive
          ? p.talents.filter((t) => t.templateId !== 'double_this_round')
          : p.talents,
        doubleThisRoundActive: false,
        ready: false,
      };
    } else {
      newPlayers[i] = { ...p, ready: false };
    }
  }

  // 3) 对战
  const { result: duelResult, hpDelta } = runDuels(duelEntries);

  for (let i = 0; i < newPlayers.length; i++) {
    const p = newPlayers[i];
    const myId = p.peerId ?? `seat_${i}`;
    if (p.eliminatedAtRound !== null) continue;
    const delta = hpDelta[myId] ?? 0;
    const nextHp = Math.max(0, p.hp + delta);
    newPlayers[i] = {
      ...p,
      hp: nextHp,
      lastHpDelta: delta,
      eliminatedAtRound: nextHp <= 0 ? currentRound : p.eliminatedAtRound,
    };
  }

  // 4) powerHistory 记录
  const historyByPeer = { ...room.powerHistoryByPeer };
  for (const [pid, snap] of Object.entries(snapshots)) {
    historyByPeer[pid] = [...(historyByPeer[pid] ?? []), snap];
  }

  const newDuelLog = [
    ...room.duelLog,
    { round: currentRound, result: duelResult, hpDelta },
  ];

  // 5) 是否终局（所有 human 都淘汰 / 剩 ≤1 / 到第 6 年）
  const aliveHumans = newPlayers.filter(
    (p) => !p.isAI && p.eliminatedAtRound === null,
  );
  const shouldFinishDueToElim = aliveHumans.length === 0;
  const reachedFinal = currentRound >= FINAL_ROUND;
  if (shouldFinishDueToElim || reachedFinal) {
    return {
      ...room,
      phase: 'finished',
      isFinished: true,
      players: newPlayers,
      deck,
      duelLog: newDuelLog,
      powerHistoryByPeer: historyByPeer,
      lastMessage: '终 局 已 定',
    };
  }

  // 6) 天赐阶段（empowered 模式 + 第 2/4 年）
  const talentTriggeredRound = nextRoundIdx === 2 || nextRoundIdx === 4;
  const shouldOpenTalent =
    room.mode === 'empowered' && talentTriggeredRound;
  if (shouldOpenTalent) {
    const playersAfter = newPlayers.map((p) => {
      if (p.isAI || p.eliminatedAtRound !== null) return p;
      const choices = rollTalents(p.talents);
      return {
        ...p,
        pendingTalentChoices: choices,
        pendingTalentRound: nextRoundIdx,
        ready: false,
      };
    });
    return {
      ...room,
      phase: 'talent',
      round: nextRoundIdx,
      players: playersAfter,
      deck,
      duelLog: newDuelLog,
      powerHistoryByPeer: historyByPeer,
      lastMessage: '天赐之兆降临，四选其一',
    };
  }

  return {
    ...room,
    phase: 'prep',
    round: nextRoundIdx,
    players: newPlayers,
    deck,
    duelLog: newDuelLog,
    powerHistoryByPeer: historyByPeer,
    lastMessage: ROUND_CONFIGS[nextRoundIdx]?.description ?? '',
  };
}

/**
 * 从 talent 阶段 → prep：所有人(pendingTalentChoices 为 null 的 human + AI)都就绪
 */
export function maybeExitTalent(room: RoomState): RoomState {
  if (room.phase !== 'talent') return room;
  const allPicked = room.players.every(
    (p) =>
      p.isAI ||
      p.eliminatedAtRound !== null ||
      p.pendingTalentChoices === null,
  );
  if (!allPicked) return room;
  const players = room.players.map((p) => ({ ...p, ready: false }));
  return { ...room, phase: 'prep', players, lastMessage: '天赐已择 · 请布阵' };
}

/**
 * 判断是否所有在场玩家都 ready
 */
export function allReady(room: RoomState): boolean {
  for (const p of room.players) {
    if (p.eliminatedAtRound !== null) continue;
    if (!p.isAI && !p.ready) return false;
  }
  return true;
}

// 导出 GameMode 以避免循环
export type { GameMode };
