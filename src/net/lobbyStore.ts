// 大厅 / 连接状态 store
// -------------------------------------------------------------------
// 关注点分离：这里只管网络会话 / 房间成员 / 当前屏幕，
// 与 useGameStore（实际游戏状态）互不侵入。

import { create } from 'zustand';
import { network, type ConnectionStatus } from './Network';
import type { PeerInfo } from './protocol';

export type LobbyScreen =
  | 'main'          // 主菜单（单机 / 联机 / GM 工具等）
  | 'create'        // 创建房间输入昵称
  | 'join'          // 输入房间码 + 昵称
  | 'room'          // 房间待命
  | 'inGame';       // 已进入游戏（交给主 App 渲染）

interface LobbyState {
  screen: LobbyScreen;

  // 账户（跨界面保留）
  nickname: string;

  // 当前会话
  roomCode: string | null;
  myPeerId: string | null;
  isHost: boolean;
  peers: PeerInfo[];              // 房内所有成员（含自己），按加入顺序

  // 连接状态
  connectionStatus: ConnectionStatus;
  lastError: string | null;

  // 设置 relay URL（一般不需要）
  relayUrl: string;

  // actions
  setScreen: (s: LobbyScreen) => void;
  setNickname: (n: string) => void;
  setRelayUrl: (u: string) => void;

  createRoom: () => void;
  joinRoom: (room: string) => void;
  leaveRoom: () => void;

  // 内部：由 Network 回调驱动
  _applyWelcome: (arg: {
    yourId: string;
    isHost: boolean;
    room: string;
    players: PeerInfo[];
  }) => void;
  _peerJoined: (peer: PeerInfo) => void;
  _peerLeft: (peerId: string, newHostId: string | null) => void;
  _promoted: () => void;
  _setStatus: (s: ConnectionStatus) => void;
  _setError: (msg: string | null) => void;
  _reset: () => void;
}

const initialState = {
  screen: 'main' as LobbyScreen,
  nickname: loadNickname(),
  roomCode: null as string | null,
  myPeerId: null as string | null,
  isHost: false,
  peers: [] as PeerInfo[],
  connectionStatus: 'idle' as ConnectionStatus,
  lastError: null as string | null,
  relayUrl: loadRelayUrl(),
};

export const useLobbyStore = create<LobbyState>((set, get) => ({
  ...initialState,

  setScreen: (s) => set({ screen: s }),

  setNickname: (n) => {
    const name = n.trim().slice(0, 16) || '无名氏';
    saveNickname(name);
    set({ nickname: name });
  },

  setRelayUrl: (u) => {
    saveRelayUrl(u);
    network.setUrl(u);
    set({ relayUrl: u });
  },

  createRoom: () => {
    const name = get().nickname || '无名氏';
    set({ lastError: null });
    network.createRoom(name);
  },

  joinRoom: (room) => {
    const name = get().nickname || '无名氏';
    const code = room.trim().toUpperCase();
    if (code.length < 4) {
      set({ lastError: '房间码无效' });
      return;
    }
    set({ lastError: null });
    network.joinRoom(code, name);
  },

  leaveRoom: () => {
    network.leaveRoom();
    set({
      roomCode: null,
      myPeerId: null,
      isHost: false,
      peers: [],
      screen: 'main',
      lastError: null,
    });
  },

  _applyWelcome: ({ yourId, isHost, room, players }) =>
    set({
      roomCode: room,
      myPeerId: yourId,
      isHost,
      peers: players,
      screen: 'room',
      lastError: null,
    }),

  _peerJoined: (peer) =>
    set((s) => ({
      peers: [...s.peers.filter((p) => p.id !== peer.id), peer],
    })),

  _peerLeft: (peerId, newHostId) =>
    set((s) => {
      const peers = s.peers
        .filter((p) => p.id !== peerId)
        .map((p) =>
          newHostId && p.id === newHostId ? { ...p, isHost: true } : p,
        );
      const isHost =
        s.myPeerId !== null && newHostId !== null && s.myPeerId === newHostId
          ? true
          : s.isHost;
      return { peers, isHost };
    }),

  _promoted: () =>
    set((s) => ({
      isHost: true,
      peers: s.peers.map((p) =>
        p.id === s.myPeerId ? { ...p, isHost: true } : p,
      ),
    })),

  _setStatus: (cs) => set({ connectionStatus: cs }),

  _setError: (msg) => set({ lastError: msg }),

  _reset: () =>
    set({
      roomCode: null,
      myPeerId: null,
      isHost: false,
      peers: [],
      screen: 'main',
      connectionStatus: 'idle',
      lastError: null,
    }),
}));

// ------ 把 Network 事件接到 store 上 ------
network.subscribe({
  onStatusChange: (s) => useLobbyStore.getState()._setStatus(s),
  onWelcome: (w) => useLobbyStore.getState()._applyWelcome(w),
  onPeerJoined: (p) => useLobbyStore.getState()._peerJoined(p),
  onPeerLeft: (id, newHost) =>
    useLobbyStore.getState()._peerLeft(id, newHost),
  onPromoted: () => useLobbyStore.getState()._promoted(),
  onError: (code, msg) =>
    useLobbyStore.getState()._setError(`${code}: ${msg}`),
});

// ------ 本地缓存 ------
function loadNickname(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('sanguo.nickname') ?? '';
}
function saveNickname(n: string) {
  try {
    localStorage.setItem('sanguo.nickname', n);
  } catch {
    /* ignore */
  }
}
function loadRelayUrl(): string {
  if (typeof localStorage === 'undefined') return '';
  const saved = localStorage.getItem('sanguo.relayUrl') ?? '';
  if (saved) network.setUrl(saved);
  return saved;
}
function saveRelayUrl(u: string) {
  try {
    localStorage.setItem('sanguo.relayUrl', u);
  } catch {
    /* ignore */
  }
}
