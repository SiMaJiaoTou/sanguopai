// WebSocket 客户端（单例）
// -------------------------------------------------------------------
// 只负责 socket lifecycle / 心跳 / 重连，不关心业务语义。
// 上层通过 subscribe 订阅事件，通过 createRoom/joinRoom/sendIntent 发消息。

import type {
  ClientMsg,
  GameAction,
  HostEvent,
  PeerInfo,
  ServerMsg,
} from './protocol';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'in_room'
  | 'reconnecting'
  | 'error';

export interface NetworkListener {
  onStatusChange?: (status: ConnectionStatus) => void;
  onWelcome?: (msg: {
    yourId: string;
    isHost: boolean;
    room: string;
    players: PeerInfo[];
  }) => void;
  onPeerJoined?: (peer: PeerInfo) => void;
  onPeerLeft?: (peerId: string, newHostId: string | null) => void;
  onPromoted?: () => void;
  /** 仅 host 会收到 —— relay 已自动过滤 */
  onIntent?: (from: string, action: GameAction) => void;
  /** 其他成员收到的 host 广播事件 */
  onHostEvent?: (payload: HostEvent) => void;
  onError?: (code: string, msg: string) => void;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const RECONNECT_DELAY_MS = 2_000;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Set<NetworkListener>();
  private status: ConnectionStatus = 'idle';
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  /** 重连时自动重发的最后一次 join 指令 */
  private lastJoinAttempt:
    | { t: 'create'; name: string }
    | { t: 'join'; room: string; name: string }
    | null = null;
  private manualClose = false;

  constructor(url?: string) {
    this.url = url ?? inferDefaultUrl();
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  subscribe(l: NetworkListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  setUrl(url: string) {
    this.url = url;
  }

  /** 创建房间（会自动成为 host） */
  createRoom(name: string) {
    this.lastJoinAttempt = { t: 'create', name };
    this.ensureOpen(() => this.send({ t: 'create', name }));
  }

  /** 加入房间 */
  joinRoom(room: string, name: string) {
    this.lastJoinAttempt = { t: 'join', room, name };
    this.ensureOpen(() => this.send({ t: 'join', room, name }));
  }

  /** 主动离开并断开 */
  leaveRoom() {
    this.manualClose = true;
    this.lastJoinAttempt = null;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ t: 'leave' });
    }
    this.close();
    this.setStatus('idle');
  }

  /** 普通玩家 → host 发送操作意图 */
  sendIntent(action: GameAction) {
    this.send({ t: 'intent', action });
  }

  /** host 广播或定点发事件（target=undefined 为广播给非 host） */
  sendHostEvent(payload: HostEvent, target?: string) {
    this.send({ t: 'hostEvent', target, payload });
  }

  // ------------------ internal ------------------
  private setStatus(s: ConnectionStatus) {
    if (s === this.status) return;
    this.status = s;
    for (const l of this.listeners) l.onStatusChange?.(s);
  }

  private ensureOpen(thenSend: () => void) {
    this.manualClose = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      thenSend();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      // 正在连 → 排队
      this.ws.addEventListener('open', thenSend, { once: true });
      return;
    }
    this.open();
    this.ws?.addEventListener('open', thenSend, { once: true });
  }

  private open() {
    try {
      this.setStatus('connecting');
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.setStatus('error');
      return;
    }
    this.ws.onopen = () => {
      this.setStatus('connected');
      this.startHeartbeat();
    };
    this.ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(ev.data) as ServerMsg;
      } catch {
        return;
      }
      this.dispatch(msg);
    };
    this.ws.onerror = () => {
      // 错误细节浏览器不给，交给 onclose 处理
    };
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      if (this.manualClose) {
        return;
      }
      // 自动重连
      this.setStatus('reconnecting');
      this.reconnectTimer = window.setTimeout(() => {
        this.open();
        if (this.lastJoinAttempt) {
          const attempt = this.lastJoinAttempt;
          this.ws?.addEventListener(
            'open',
            () => this.send(attempt),
            { once: true },
          );
        }
      }, RECONNECT_DELAY_MS);
    };
  }

  private close() {
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private dispatch(msg: ServerMsg) {
    switch (msg.t) {
      case 'welcome':
        this.setStatus('in_room');
        for (const l of this.listeners)
          l.onWelcome?.({
            yourId: msg.yourId,
            isHost: msg.isHost,
            room: msg.room,
            players: msg.players,
          });
        break;
      case 'peerJoined':
        for (const l of this.listeners) l.onPeerJoined?.(msg.peer);
        break;
      case 'peerLeft':
        for (const l of this.listeners)
          l.onPeerLeft?.(msg.peerId, msg.newHostId ?? null);
        break;
      case 'promoted':
        for (const l of this.listeners) l.onPromoted?.();
        break;
      case 'intent':
        for (const l of this.listeners) l.onIntent?.(msg.from, msg.action);
        break;
      case 'hostEvent':
        for (const l of this.listeners) l.onHostEvent?.(msg.payload);
        break;
      case 'heartbeatAck':
        break;
      case 'error':
        for (const l of this.listeners) l.onError?.(msg.code, msg.msg);
        break;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ t: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/** 根据当前页面 URL 猜默认 relay URL */
function inferDefaultUrl(): string {
  const envUrl = (import.meta as any)?.env?.VITE_RELAY_URL;
  if (envUrl && typeof envUrl === 'string') return envUrl;
  if (typeof window === 'undefined') return 'ws://localhost:8787';
  const loc = window.location;
  // 开发环境：vite 默认 5173，relay 默认 8787
  if (
    loc.hostname === 'localhost' ||
    loc.hostname === '127.0.0.1' ||
    loc.hostname === ''
  ) {
    return `ws://${loc.hostname || 'localhost'}:8787`;
  }
  // 线上：默认 wss://同域 /ws
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${loc.host}/ws`;
}

// 单例导出
export const network = new NetworkClient();
