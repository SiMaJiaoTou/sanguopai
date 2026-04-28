// 三国扑克 · WebSocket 中继服务
// -------------------------------------------------------------------
// Host-authoritative 架构：本服务不含任何游戏逻辑，只做四件事：
//   1. 维护房间 → 成员列表的映射
//   2. 转发 Client → Host 的 intent
//   3. 转发 Host → 所有成员的 state / 点对点私密消息
//   4. 断线宽限：peer 掉线 30s 内带 sessionToken 可以 resume 接回原座位
//
// 协议约定（与 src/net/protocol.ts 一致）：
//   Client 发给 relay 的消息格式：
//     { t: 'create', name }
//     { t: 'join',   room, name }
//     { t: 'resume', sessionToken }               // 重连接回原 peer
//     { t: 'intent', action }                     // → 只转给 host
//     { t: 'hostEvent', target?: peerId, payload } // → host 发给某人或全房
//     { t: 'heartbeat' }
//   Relay 下发给 Client：
//     { t: 'welcome', yourId, sessionToken, isHost, room, players }
//     { t: 'welcomeResume', yourId, isHost, room, players }
//     { t: 'peerJoined', peer }
//     { t: 'peerDisconnected', peerId }           // 进入 30s 宽限期
//     { t: 'peerResumed', peerId }                // 宽限期内恢复
//     { t: 'peerLeft',   peerId, newHostId? }     // 真的走了/超时
//     { t: 'promoted' }
//     { t: 'intent',     from: peerId, action }   // 仅 host 收得到
//     { t: 'hostEvent',  payload }                // 对应客户端收到
//     { t: 'error',      code, msg }
// -------------------------------------------------------------------

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_PLAYERS_PER_ROOM = 8;
/** 应用层心跳（client 主动发 { t:'heartbeat' }）超时：60s 没消息才算死 */
const HEARTBEAT_TIMEOUT_MS = 60_000;
/** 掉线宽限期：socket close 后 peer 保留在 limbo 的时长，期间可带 token 接回。
 *  Render 免费档偶发 20~40s 抖动，放到 60s 比较稳。 */
const DISCONNECT_GRACE_MS = 60_000;
/** ping/pong 容忍：允许连续 missed ping 次数，超过才 terminate。
 *  每 tick 5s 发一次 ping，3 次 miss = 15s 无响应才判死，能扛住 Render
 *  网络短暂抖动（路由切换 / 邻居噪声 / GC pause 等）。 */
const MAX_MISSED_PINGS = 3;
const ROOM_CODE_LEN = 6;

// ------ 数据结构 ------
/**
 * @typedef {{
 *   id: string,
 *   ws: import('ws').WebSocket | null,   // 掉线期间为 null
 *   sessionToken: string,                 // 用于 resume 的凭证
 *   name: string,
 *   room: string,
 *   isHost: boolean,
 *   lastSeen: number,
 *   disconnectedAt: number | null,        // 进入宽限期的时间戳；null = 在线
 * }} Peer
 */

/** @type {Map<string, Set<Peer>>} */
const rooms = new Map();
/** sessionToken → peer 的快速索引（含宽限期内的） */
const tokens = new Map();

// ------ 辅助 ------
function genRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < ROOM_CODE_LEN; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  } while (rooms.has(code));
  return code;
}

function peerPublic(p) {
  return { id: p.id, name: p.name, isHost: p.isHost };
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room, msg, exclude) {
  const peers = rooms.get(room);
  if (!peers) return;
  for (const p of peers) {
    if (exclude && p.id === exclude) continue;
    if (!p.ws) continue; // 跳过宽限期内掉线的 peer
    send(p.ws, msg);
  }
}

function getHost(room) {
  const peers = rooms.get(room);
  if (!peers) return null;
  for (const p of peers) if (p.isHost) return p;
  return null;
}

/** 真正把 peer 从房间里踢出：升 host、广播 peerLeft、必要时销毁空房 */
function removePeerFromRoom(peer, reason) {
  const peers = rooms.get(peer.room);
  if (!peers || !peers.has(peer)) return;
  peers.delete(peer);
  tokens.delete(peer.sessionToken);

  let newHostId = null;
  if (peer.isHost && peers.size > 0) {
    // 优先选一个仍然在线的 peer 接任，避免把 host 交给宽限期内的"僵尸"
    let nextHost = null;
    for (const cand of peers) {
      if (cand.ws) {
        nextHost = cand;
        break;
      }
    }
    // 全都在宽限期内？只能挑一个（等他们回来再生效）
    if (!nextHost) nextHost = peers.values().next().value;
    nextHost.isHost = true;
    newHostId = nextHost.id;
    if (nextHost.ws) send(nextHost.ws, { t: 'promoted' });
  }

  if (peers.size === 0) {
    rooms.delete(peer.room);
    console.log(`[room ${peer.room}] 空房销毁 (${reason})`);
  } else {
    broadcast(peer.room, { t: 'peerLeft', peerId: peer.id, newHostId });
    console.log(
      `[room ${peer.room}] ${peer.name} (${peer.id}) 离开 · ${reason} · 剩 ${peers.size} 人${
        newHostId ? ` · 新 host=${newHostId}` : ''
      }`,
    );
  }
}

/**
 * 批量踢出多个 peer —— 用于 ping-storm / 宽限期批量超时等"一群人同时死"的
 * 场景。相比循环调用 removePeerFromRoom，这里：
 *   · 只做一次 host 迁移（不会连续 promote → kick → promote → kick）
 *   · 只广播一轮 peerLeft（每个 victim 一条，新 host 只在最后一条挂上）
 *   · 幸存者如果全是"宽限期僵尸"，也不会选出一个马上要死的 host
 */
function batchRemovePeers(roomCode, victims) {
  const peers = rooms.get(roomCode);
  if (!peers) return;

  const victimSet = new Set(victims);
  const hostVictim = victims.find((v) => v.isHost) ?? null;

  // 先把所有 victim 从 room / tokens 剔除
  for (const v of victims) {
    peers.delete(v);
    tokens.delete(v.sessionToken);
  }

  let newHostId = null;
  if (hostVictim && peers.size > 0) {
    // 在幸存者里找一个仍然在线（ws 存在且不在宽限期）的 peer 接任
    let nextHost = null;
    for (const cand of peers) {
      if (cand.ws && cand.disconnectedAt === null) {
        nextHost = cand;
        break;
      }
    }
    // 全都在宽限期里 → 随便选一个，等他们回来再生效
    if (!nextHost) nextHost = peers.values().next().value;
    nextHost.isHost = true;
    newHostId = nextHost.id;
    if (nextHost.ws) send(nextHost.ws, { t: 'promoted' });
  }

  if (peers.size === 0) {
    rooms.delete(roomCode);
    console.log(`[room ${roomCode}] 空房销毁 (批量宽限期超时 × ${victims.length})`);
    return;
  }

  // 每个 victim 广播一条 peerLeft；newHostId 只在最后一条里带上
  const victimIds = victims.map((v) => v.id);
  for (let i = 0; i < victimIds.length; i++) {
    const isLast = i === victimIds.length - 1;
    broadcast(roomCode, {
      t: 'peerLeft',
      peerId: victimIds[i],
      newHostId: isLast ? newHostId : null,
    });
  }
  console.log(
    `[room ${roomCode}] 批量踢出 ${victims.length} 人 · 剩 ${peers.size} 人${
      newHostId ? ` · 新 host=${newHostId}` : ''
    }`,
  );
}

/** socket 关闭 —— 进入 30s 宽限期，不立即踢出 */
function onSocketClose(ws) {
  const p = ws.peer;
  if (!p) return;
  if (p.disconnectedAt !== null) return; // 已经在宽限期

  p.ws = null;
  p.disconnectedAt = Date.now();
  ws.peer = null;

  const peers = rooms.get(p.room);
  if (!peers || !peers.has(p)) return;

  broadcast(p.room, { t: 'peerDisconnected', peerId: p.id });
  console.log(
    `[room ${p.room}] ${p.name} 掉线，进入 ${DISCONNECT_GRACE_MS / 1000}s 宽限期`,
  );
}

// ------ WebSocket Server ------
const wss = new WebSocketServer({ port: PORT, maxPayload: 128 * 1024 });
console.log(
  `[relay] listening ws://localhost:${PORT} · heartbeat ${HEARTBEAT_TIMEOUT_MS / 1000}s · grace ${DISCONNECT_GRACE_MS / 1000}s · ping tolerance ${MAX_MISSED_PINGS} misses`,
);

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[conn] new connection from ${ip}`);

  ws.peer = null;
  ws.missedPings = 0;

  ws.on('pong', () => {
    ws.missedPings = 0;
    if (ws.peer) ws.peer.lastSeen = Date.now();
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { t: 'error', code: 'BAD_JSON', msg: 'invalid json' });
    }
    handleMessage(ws, msg);
  });

  ws.on('close', () => onSocketClose(ws));
  ws.on('error', () => onSocketClose(ws));
});

function handleMessage(ws, msg) {
  switch (msg.t) {
    case 'create': {
      if (ws.peer) {
        return send(ws, { t: 'error', code: 'ALREADY_IN_ROOM', msg: '已在房间中' });
      }
      const name = sanitizeName(msg.name);
      const code = genRoomCode();
      const sessionToken = randomUUID();
      const peer = {
        id: randomUUID(),
        ws,
        sessionToken,
        name,
        room: code,
        isHost: true,
        lastSeen: Date.now(),
        disconnectedAt: null,
      };
      ws.peer = peer;
      rooms.set(code, new Set([peer]));
      tokens.set(sessionToken, peer);
      console.log(`[room ${code}] 由 ${name} 创建`);
      send(ws, {
        t: 'welcome',
        yourId: peer.id,
        sessionToken,
        isHost: true,
        room: code,
        players: [peerPublic(peer)],
      });
      return;
    }

    case 'join': {
      if (ws.peer) {
        return send(ws, { t: 'error', code: 'ALREADY_IN_ROOM', msg: '已在房间中' });
      }
      const room = String(msg.room ?? '').toUpperCase();
      const name = sanitizeName(msg.name);
      const peers = rooms.get(room);
      if (!peers) {
        return send(ws, { t: 'error', code: 'ROOM_NOT_FOUND', msg: '房间不存在' });
      }
      if (peers.size >= MAX_PLAYERS_PER_ROOM) {
        return send(ws, { t: 'error', code: 'ROOM_FULL', msg: '房间已满' });
      }
      const sessionToken = randomUUID();
      const peer = {
        id: randomUUID(),
        ws,
        sessionToken,
        name,
        room,
        isHost: false,
        lastSeen: Date.now(),
        disconnectedAt: null,
      };
      ws.peer = peer;
      peers.add(peer);
      tokens.set(sessionToken, peer);
      const players = Array.from(peers).map(peerPublic);
      send(ws, {
        t: 'welcome',
        yourId: peer.id,
        sessionToken,
        isHost: false,
        room,
        players,
      });
      broadcast(room, { t: 'peerJoined', peer: peerPublic(peer) }, peer.id);
      console.log(`[room ${room}] ${name} 加入 · 当前 ${peers.size} 人`);
      return;
    }

    case 'resume': {
      if (ws.peer) {
        return send(ws, { t: 'error', code: 'ALREADY_IN_ROOM', msg: '已在房间中' });
      }
      const token = String(msg.sessionToken ?? '');
      const peer = tokens.get(token);
      if (!peer) {
        console.log(`[resume] unknown token ${token.slice(0, 8)}… · SESSION_EXPIRED`);
        return send(ws, {
          t: 'error',
          code: 'SESSION_EXPIRED',
          msg: '会话已过期 · 请重新开房',
        });
      }
      if (
        peer.disconnectedAt !== null &&
        Date.now() - peer.disconnectedAt > DISCONNECT_GRACE_MS
      ) {
        console.log(
          `[resume] token ${token.slice(0, 8)}… (${peer.name}) · grace period elapsed · SESSION_EXPIRED`,
        );
        tokens.delete(token);
        return send(ws, {
          t: 'error',
          code: 'SESSION_EXPIRED',
          msg: '会话已过期 · 请重新开房',
        });
      }
      peer.ws = ws;
      const wasDisconnected = peer.disconnectedAt !== null;
      peer.disconnectedAt = null;
      peer.lastSeen = Date.now();
      ws.peer = peer;
      const peers = rooms.get(peer.room);
      const players = peers
        ? Array.from(peers).map(peerPublic)
        : [peerPublic(peer)];
      send(ws, {
        t: 'welcomeResume',
        yourId: peer.id,
        isHost: peer.isHost,
        room: peer.room,
        players,
      });
      broadcast(peer.room, { t: 'peerResumed', peerId: peer.id }, peer.id);
      console.log(
        `[room ${peer.room}] ${peer.name} 重连成功 · ${wasDisconnected ? '断线' : '立即'}重连 · isHost=${peer.isHost}`,
      );
      return;
    }

    case 'intent': {
      const p = ws.peer;
      if (!p) return;
      if (p.isHost) return;
      const host = getHost(p.room);
      if (!host || !host.ws) return;
      send(host.ws, { t: 'intent', from: p.id, action: msg.action });
      return;
    }

    case 'hostEvent': {
      const p = ws.peer;
      if (!p || !p.isHost) return;
      if (msg.target) {
        const peers = rooms.get(p.room);
        if (!peers) return;
        for (const other of peers) {
          if (other.id === msg.target) {
            send(other.ws, { t: 'hostEvent', payload: msg.payload });
            break;
          }
        }
      } else {
        broadcast(p.room, { t: 'hostEvent', payload: msg.payload }, p.id);
      }
      return;
    }

    case 'heartbeat': {
      if (ws.peer) ws.peer.lastSeen = Date.now();
      send(ws, { t: 'heartbeatAck' });
      return;
    }

    case 'leave': {
      // 主动离开 —— 立即清理，不进宽限期
      const p = ws.peer;
      if (!p) return;
      ws.peer = null;
      removePeerFromRoom(p, '主动离开');
      return;
    }

    default:
      send(ws, { t: 'error', code: 'UNKNOWN_MSG', msg: `未知消息: ${msg.t}` });
  }
}

function sanitizeName(raw) {
  const s = String(raw ?? '').trim().slice(0, 16);
  return s.length > 0 ? s : '无名氏';
}

// ------ 心跳与宽限期超时清理 ------
setInterval(() => {
  // 1) ping 循环：容忍 MAX_MISSED_PINGS 次 miss 才判死，抗网络抖动
  for (const ws of wss.clients) {
    ws.missedPings = (ws.missedPings ?? 0) + 1;
    if (ws.missedPings > MAX_MISSED_PINGS) {
      const who = ws.peer ? `${ws.peer.name} (${ws.peer.id.slice(0, 8)})` : 'unknown';
      console.log(
        `[ping] terminate ${who} · ${ws.missedPings} consecutive missed pongs`,
      );
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      continue;
    }
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }

  const now = Date.now();

  // 2) 应用层心跳超时（client 没发 heartbeat 消息）→ 关 socket 进入宽限期
  for (const [, peers] of rooms) {
    for (const p of peers) {
      if (p.ws && now - p.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        console.log(
          `[room ${p.room}] ${p.name} 心跳超时 (${Math.floor((now - p.lastSeen) / 1000)}s 无消息)，关 socket`,
        );
        try {
          p.ws.close();
        } catch {
          /* ignore */
        }
      }
    }
  }

  // 3) 宽限期超时 → 真正踢出。为防止同一 tick 批量超时时的连锁 promote
  //    风暴（每踢一人就 promote 下一个、下一个马上又被踢），先收集再统一处理。
  /** @type {Peer[]} */
  const timedOut = [];
  for (const [, peers] of rooms) {
    for (const p of peers) {
      if (
        p.disconnectedAt !== null &&
        now - p.disconnectedAt > DISCONNECT_GRACE_MS
      ) {
        timedOut.push(p);
      }
    }
  }
  if (timedOut.length > 0) {
    // 按房间聚合批量清理，避免 host 链式迁移
    /** @type {Map<string, Peer[]>} */
    const byRoom = new Map();
    for (const p of timedOut) {
      const arr = byRoom.get(p.room) ?? [];
      arr.push(p);
      byRoom.set(p.room, arr);
    }
    for (const [roomCode, victims] of byRoom) {
      console.log(
        `[room ${roomCode}] batch grace-timeout: ${victims.length} peers (${victims.map((v) => v.name).join(', ')})`,
      );
      batchRemovePeers(roomCode, victims);
    }
  }
}, 5_000);

// ------ 优雅关闭 ------
process.on('SIGINT', () => {
  console.log('[relay] shutting down');
  wss.close(() => process.exit(0));
});
