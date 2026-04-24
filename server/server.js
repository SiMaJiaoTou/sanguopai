// 三国扑克 · WebSocket 中继服务
// -------------------------------------------------------------------
// Host-authoritative 架构：本服务不含任何游戏逻辑，只做三件事：
//   1. 维护房间 → 成员列表的映射
//   2. 转发 Client → Host 的 intent
//   3. 转发 Host → 所有成员的 state / 点对点私密消息
//
// 协议约定（与 src/net/protocol.ts 一致）：
//   Client 发给 relay 的消息格式：
//     { t: 'create', name }
//     { t: 'join',   room, name }
//     { t: 'intent', action }                     // → 只转给 host
//     { t: 'hostEvent', target?: peerId, payload } // → host 发给某人或全房
//     { t: 'heartbeat' }
//   Relay 下发给 Client：
//     { t: 'welcome', yourId, isHost, room, players }
//     { t: 'peerJoined', peer }
//     { t: 'peerLeft',   peerId, newHostId? }
//     { t: 'intent',     from: peerId, action }   // 仅 host 收得到
//     { t: 'hostEvent',  payload }                // 对应客户端收到
//     { t: 'error',      code, msg }
// -------------------------------------------------------------------

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_PLAYERS_PER_ROOM = 8;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const ROOM_CODE_LEN = 6;

// ------ 数据结构 ------
/**
 * @typedef {{
 *   id: string,
 *   ws: import('ws').WebSocket,
 *   name: string,
 *   room: string,
 *   isHost: boolean,
 *   lastSeen: number,
 * }} Peer
 */

/** @type {Map<string, Set<Peer>>} */
const rooms = new Map();

// ------ 辅助 ------
function genRoomCode() {
  // 6 位大写字母+数字；排除容易混淆的 0 O I 1
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
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room, msg, exclude) {
  const peers = rooms.get(room);
  if (!peers) return;
  for (const p of peers) {
    if (exclude && p.id === exclude) continue;
    send(p.ws, msg);
  }
}

function getHost(room) {
  const peers = rooms.get(room);
  if (!peers) return null;
  for (const p of peers) if (p.isHost) return p;
  return null;
}

function cleanupPeer(ws) {
  const p = ws.peer;
  if (!p) return;
  const peers = rooms.get(p.room);
  if (!peers) return;
  peers.delete(p);

  let newHostId = null;
  if (p.isHost && peers.size > 0) {
    // Host 迁移给最早进来的一位（Set 的迭代顺序 = 插入顺序）
    const nextHost = peers.values().next().value;
    nextHost.isHost = true;
    newHostId = nextHost.id;
    send(nextHost.ws, { t: 'promoted' });
  }
  if (peers.size === 0) {
    rooms.delete(p.room);
    console.log(`[room ${p.room}] 空房销毁`);
  } else {
    broadcast(p.room, { t: 'peerLeft', peerId: p.id, newHostId });
    console.log(
      `[room ${p.room}] ${p.name} (${p.id}) 离开 · 剩 ${peers.size} 人${
        newHostId ? ` · 新 host=${newHostId}` : ''
      }`,
    );
  }
  ws.peer = null;
}

// ------ WebSocket Server ------
const wss = new WebSocketServer({ port: PORT });
console.log(`[relay] listening ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[conn] new connection from ${ip}`);

  ws.peer = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
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

  ws.on('close', () => cleanupPeer(ws));
  ws.on('error', () => cleanupPeer(ws));
});

function handleMessage(ws, msg) {
  switch (msg.t) {
    case 'create': {
      if (ws.peer) {
        return send(ws, { t: 'error', code: 'ALREADY_IN_ROOM', msg: '已在房间中' });
      }
      const name = sanitizeName(msg.name);
      const code = genRoomCode();
      const peer = {
        id: randomUUID(),
        ws,
        name,
        room: code,
        isHost: true,
        lastSeen: Date.now(),
      };
      ws.peer = peer;
      rooms.set(code, new Set([peer]));
      console.log(`[room ${code}] 由 ${name} 创建`);
      send(ws, {
        t: 'welcome',
        yourId: peer.id,
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
      const peer = {
        id: randomUUID(),
        ws,
        name,
        room,
        isHost: false,
        lastSeen: Date.now(),
      };
      ws.peer = peer;
      peers.add(peer);
      const players = Array.from(peers).map(peerPublic);
      send(ws, {
        t: 'welcome',
        yourId: peer.id,
        isHost: false,
        room,
        players,
      });
      broadcast(room, { t: 'peerJoined', peer: peerPublic(peer) }, peer.id);
      console.log(`[room ${room}] ${name} 加入 · 当前 ${peers.size} 人`);
      return;
    }

    case 'intent': {
      const p = ws.peer;
      if (!p) return;
      // intent 只转给 host（host 发的 intent 忽略，host 自己直接处理）
      if (p.isHost) return;
      const host = getHost(p.room);
      if (!host) return;
      send(host.ws, { t: 'intent', from: p.id, action: msg.action });
      return;
    }

    case 'hostEvent': {
      const p = ws.peer;
      if (!p || !p.isHost) return; // 仅 host 有资格发
      if (msg.target) {
        // 点对点
        const peers = rooms.get(p.room);
        if (!peers) return;
        for (const other of peers) {
          if (other.id === msg.target) {
            send(other.ws, { t: 'hostEvent', payload: msg.payload });
            break;
          }
        }
      } else {
        // 广播给除 host 外的所有人
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
      cleanupPeer(ws);
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

// ------ 心跳与超时清理 ------
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
  // 检查 30s 无心跳的 peer
  const now = Date.now();
  for (const [code, peers] of rooms) {
    for (const p of [...peers]) {
      if (now - p.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        console.log(`[room ${code}] ${p.name} 心跳超时，踢出`);
        try {
          p.ws.close();
        } catch {
          // ignore
        }
        cleanupPeer(p.ws);
      }
    }
  }
}, 10_000);

// ------ 优雅关闭 ------
process.on('SIGINT', () => {
  console.log('[relay] shutting down');
  wss.close(() => process.exit(0));
});
