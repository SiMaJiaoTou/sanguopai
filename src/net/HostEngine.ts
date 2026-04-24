// Host 引擎 —— 仅在房主客户端实例化
// -------------------------------------------------------------------
// 职责：
//  1. 持有权威 RoomState
//  2. 订阅 network 的 intent 事件 → applyAction
//  3. 所有人 ready 后调 advanceRound
//  4. talent 阶段：每人选完 → maybeExitTalent
//  5. 每次 state 变化 → 对每个 peer 定制 ClientView → hostEvent 广播
//  6. 自己（host）的 ClientView 写进 roomStore 供 UI 消费
//  7. 监听 peerJoined / peerLeft，维护座位

import { network } from './Network';
import type { GameAction } from './protocol';
import type { ClientPlayerView, ClientView, RoomState } from './roomTypes';
import {
  applyAction,
  advanceRound,
  allReady,
  createInitialRoom,
  joinPlayer,
  markPeerGone,
  maybeExitTalent,
} from './roomReducer';
import { useRoomStore } from './roomStore';
import { useLobbyStore } from './lobbyStore';

export class HostEngine {
  private room: RoomState;
  private unsubs: Array<() => void> = [];
  private myPeerId: string;
  private myName: string;
  private talentTimeout: number | null = null;

  constructor(roomCode: string, myPeerId: string, myName: string) {
    this.myPeerId = myPeerId;
    this.myName = myName;
    this.room = createInitialRoom(roomCode, myPeerId);
    // host 自己
    this.room = joinPlayer(this.room, myPeerId, myName);
    // 大厅里已经进来的其他成员 —— 这些 peerJoined 事件早在
    // HostEngine 实例化之前就已经被触发过，所以需要从 lobbyStore 补种。
    const lobbyPeers = useLobbyStore.getState().peers;
    for (const peer of lobbyPeers) {
      if (peer.id === myPeerId) continue;
      this.room = joinPlayer(this.room, peer.id, peer.name);
    }
  }

  start() {
    const off = network.subscribe({
      onPeerJoined: (peer) => {
        this.room = joinPlayer(this.room, peer.id, peer.name);
        this.broadcast();
      },
      onPeerLeft: (peerId) => {
        this.room = markPeerGone(this.room, peerId, /*hard=*/ true);
        this.broadcast();
      },
      onIntent: (from, action) => this.handleIntent(from, action),
    });
    this.unsubs.push(off);
    this.broadcast();
  }

  stop() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.talentTimeout) {
      clearTimeout(this.talentTimeout);
      this.talentTimeout = null;
    }
  }

  /** host 自己的 UI 产生的 action */
  dispatchSelf(action: GameAction) {
    this.handleIntent(this.myPeerId, action);
  }

  private handleIntent(from: string, action: GameAction) {
    this.room = applyAction(this.room, from, action);

    // ---- 阶段推进 ----
    if (this.room.phase === 'prep' && allReady(this.room)) {
      this.room = advanceRound(this.room);
    } else if (this.room.phase === 'talent') {
      this.room = maybeExitTalent(this.room);
    }
    this.broadcast();
  }

  private broadcast() {
    // host 自己的视图
    const myView = buildClientView(this.room, this.myPeerId);
    useRoomStore.getState().setView(myView);

    // 给每个其他玩家定点发
    for (const p of this.room.players) {
      if (!p.peerId || !p.connected || p.peerId === this.myPeerId) continue;
      const view = buildClientView(this.room, p.peerId);
      network.sendHostEvent({ t: 'state', state: view }, p.peerId);
    }
  }
}

// ------------------ 构造 ClientView ------------------
export function buildClientView(
  room: RoomState,
  forPeerId: string,
): ClientView {
  return {
    roomCode: room.roomCode,
    hostPeerId: room.hostPeerId,
    mode: room.mode,
    modeChosen: room.modeChosen,
    phase: room.phase,
    round: room.round,
    isFinished: room.isFinished,
    myPeerId: forPeerId,
    players: room.players.map((p) => mapPlayer(p, forPeerId)),
    myPowerHistory: room.powerHistoryByPeer[forPeerId] ?? [],
    duelLog: room.duelLog,
    lastMessage: room.lastMessage,
  };
}

function mapPlayer(
  p: import('./roomTypes').PlayerSlot,
  forPeerId: string,
): ClientPlayerView {
  const isSelf = p.peerId === forPeerId;
  return {
    seatIdx: p.seatIdx,
    peerId: p.peerId,
    name: p.name,
    isSelf,
    connected: p.connected,
    isAI: p.isAI,
    aiPersona: p.aiPersona,
    hand: isSelf ? p.hand : [],
    handSize: p.hand.length,
    teams: p.teams,
    gold: p.gold,
    buyCount: p.buyCount,
    recruitLevel: p.recruitLevel,
    recruitExp: p.recruitExp,
    freeRedrawsLeft: p.freeRedrawsLeft,
    hp: p.hp,
    eliminatedAtRound: p.eliminatedAtRound,
    talents: p.talents,
    pendingTalentChoices: isSelf ? p.pendingTalentChoices : null,
    pendingTalentRound: p.pendingTalentRound,
    doubleThisRoundActive: p.doubleThisRoundActive,
    ready: p.ready,
    lastTotalPower: p.lastTotalPower,
    lastHpDelta: p.lastHpDelta,
  };
}
