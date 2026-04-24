// 房间运行时 store —— host 与 client 都用它来承载 ClientView
// -------------------------------------------------------------------
// host：本地同时持有 RoomState（权威）和 ClientView（用于自己 UI）
// client：只收 host 广播的 ClientView

import { create } from 'zustand';
import type { ClientView } from './roomTypes';

interface RoomRuntimeState {
  /** 当前有效的 ClientView；null = 未进入游戏 */
  view: ClientView | null;
  setView: (v: ClientView | null) => void;
}

export const useRoomStore = create<RoomRuntimeState>((set) => ({
  view: null,
  setView: (v) => set({ view: v }),
}));
