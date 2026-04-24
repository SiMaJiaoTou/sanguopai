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
  | 'error'
  | 'unreachable';

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
// 免费云平台（Render / Fly 休眠档）冷启动可能 20~30 秒，给足重试窗口
const MAX_RECONNECT_ATTEMPTS = 15; // 达到后停止，状态置 unreachable，要用户介入

const LOG_PREFIX = '[net]';

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
  /** 本次 open() 调用后是否曾经成功打开过（区分"连不上" vs "断线") */
  private everOpened = false;
  private reconnectAttempts = 0;
  /** 给上层回调 onError 时附带最后一次 wsErr 时间戳，防重复 */
  private lastErrorCode: string | null = null;

  constructor(url?: string) {
    this.url = url ?? inferDefaultUrl();
    console.info(`${LOG_PREFIX} relay URL = ${this.url}`);
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  get currentUrl(): string {
    return this.url;
  }

  subscribe(l: NetworkListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  setUrl(url: string) {
    console.info(`${LOG_PREFIX} setUrl → ${url}`);
    this.url = url;
  }

  /** 创建房间（会自动成为 host） */
  createRoom(name: string) {
    console.info(`${LOG_PREFIX} createRoom name="${name}"`);
    this.lastJoinAttempt = { t: 'create', name };
    this.reconnectAttempts = 0;
    this.ensureOpen(() => this.send({ t: 'create', name }));
  }

  /** 加入房间 */
  joinRoom(room: string, name: string) {
    console.info(`${LOG_PREFIX} joinRoom room=${room} name="${name}"`);
    this.lastJoinAttempt = { t: 'join', room, name };
    this.reconnectAttempts = 0;
    this.ensureOpen(() => this.send({ t: 'join', room, name }));
  }

  /** 主动离开并断开 */
  leaveRoom() {
    console.info(`${LOG_PREFIX} leaveRoom (manual)`);
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

  /** 供 UI 提供的"手动重试"入口：把计数清零并重新尝试连接 */
  retry() {
    console.info(`${LOG_PREFIX} retry()`);
    this.reconnectAttempts = 0;
    this.manualClose = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.open();
    if (this.lastJoinAttempt) {
      const attempt = this.lastJoinAttempt;
      this.ws?.addEventListener('open', () => this.send(attempt), {
        once: true,
      });
    }
  }

  // ------------------ internal ------------------
  private setStatus(s: ConnectionStatus) {
    if (s === this.status) return;
    console.info(`${LOG_PREFIX} status: ${this.status} → ${s}`);
    this.status = s;
    for (const l of this.listeners) l.onStatusChange?.(s);
  }

  private emitError(code: string, msg: string) {
    if (this.lastErrorCode === code) return; // 不刷屏
    this.lastErrorCode = code;
    console.warn(`${LOG_PREFIX} ERROR ${code}: ${msg}`);
    for (const l of this.listeners) l.onError?.(code, msg);
  }

  private ensureOpen(thenSend: () => void) {
    this.manualClose = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      thenSend();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.addEventListener('open', thenSend, { once: true });
      return;
    }
    this.open();
    this.ws?.addEventListener('open', thenSend, { once: true });
  }

  private open() {
    console.info(
      `${LOG_PREFIX} open() → ${this.url} (attempt ${this.reconnectAttempts + 1})`,
    );
    this.everOpened = false;
    try {
      this.setStatus('connecting');
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.emitError(
        'URL_INVALID',
        `无法构造 WebSocket：${String(e)} · 检查地址是否以 ws:// 或 wss:// 开头`,
      );
      this.setStatus('error');
      return;
    }
    this.ws.onopen = () => {
      console.info(`${LOG_PREFIX} onopen`);
      this.everOpened = true;
      this.reconnectAttempts = 0;
      this.lastErrorCode = null;
      this.setStatus('connected');
      this.startHeartbeat();
    };
    this.ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(ev.data) as ServerMsg;
      } catch {
        console.warn(`${LOG_PREFIX} bad JSON from server`, ev.data);
        return;
      }
      this.dispatch(msg);
    };
    this.ws.onerror = (ev) => {
      // 浏览器不给细节；仅在控制台留日志
      console.warn(`${LOG_PREFIX} ws onerror`, ev);
    };
    this.ws.onclose = (ev) => {
      console.warn(
        `${LOG_PREFIX} onclose code=${ev.code} reason="${ev.reason}" everOpened=${this.everOpened}`,
      );
      this.stopHeartbeat();
      this.ws = null;
      if (this.manualClose) return;

      // 首次就连不上 —— 几乎可以确定 relay 未启动或地址错
      if (!this.everOpened) {
        this.reconnectAttempts += 1;
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          this.setStatus('unreachable');
          this.emitError(
            'RELAY_UNREACHABLE',
            `无法连接中继 ${this.url} · 请先启动 server/ 目录下的中继服务 (npm run dev)，或点【自定中继地址】修改`,
          );
          return;
        }
        // 继续尝试，但让用户看到重连计数
        this.setStatus('reconnecting');
        this.reconnectTimer = window.setTimeout(
          () => this.open(),
          RECONNECT_DELAY_MS,
        );
        return;
      }

      // 已连上后掉线 → 常规重连（无上限，但会提示）
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
    } else {
      console.warn(
        `${LOG_PREFIX} send() dropped: socket not open (${msg.t})`,
      );
    }
  }

  private dispatch(msg: ServerMsg) {
    switch (msg.t) {
      case 'welcome':
        console.info(
          `${LOG_PREFIX} welcome room=${msg.room} id=${msg.yourId} isHost=${msg.isHost} players=${msg.players.length}`,
        );
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
        console.info(`${LOG_PREFIX} peerJoined ${msg.peer.name} (${msg.peer.id})`);
        for (const l of this.listeners) l.onPeerJoined?.(msg.peer);
        break;
      case 'peerLeft':
        console.info(
          `${LOG_PREFIX} peerLeft ${msg.peerId} newHost=${msg.newHostId ?? 'none'}`,
        );
        for (const l of this.listeners)
          l.onPeerLeft?.(msg.peerId, msg.newHostId ?? null);
        break;
      case 'promoted':
        console.info(`${LOG_PREFIX} promoted to host`);
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
        this.emitError(msg.code, msg.msg);
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
  if (
    loc.hostname === 'localhost' ||
    loc.hostname === '127.0.0.1' ||
    loc.hostname === ''
  ) {
    return `ws://${loc.hostname || 'localhost'}:8787`;
  }
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${loc.host}/ws`;
}

// 单例导出
export const network = new NetworkClient();
