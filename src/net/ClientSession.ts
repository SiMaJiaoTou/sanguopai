// 非 host 玩家的会话 —— 收 hostEvent 更新 view，发 intent 给 host
// -------------------------------------------------------------------

import { network } from './Network';
import type { GameAction } from './protocol';
import type { ClientView } from './roomTypes';
import { useRoomStore } from './roomStore';

export class ClientSession {
  private unsubs: Array<() => void> = [];

  start() {
    const off = network.subscribe({
      onHostEvent: (payload) => {
        if (payload.t === 'state') {
          useRoomStore.getState().setView(payload.state as ClientView);
        }
        // 其他 hostEvent（toast / duel 单独事件）在 MVP 阶段不做差分
      },
      // 某 peer 进入宽限期 / 宽限期内恢复 —— 直接改本地 view 的 connected 字段
      // 即使是 host 掉线也能在 UI 上显示"重连中"状态
      onPeerDisconnected: (peerId) => {
        patchPeerConnected(peerId, false);
      },
      onPeerResumed: (peerId) => {
        patchPeerConnected(peerId, true);
      },
    });
    this.unsubs.push(off);
  }

  stop() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  dispatch(action: GameAction) {
    network.sendIntent(action);
  }
}

/** 在不动 room state 其他字段的前提下，修改某 peer 的 connected 标志 */
function patchPeerConnected(peerId: string, connected: boolean) {
  const view = useRoomStore.getState().view;
  if (!view) return;
  let changed = false;
  const players = view.players.map((p) => {
    if (p.peerId === peerId && p.connected !== connected) {
      changed = true;
      return { ...p, connected };
    }
    return p;
  });
  if (changed) {
    useRoomStore.getState().setView({ ...view, players });
  }
}

