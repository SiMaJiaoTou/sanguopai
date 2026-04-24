// 房间运行时核心类型 —— host/client 共用
// -------------------------------------------------------------------
// 设计原则：
//  · RoomState 是 host 的权威状态全量
//  · ClientView 是 host 发给某个 client 的视角（私密字段已裁剪）
//  · PlayerSlot 是 8 个座位之一：人类玩家或 AI 托管或空位

import type { Card, RecruitLevel } from '../types';
import type { AIState, DuelResult } from '../ai';
import type { GameMode, PowerSnapshot } from '../store';
import type { TalentInstance } from '../talents';

export type RoomPhase =
  | 'lobby'     // 房间内，未擂鼓
  | 'prep'      // 回合准备阶段：买/换/布阵
  | 'resolve'   // 结算：所有人进入，展示对战动画
  | 'talent'    // 加强模式下第 2/4 年：每人独立 4 选 1
  | 'finished'; // 终局

/** 单个玩家槽位的完整状态（8 个座位之一） */
export interface PlayerSlot {
  /** 位置号 0..7，稳定 */
  seatIdx: number;
  /** peerId（空位为 null） */
  peerId: string | null;
  name: string;
  /** 是否在 host 的 peer 列表里（否=掉线或离开） */
  connected: boolean;
  /** 是否由 AI 托管（掉线超时或空位补 AI） */
  isAI: boolean;
  /** 底层 AI 人格（仅 isAI 时有用，用于诸侯称呼） */
  aiPersona?: { name: string; title: string };

  hand: Card[];
  teams: (Card | null)[][]; // 2 × 5
  gold: number;
  buyCount: number;
  recruitLevel: RecruitLevel;
  recruitExp: number;
  freeRedrawsLeft: number;
  hp: number;
  eliminatedAtRound: number | null;

  talents: TalentInstance[];
  /** 四选一候选；null = 无待选 */
  pendingTalentChoices: TalentInstance[] | null;
  pendingTalentRound: number | null;
  doubleThisRoundActive: boolean;

  /** 本回合点"下一年"准备完毕 */
  ready: boolean;
  /** 本回合结算出的战力快照（0 = 尚未结算） */
  lastTotalPower: number;
  /** 上次 duel 的 hpDelta 记录（仅用于 UI） */
  lastHpDelta: number;
}

/** 房间完整状态 · host 权威持有 */
export interface RoomState {
  roomCode: string;
  hostPeerId: string;
  mode: GameMode;
  modeChosen: boolean;

  phase: RoomPhase;
  round: number;               // 0..6
  isFinished: boolean;

  /** 8 个座位。index == seatIdx */
  players: PlayerSlot[];

  /** 共享牌库 */
  deck: Card[];

  /** 历史战录（玩家专属；用于 PowerChart） */
  powerHistoryByPeer: Record<string, PowerSnapshot[]>;

  /** 本回合对战战报（广播给所有人播动画） */
  duelLog: {
    round: number;
    result: DuelResult;
    hpDelta: Record<string, number>;
  }[];

  /** host 最近 lastMessage（广播 toast） */
  lastMessage: string | null;
}

/**
 * host 发给每个 client 的视角数据：除"自己的手牌/自己的天赐候选"外都是公开。
 * 其他玩家的 hand 裁剪为 []，只保留 handSize；pendingTalentChoices 裁剪为 null。
 */
export interface ClientView {
  roomCode: string;
  hostPeerId: string;
  mode: GameMode;
  modeChosen: boolean;
  phase: RoomPhase;
  round: number;
  isFinished: boolean;
  myPeerId: string;

  players: ClientPlayerView[];

  /** 仅自己的历史 */
  myPowerHistory: PowerSnapshot[];

  /** 共享牌库的剩余卡（全房公开实时同步） */
  deck: Card[];

  duelLog: RoomState['duelLog'];
  lastMessage: string | null;
}

export interface ClientPlayerView {
  seatIdx: number;
  peerId: string | null;
  name: string;
  isSelf: boolean;
  connected: boolean;
  isAI: boolean;
  aiPersona?: { name: string; title: string };

  /** 他人固定 []，自己完整 */
  hand: Card[];
  handSize: number;

  /** 他人/自己都可见 */
  teams: (Card | null)[][];
  gold: number;
  buyCount: number;
  recruitLevel: RecruitLevel;
  recruitExp: number;
  freeRedrawsLeft: number;
  hp: number;
  eliminatedAtRound: number | null;
  talents: TalentInstance[];
  /** 仅自己的候选；他人为 null */
  pendingTalentChoices: TalentInstance[] | null;
  pendingTalentRound: number | null;
  doubleThisRoundActive: boolean;
  ready: boolean;
  lastTotalPower: number;
  lastHpDelta: number;
}

/** host 收到的意图包装（包含发起方） */
export interface IncomingIntent {
  from: string; // peerId
  action: import('./protocol').GameAction;
}

/** 空座位占位（尚未加入时） */
export function emptySlot(seatIdx: number): PlayerSlot {
  return {
    seatIdx,
    peerId: null,
    name: '',
    connected: false,
    isAI: true,
    hand: [],
    teams: [
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    gold: 4,
    buyCount: 0,
    recruitLevel: 1,
    recruitExp: 0,
    freeRedrawsLeft: 0,
    hp: 500, // INITIAL_HP
    eliminatedAtRound: null,
    talents: [],
    pendingTalentChoices: null,
    pendingTalentRound: null,
    doubleThisRoundActive: false,
    ready: false,
    lastTotalPower: 0,
    lastHpDelta: 0,
  };
}

/** 把 AIState 升级为 PlayerSlot（AI 托管） */
export function aiSlotFromState(
  seatIdx: number,
  ai: AIState,
): PlayerSlot {
  return {
    seatIdx,
    peerId: null,
    name: ai.name,
    connected: false,
    isAI: true,
    aiPersona: { name: ai.name, title: ai.title },
    hand: ai.hand,
    teams: ai.teams,
    gold: ai.gold,
    buyCount: ai.buyCount,
    recruitLevel: ai.recruitLevel,
    recruitExp: ai.recruitExp,
    freeRedrawsLeft: ai.freeRedrawsLeft,
    hp: ai.hp,
    eliminatedAtRound: ai.eliminatedAtRound,
    talents: [],
    pendingTalentChoices: null,
    pendingTalentRound: null,
    doubleThisRoundActive: false,
    ready: true,
    lastTotalPower: ai.lastTotalPower,
    lastHpDelta: 0,
  };
}
