// 联机生命周期协调器
// -------------------------------------------------------------------
// 一处入口：根据 lobbyStore 的 isHost/screen 决定启停 HostEngine / ClientSession
//  - 进入 inGame → 启动
//  - 返回 lobby / leaveRoom → 关闭
// 同时把 GameAction dispatch 包装好给 UI 层调用。
//
// 韧性策略（Tier 1）：
//   · socket 短暂闪断 → Network 自动重连 + 带 sessionToken resume
//     成功后 pendingQueue 自动 flush，业务无感知
//   · 30s 宽限期超时 → server 发 SESSION_EXPIRED 或 relay cleanup
//     此时才 abortSession 退主菜单
//   · host 掉线超过宽限期 → 第 2 进房者被真正升为 host，并广播 kick

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
// 提前订阅可确保 view 不丢包。
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
  // 被升为新 host —— 表示原 host 超过宽限期没回来（或主动离开）
  // 先广播 kick 把其他人也请走（原因：ClientView 已 privacy-mask，
  // 无法重建完整 RoomState，继续玩会状态分叉），再自己 abort。
  onPromoted: () => {
    console.warn('[sess] promoted to host — ending game for all');
    try {
      network.sendHostEvent({
        t: 'kick',
        reason: '主公已离开 · 本局结束',
      });
    } catch (e) {
      console.warn('[sess] failed to broadcast end-game kick', e);
    }
    abortSession('主公已离开 · 本局结束');
  },
  // 中继宽限期超时 → 会话已无法恢复
  onError: (code) => {
    if (!hostEngine && !clientSession) return;
    if (code === 'SESSION_EXPIRED') {
      console.warn('[sess] SESSION_EXPIRED — session unrecoverable');
      abortSession('掉线时间过长 · 会话已过期 · 本局中断');
    } else if (code === 'ROOM_NOT_FOUND') {
      console.warn('[sess] ROOM_NOT_FOUND — relay restarted');
      abortSession('中军重启 · 房间已失散 · 本局中断');
    } else if (code === 'RELAY_UNREACHABLE') {
      console.warn('[sess] RELAY_UNREACHABLE — giving up');
      abortSession('与中军失联 · 本局中断');
    }
  },
  // 注：闪断（reconnecting 状态）不再立即 abort，Network 会带 sessionToken
  // 自动 resume。如果 30s 宽限期内没恢复，server 会返回 SESSION_EXPIRED，
  // 交给上面的 onError 处理。
  // 只有"彻底不可达"的终态会在这里触发 abort。
  onStatusChange: (status) => {
    if (!hostEngine && !clientSession) return;
    if (status === 'unreachable') {
      console.warn('[sess] unreachable during active session — aborting');
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

  if (wantHost && hostEngine) return;
  if (!wantHost && clientSession) return;

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
