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

// ---- 永远订阅 state hostEvent，即便还没"正式 startSession" ----
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
  },
});

/** 给 UI 调用：无论是 host 还是 client，都统一通过这里派发 action */
export function dispatchGameAction(action: GameAction) {
  if (hostEngine) {
    hostEngine.dispatchSelf(action);
  } else if (clientSession) {
    clientSession.dispatch(action);
  } else {
    // 未启动 session（非房间态），忽略
  }
}

/** 由 App.tsx 调用：进入游戏屏幕时启动 */
export function startSession() {
  stopSession();
  const lobby = useLobbyStore.getState();
  if (!lobby.roomCode || !lobby.myPeerId) return;
  if (lobby.isHost) {
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
