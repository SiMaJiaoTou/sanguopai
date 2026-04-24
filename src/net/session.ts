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
  console.info(
    `[sess] dispatchGameAction CALLED type=${action.type} hostEngine=${!!hostEngine} clientSession=${!!clientSession}`,
  );
  try {
    if (hostEngine) {
      console.info(`[sess] → host.dispatchSelf ${action.type}`);
      hostEngine.dispatchSelf(action);
    } else if (clientSession) {
      console.info(`[sess] → client.dispatch ${action.type}`);
      clientSession.dispatch(action);
    } else {
      console.warn(
        `[sess] DROPPED (no engine) ${action.type}`,
        action,
        `lobby:`,
        useLobbyStore.getState(),
      );
    }
  } catch (err) {
    console.error(`[sess] dispatch threw:`, err);
  }
}

/** 由 App.tsx 调用：进入游戏屏幕时启动。幂等：已在正确角色则不做任何事。 */
export function startSession() {
  const lobby = useLobbyStore.getState();
  console.info(
    `[sess] startSession() isHost=${lobby.isHost} roomCode=${lobby.roomCode} peerId=${lobby.myPeerId} hostEngine=${!!hostEngine} clientSession=${!!clientSession}`,
  );
  if (!lobby.roomCode || !lobby.myPeerId) {
    console.warn(`[sess] startSession ABORT: no roomCode/peerId`);
    return;
  }
  const wantHost = lobby.isHost;

  // 角色匹配 → 已在跑，忽略
  if (wantHost && hostEngine) {
    console.info(`[sess] startSession: host engine already running, noop`);
    return;
  }
  if (!wantHost && clientSession) {
    console.info(`[sess] startSession: client session already running, noop`);
    return;
  }

  // 角色不匹配（例如 host 迁移后重建）→ 关掉错误角色的引擎，但不清 view，
  // 避免把前序广播过来的 ClientView 冲掉
  if (hostEngine) {
    console.info(`[sess] startSession: tearing down stale hostEngine`);
    hostEngine.stop();
    hostEngine = null;
  }
  if (clientSession) {
    console.info(`[sess] startSession: tearing down stale clientSession`);
    clientSession.stop();
    clientSession = null;
  }

  if (wantHost) {
    try {
      hostEngine = new HostEngine(
        lobby.roomCode,
        lobby.myPeerId,
        lobby.nickname || '主公',
      );
      hostEngine.start();
      console.info(`[sess] HostEngine created and started`);
    } catch (err) {
      console.error(`[sess] HostEngine construction threw:`, err);
      hostEngine = null;
    }
  } else {
    clientSession = new ClientSession();
    clientSession.start();
    console.info(`[sess] ClientSession created and started`);
  }
}

/** 完全结束联机会话：停引擎 + 清空 view（返回大厅时用） */
export function stopSession() {
  if (hostEngine || clientSession) {
    console.info(
      `[sess] stopSession() hostEngine=${!!hostEngine} clientSession=${!!clientSession}`,
    );
  }
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
