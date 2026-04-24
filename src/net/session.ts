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

/** 中断当前联机会话：停引擎 + 关 WS + 回主菜单 + 显示错误条 */
function abortSession(errorMsg: string) {
  stopSession();
  const lobby = useLobbyStore.getState();
  lobby.leaveRoom();
  // leaveRoom 会把 lastError 清空，所以写 error 放在其后
  useLobbyStore.getState()._setError(errorMsg);
}

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
      console.warn(`[sess] kicked by host: ${payload.reason}`);
      abortSession(`被请离房间：${payload.reason}`);
    }
  },
  // host 断线导致中继把自己升为新 host —— 权威状态无法从 privacy-masked
  // 的 ClientView 完整重建，因此直接终止本局，把所有人退回主菜单。
  onPromoted: () => {
    console.warn('[sess] promoted to host after host disconnect — aborting session');
    abortSession('主公已断线 · 本局已中断');
  },
  // 别的玩家离开；如果带着 newHostId（意味着离开的是原 host），其他
  // 非被提升的 client 也要同步中断（和 onPromoted 里的逻辑对称）
  onPeerLeft: (_peerId, newHostId) => {
    if (!newHostId) return;
    if (!hostEngine && newHostId !== useLobbyStore.getState().myPeerId) {
      console.warn('[sess] original host left — aborting session');
      abortSession('主公已断线 · 本局已中断');
    }
  },
  // 游戏中连接被打断的兜底：
  //  · 断网后自动重连成功，但中继已重启导致房间消失 → ROOM_NOT_FOUND
  //  · 中继完全连不上，重连 15 次仍失败 → unreachable
  onError: (code) => {
    if (!hostEngine && !clientSession) return;
    if (code === 'ROOM_NOT_FOUND') {
      console.warn('[sess] ROOM_NOT_FOUND mid-session — aborting');
      abortSession('中军重启 · 房间已失散 · 本局中断');
    } else if (code === 'RELAY_UNREACHABLE') {
      console.warn('[sess] RELAY_UNREACHABLE mid-session — aborting');
      abortSession('与中军失联 · 本局中断');
    }
  },
  // 任何端（host 或 client）一旦进入 reconnecting / unreachable，
  // 都视为本局中断：
  //  · host 重连后 relay 已不认识我们（新 peerId），继续发 intent 无效
  //  · client 重连后若成功 rejoin 也是新 peerId，无法接上原座位
  // 简单稳妥做法：掉线立即退主菜单，提示玩家"重新开房"
  onStatusChange: (status) => {
    if (!hostEngine && !clientSession) return;
    if (status === 'reconnecting') {
      console.warn('[sess] socket reconnecting during active session — aborting');
      abortSession('网络不稳 · 本局中断');
    } else if (status === 'unreachable') {
      console.warn('[sess] socket unreachable during active session — aborting');
      abortSession('与中军失联 · 本局中断');
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
