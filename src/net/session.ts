// 联机生命周期协调器
// -------------------------------------------------------------------
// 一处入口：根据 lobbyStore 的 isHost/screen 决定启停 HostEngine / ClientSession
//  - 进入 inGame → 启动
//  - 返回 lobby / leaveRoom → 关闭
// 同时把 GameAction dispatch 包装好给 UI 层调用

import { HostEngine } from './HostEngine';
import { ClientSession } from './ClientSession';
import { useLobbyStore } from './lobbyStore';
import { network } from './Network';
import type { GameAction } from './protocol';
import { useRoomStore } from './roomStore';
import type { ClientView } from './roomTypes';

let hostEngine: HostEngine | null = null;
let clientSession: ClientSession | null = null;

// ---- 永远订阅 state/kick hostEvent，即便还没"正式 startSession" ----
// 原因：host 可能在客户端还没进入 inGame 屏幕时就发 state 广播；
// 提前订阅可确保 view 不丢包。只要当前玩家不是 host，就把 state 写进 roomStore。
network.subscribe({
  onHostEvent: (payload) => {
    if (payload.t === 'state' && !hostEngine) {
      useRoomStore.getState().setView(payload.state as ClientView);
      // client 首次收到 state 且处于房间态 → 自动进入游戏屏幕
      const lobby = useLobbyStore.getState();
      if (lobby.screen !== 'inGame' && lobby.roomCode) {
        lobby.setScreen('inGame');
      }
    }
    if (payload.t === 'gameStart') {
      // 由 App.tsx 负责设 lobbyScreen；这里顺带确保 clientSession 启动
      const lobby = useLobbyStore.getState();
      if (!lobby.isHost && !clientSession && !hostEngine) {
        startSession();
      }
    }
    if (payload.t === 'kick') {
      // host 拒绝我们留在房间（通常是迟到）→ 退回主菜单，显示原因
      console.warn(`[sess] kicked by host: ${payload.reason}`);
      stopSession();
      const lobby = useLobbyStore.getState();
      lobby.leaveRoom();
      // leaveRoom 会把 lastError 清空，所以放在其后
      useLobbyStore.getState()._setError(`被请离房间：${payload.reason}`);
    }
  },
  // host 断线导致中继把自己升为新 host —— 权威状态无法从 privacy-masked
  // 的 ClientView 完整重建（其他玩家手牌已被裁剪成 []），因此直接终止本局，
  // 把所有人退回主菜单，避免玩家看到"游戏挂着但谁都动不了"的假死状态。
  onPromoted: () => {
    console.warn('[sess] promoted to host after host disconnect — aborting session');
    stopSession();
    const lobby = useLobbyStore.getState();
    lobby.leaveRoom();
    useLobbyStore.getState()._setError('主公已断线 · 本局已中断');
  },
  // 别的玩家离开；如果带着 newHostId（意味着离开的是原 host），其他
  // 非被提升的 client 也要同步中断（和 onPromoted 里的逻辑对称）
  onPeerLeft: (_peerId, newHostId) => {
    if (newHostId && !hostEngine) {
      const lobby = useLobbyStore.getState();
      // 被提升为 host 的玩家会走 onPromoted 分支；我们这里只处理"原 host 走了
      // 但自己不是接任者"的情况
      if (newHostId !== lobby.myPeerId) {
        console.warn('[sess] original host left — aborting session');
        stopSession();
        lobby.leaveRoom();
        useLobbyStore.getState()._setError('主公已断线 · 本局已中断');
      }
    }
  },
});

/** 给 UI 调用：无论是 host 还是 client，都统一通过这里派发 action */
export function dispatchGameAction(action: GameAction) {
  if (hostEngine) {
    hostEngine.dispatchSelf(action);
  } else if (clientSession) {
    clientSession.dispatch(action);
  } else {
    console.warn(`[sess] dispatch DROPPED (no engine) ${action.type}`);
  }
}

/** 由 App.tsx 调用：进入游戏屏幕时启动。幂等：已在正确角色则不做任何事。 */
export function startSession() {
  const lobby = useLobbyStore.getState();
  if (!lobby.roomCode || !lobby.myPeerId) return;
  const wantHost = lobby.isHost;

  // 角色匹配 → 已在跑，忽略
  if (wantHost && hostEngine) return;
  if (!wantHost && clientSession) return;

  // 角色不匹配（例如 host 迁移后重建）→ 关掉错误角色的引擎，但不清 view，
  // 避免把前序广播过来的 ClientView 冲掉
  if (hostEngine) {
    hostEngine.stop();
    hostEngine = null;
  }
  if (clientSession) {
    clientSession.stop();
    clientSession = null;
  }

  if (wantHost) {
    hostEngine = new HostEngine(
      lobby.roomCode,
      lobby.myPeerId,
      lobby.nickname || '主公',
    );
    hostEngine.start();
  } else {
    clientSession = new ClientSession();
    clientSession.start();
  }
}

/** 完全结束联机会话：停引擎 + 清空 view（返回大厅时用） */
export function stopSession() {
  if (hostEngine) {
    hostEngine.stop();
    hostEngine = null;
  }
  if (clientSession) {
    clientSession.stop();
    clientSession = null;
  }
  useRoomStore.getState().setView(null);
}

export function isOnlineSession(): boolean {
  return !!(hostEngine || clientSession);
}
