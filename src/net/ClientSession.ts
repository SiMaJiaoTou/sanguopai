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
