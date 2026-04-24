// 统一游戏视图 hook —— 把单机 store 与联机 ClientView 映射到同一个 UI 接口
// -------------------------------------------------------------------
// 设计目标：让 App.tsx 大部分组件无需分单机/联机，统一用同一批字段和 dispatcher
//
//   单机：直接包装 useGameStore
//   联机：从 useRoomStore.view.players[myIdx] 映射

import { useMemo } from 'react';
import { useGameStore, type PowerSnapshot } from '../store';
import type { Card, RecruitLevel } from '../types';
import type { AIState } from '../ai';
import type { TalentInstance } from '../talents';
import { useRoomStore } from './roomStore';
import { dispatchGameAction } from './session';
import type { ClientPlayerView, ClientView } from './roomTypes';

export interface UnifiedGame {
  online: boolean;

  // 自己的数据
  hand: Card[];
  teams: (Card | null)[][];
  gold: number;
  buyCount: number;
  recruitLevel: RecruitLevel;
  recruitExp: number;
  freeRedrawsLeft: number;
  playerHp: number;
  playerEliminatedAtRound: number | null;

  // 全房/全局
  round: number;
  isFinished: boolean;
  powerHistory: PowerSnapshot[];
  lastMessage: string | null;
  mode: 'normal' | 'empowered';
  modeChosen: boolean;

  // 天赐
  talents: TalentInstance[];
  pendingTalentChoices: TalentInstance[] | null;
  pendingTalentRound: number | null;
  doubleThisRoundActive: boolean;

  // 牌库（联机：全房共享；单机：自己的）
  deck: Card[];

  // AI 列表（单机：ais；联机：除自己外的所有玩家映射为 AIState 形状，供 AIStandings）
  ais: AIState[];

  // 最近 duel
  duelLog: {
    round: number;
    result: import('../ai').DuelResult;
    hpDelta: Record<string, number>;
  }[];

  /** 自己的 peerId（联机必填，单机为 'player'） */
  myId: string;

  // 全房玩家（联机时可用于大厅/诸侯面板）；单机时为 null
  roomPlayers: ClientPlayerView[] | null;

  // actions —— 统一分派
  buyCard: () => void;
  upgradeLevel: () => void;
  moveCard: (cardId: string, to: SlotTargetUnified) => void;
  redraw: (cardId: string) => void;
  autoPlace: () => void;
  recallAll: () => void;
  pickTalent: (talentId: string) => void;
  chooseMode: (mode: 'normal' | 'empowered') => void;
  setReady: (ready: boolean) => void;
  /** 单机：startNewGame；联机：忽略（由 host 控制） */
  startNewGame: () => void;
  clearMessage: () => void;

  // GM（仅单机）
  gmGrantGold: (amt: number) => void;
  gmMaxLevel: () => void;
  gmFillHand: () => void;
}

export type SlotTargetUnified =
  | { type: 'hand' }
  | { type: 'team'; teamIndex: number; slotIndex: number };

/** 把联机 ClientView 里的"他人" + "AI 托管" 映射成 AIState 形状，喂给 AIStandings */
function toAiLikes(view: ClientView): AIState[] {
  return view.players
    .filter((p) => !p.isSelf)
    .map((p, idx) => ({
      id: p.peerId ?? `seat_${p.seatIdx}`,
      name: p.name || `座 ${p.seatIdx + 1}`,
      title: p.aiPersona?.title ?? (p.isAI ? '诸侯' : '人类玩家'),
      hand: [],
      teams: p.teams,
      gold: p.gold,
      recruitLevel: p.recruitLevel,
      recruitExp: p.recruitExp,
      buyCount: p.buyCount,
      freeRedrawsLeft: p.freeRedrawsLeft,
      lastTotalPower: p.lastTotalPower,
      hp: p.hp,
      eliminatedAtRound: p.eliminatedAtRound,
    }));
}

export function useUnifiedGame(): UnifiedGame {
  // 订阅
  const view = useRoomStore((s) => s.view);
  const single = useGameStore();

  const myView = useMemo(() => {
    if (!view) return null;
    return view.players.find((p) => p.isSelf) ?? null;
  }, [view]);

  if (view && myView) {
    // -------- 联机路径 --------
    return {
      online: true,
      hand: myView.hand,
      teams: myView.teams,
      gold: myView.gold,
      buyCount: myView.buyCount,
      recruitLevel: myView.recruitLevel,
      recruitExp: myView.recruitExp,
      freeRedrawsLeft: myView.freeRedrawsLeft,
      playerHp: myView.hp,
      playerEliminatedAtRound: myView.eliminatedAtRound,
      round: view.round,
      isFinished: view.isFinished,
      powerHistory: view.myPowerHistory,
      lastMessage: view.lastMessage,
      mode: view.mode,
      modeChosen: view.modeChosen,
      talents: myView.talents,
      pendingTalentChoices: myView.pendingTalentChoices,
      pendingTalentRound: myView.pendingTalentRound,
      doubleThisRoundActive: myView.doubleThisRoundActive,
      deck: [], // host 不把 deck 广播；玩家只能看自己摸到的
      ais: toAiLikes(view),
      duelLog: view.duelLog,
      myId: view.myPeerId,
      roomPlayers: view.players,

      buyCard: () => dispatchGameAction({ type: 'buyCard' }),
      upgradeLevel: () => dispatchGameAction({ type: 'upgradeLevel' }),
      moveCard: (cardId, to) =>
        dispatchGameAction({ type: 'moveCard', fromId: cardId, to }),
      redraw: (cardId) => dispatchGameAction({ type: 'redraw', cardId }),
      autoPlace: () => dispatchGameAction({ type: 'autoPlace' }),
      recallAll: () => dispatchGameAction({ type: 'recallAll' }),
      pickTalent: (talentId) =>
        dispatchGameAction({ type: 'pickTalent', talentId }),
      chooseMode: (mode) => dispatchGameAction({ type: 'chooseMode', mode }),
      setReady: (ready) =>
        dispatchGameAction({ type: ready ? 'ready' : 'unready' }),
      startNewGame: () => {
        /* 联机由 host startGame 控制 */
      },
      clearMessage: () => {
        /* 联机 lastMessage 由 host 广播覆盖 */
      },

      // GM 工具仅单机可用，联机下 no-op
      gmGrantGold: () => {},
      gmMaxLevel: () => {},
      gmFillHand: () => {},
    };
  }

  // -------- 单机路径 --------
  return {
    online: false,
    hand: single.hand,
    teams: single.teams,
    gold: single.gold,
    buyCount: single.buyCount,
    recruitLevel: single.recruitLevel,
    recruitExp: single.recruitExp,
    freeRedrawsLeft: single.freeRedrawsLeft,
    playerHp: single.playerHp,
    playerEliminatedAtRound: single.playerEliminatedAtRound,
    round: single.round,
    isFinished: single.isFinished,
    powerHistory: single.powerHistory,
    lastMessage: single.lastMessage,
    mode: single.mode,
    modeChosen: single.modeChosen,
    talents: single.talents,
    pendingTalentChoices: single.pendingTalentChoices,
    pendingTalentRound: single.pendingTalentRound,
    doubleThisRoundActive: single.doubleThisRoundActive,
    deck: single.deck,
    ais: single.ais,
    duelLog: single.duelLog,
    myId: 'player',
    roomPlayers: null,

    buyCard: single.buyCard,
    upgradeLevel: single.upgradeLevel,
    moveCard: (cardId, to) => single.moveCard(cardId, to),
    redraw: single.redraw,
    autoPlace: single.autoPlace,
    recallAll: single.recallAll,
    pickTalent: single.pickTalent,
    chooseMode: single.chooseMode,
    setReady: () => {
      // 单机没有 ready 概念，"下一年"直接推进
    },
    startNewGame: single.startNewGame,
    clearMessage: single.clearMessage,

    gmGrantGold: single.gmGrantGold,
    gmMaxLevel: single.gmMaxLevel,
    gmFillHand: single.gmFillHand,
  };
}

/** 本局是否联机 */
export function useIsOnline(): boolean {
  return useRoomStore((s) => s.view !== null);
}

/** 是否 host（联机） */
export function useIsHostOfRoom(): boolean {
  const view = useRoomStore((s) => s.view);
  if (!view) return false;
  return view.hostPeerId === view.myPeerId;
}
