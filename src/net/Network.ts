// WebSocket 客户端（单例）
// -------------------------------------------------------------------
// 只负责 socket lifecycle / 心跳 / 重连，不关心业务语义。
// 上层通过 subscribe 订阅事件，通过 createRoom/joinRoom/sendIntent 发消息。
//
// 会话恢复（Tier 1 韧性）：
//   · welcome 时 server 发 sessionToken，存 sessionStorage
//   · socket 断开后 server 保留 peer 30s（limbo）
//   · client 重连成功后发 { t:'resume', sessionToken }
//   · 成功 → welcomeResume，期间 queue 的 intent/hostEvent 自动 flush
//   · 超时 → SESSION_EXPIRED，业务层再处理 abort

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
  /** 重连恢复后（server 返回 welcomeResume）—— 身份与原会话相同 */
  onResumed?: (msg: {
    yourId: string;
    isHost: boolean;
    room: string;
    players: PeerInfo[];
  }) => void;
  onPeerJoined?: (peer: PeerInfo) => void;
  /** peer 进入 30s 宽限期（UI 可显示"重连中"） */
  onPeerDisconnected?: (peerId: string) => void;
  /** peer 在宽限期内恢复 */
  onPeerResumed?: (peerId: string) => void;
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
// 免费云平台冷启动可能 20~30 秒 + 宽限期同样为 30s，给足重试窗口。
// 每次重试 2s 间隔，15 次 = 30s，刚好对齐 server 端宽限期。
const MAX_RECONNECT_ATTEMPTS = 15;

/** sessionStorage 里存的 key */
const SESSION_TOKEN_KEY = 'sanguo.sessionToken';

const LOG_PREFIX = '[net]';

export class NetworkClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Set<NetworkListener>();
  private status: ConnectionStatus = 'idle';
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  /** 最近一次 create/join 意图，仅在没有 sessionToken 可用时用于回退重试 */
  private lastJoinAttempt:
    | { t: 'create'; name: string }
    | { t: 'join'; room: string; name: string }
    | null = null;
  /** 会话令牌 —— 存在时重连走 resume 路径 */
  private sessionToken: string | null = null;
  private manualClose = false;
  /** 本次 open() 调用后是否曾经成功打开过（区分"连不上" vs "断线") */
  private everOpened = false;
  private reconnectAttempts = 0;
  /** 给上层回调 onError 时附带最后一次 wsErr 时间戳，防重复 */
  private lastErrorCode: string | null = null;
  /** 断连期间待发送的消息队列 —— welcome/welcomeResume 后 flush */
  private pendingQueue: ClientMsg[] = [];
  /** 是否已经完成身份握手（收到 welcome/welcomeResume），决定 send 行为 */
  private identified = false;

  constructor(url?: string) {
    this.url = url ?? inferDefaultUrl();
    console.info(`${LOG_PREFIX} relay URL = ${this.url}`);
    // 恢复上次会话的 token —— 页面刷新后也能重连
    this.sessionToken = loadSessionToken();
    if (this.sessionToken) {
      console.info(`${LOG_PREFIX} restored sessionToken from storage`);
    }
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
    this.clearSession();
    this.lastJoinAttempt = { t: 'create', name };
    this.reconnectAttempts = 0;
    this.ensureOpenAndSend({ t: 'create', name });
  }

  /** 加入房间 */
  joinRoom(room: string, name: string) {
    console.info(`${LOG_PREFIX} joinRoom room=${room} name="${name}"`);
    this.clearSession();
    this.lastJoinAttempt = { t: 'join', room, name };
    this.reconnectAttempts = 0;
    this.ensureOpenAndSend({ t: 'join', room, name });
  }

  /** 主动离开并断开 */
  leaveRoom() {
    console.info(`${LOG_PREFIX} leaveRoom (manual)`);
    this.manualClose = true;
    this.lastJoinAttempt = null;
    this.clearSession();
    this.pendingQueue = [];
    this.identified = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 直接 raw send，不走 send() 的队列逻辑
      try {
        this.ws.send(JSON.stringify({ t: 'leave' }));
      } catch {
        /* ignore */
      }
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

  private ensureOpenAndSend(msg: ClientMsg) {
    this.manualClose = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.rawSend(msg);
      return;
    }
    // 尚未打开 → 进 queue，socket 打开后自动 flush
    this.pendingQueue.push(msg);
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.open();
    }
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

      // 连接就绪后的身份握手顺序：
      // 1. 有 sessionToken → 尝试 resume 接回原身份
      // 2. 否则若有 pending 的 create/join（在 queue 头部），会被 flush
      if (this.sessionToken) {
        console.info(
          `${LOG_PREFIX} handshake: resume (token=${this.sessionToken.slice(0, 8)}…)`,
        );
        this.rawSend({ t: 'resume', sessionToken: this.sessionToken });
      } else if (this.pendingQueue.length > 0) {
        const first = this.pendingQueue.shift();
        if (first) {
          console.info(`${LOG_PREFIX} handshake: ${first.t} (no token)`);
          this.rawSend(first);
        }
      } else {
        console.info(`${LOG_PREFIX} handshake: nothing to send (idle connect)`);
      }
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
      console.warn(`${LOG_PREFIX} ws onerror`, ev);
    };
    this.ws.onclose = (ev) => {
      console.warn(
        `${LOG_PREFIX} onclose code=${ev.code} reason="${ev.reason}" everOpened=${this.everOpened}`,
      );
      this.stopHeartbeat();
      this.ws = null;
      this.identified = false;
      if (this.manualClose) return;

      // 首次就连不上 —— 几乎可以确定 relay 未启动或地址错
      if (!this.everOpened) {
        this.reconnectAttempts += 1;
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          this.setStatus('unreachable');
          this.emitError(
            'RELAY_UNREACHABLE',
            `无法连接中继 ${this.url} · 请先启动 server/ 目录下的中继服务，或点【自定中继地址】修改`,
          );
          return;
        }
        this.setStatus('reconnecting');
        this.reconnectTimer = window.setTimeout(
          () => this.open(),
          RECONNECT_DELAY_MS,
        );
        return;
      }

      // 已连上后掉线 → 常规重连。身份握手由 onopen 根据 sessionToken 处理。
      this.setStatus('reconnecting');
      this.reconnectAttempts += 1;
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.setStatus('unreachable');
        this.emitError(
          'RELAY_UNREACHABLE',
          `长时间无法连接中继 ${this.url} · 请检查网络或重新开房`,
        );
        return;
      }
      this.reconnectTimer = window.setTimeout(
        () => this.open(),
        RECONNECT_DELAY_MS,
      );
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
    this.identified = false;
  }

  /**
   * 业务层发消息的统一入口：
   *  · 已握手 + socket open → 直接发
   *  · 否则 → 入队列，等 welcome/welcomeResume 后 flush
   */
  private send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.identified) {
      this.rawSend(msg);
    } else {
      this.pendingQueue.push(msg);
      console.info(
        `${LOG_PREFIX} queued (status=${this.status}, identified=${this.identified}): ${msg.t}`,
      );
    }
  }

  /** 不走队列的直接发送，用于身份握手 / leave / resume */
  private rawSend(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn(
        `${LOG_PREFIX} rawSend dropped: socket not open (${msg.t})`,
      );
    }
  }

  /** 握手完成后把 pendingQueue 一次性发完 */
  private flushPending() {
    if (this.pendingQueue.length === 0) return;
    console.info(`${LOG_PREFIX} flushing ${this.pendingQueue.length} queued msgs`);
    const queue = this.pendingQueue;
    this.pendingQueue = [];
    for (const msg of queue) {
      this.rawSend(msg);
    }
  }

  private dispatch(msg: ServerMsg) {
    switch (msg.t) {
      case 'welcome':
        console.info(
          `${LOG_PREFIX} welcome room=${msg.room} id=${msg.yourId} isHost=${msg.isHost} players=${msg.players.length}`,
        );
        this.sessionToken = msg.sessionToken;
        saveSessionToken(msg.sessionToken);
        this.identified = true;
        this.setStatus('in_room');
        for (const l of this.listeners)
          l.onWelcome?.({
            yourId: msg.yourId,
            isHost: msg.isHost,
            room: msg.room,
            players: msg.players,
          });
        this.flushPending();
        break;
      case 'welcomeResume':
        console.info(
          `${LOG_PREFIX} welcomeResume room=${msg.room} id=${msg.yourId} isHost=${msg.isHost} players=${msg.players.length}`,
        );
        this.identified = true;
        this.setStatus('in_room');
        for (const l of this.listeners)
          l.onResumed?.({
            yourId: msg.yourId,
            isHost: msg.isHost,
            room: msg.room,
            players: msg.players,
          });
        this.flushPending();
        break;
      case 'peerJoined':
        console.info(`${LOG_PREFIX} peerJoined ${msg.peer.name} (${msg.peer.id})`);
        for (const l of this.listeners) l.onPeerJoined?.(msg.peer);
        break;
      case 'peerDisconnected':
        console.info(`${LOG_PREFIX} peerDisconnected ${msg.peerId}`);
        for (const l of this.listeners) l.onPeerDisconnected?.(msg.peerId);
        break;
      case 'peerResumed':
        console.info(`${LOG_PREFIX} peerResumed ${msg.peerId}`);
        for (const l of this.listeners) l.onPeerResumed?.(msg.peerId);
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
        // SESSION_EXPIRED 是可预期的"宽限期超时"错误 —— 清掉 token 避免再用
        if (msg.code === 'SESSION_EXPIRED') {
          this.clearSession();
          this.identified = false;
        }
        this.emitError(msg.code, msg.msg);
        break;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.identified) {
        this.rawSend({ t: 'heartbeat' });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearSession() {
    this.sessionToken = null;
    clearSessionToken();
  }
}

// ------ sessionStorage 帮助函数 ------
function loadSessionToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveSessionToken(token: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

function clearSessionToken() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** 根据当前页面 URL 猜默认 relay URL */
function inferDefaultUrl(): string {
  // 1. 本地开发（vite dev）→ 走本机 8787
  if (typeof window !== 'undefined') {
    const loc = window.location;
    if (
      loc.hostname === 'localhost' ||
      loc.hostname === '127.0.0.1' ||
      loc.hostname === ''
    ) {
      return `ws://${loc.hostname || 'localhost'}:8787`;
    }
  }
  // 2. 允许用 VITE_RELAY_URL 环境变量覆盖（可选）
  const envUrl = (import.meta as any)?.env?.VITE_RELAY_URL;
  if (envUrl && typeof envUrl === 'string') return envUrl;
  // 3. 线上默认：写死 Render 上的中继
  return 'wss://sanguopai.onrender.com';
}

// 单例导出
export const network = new NetworkClient();
