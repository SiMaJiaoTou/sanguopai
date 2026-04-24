// 线协议 —— 与 server/server.js 保持一一对应
// Host-authoritative：
//   · Client 发 intent（操作意图） → relay → host
//   · Host 处理后，用 hostEvent 广播 state 或定点发私密数据
//   · relay 本身不解析 action/payload 的业务字段

import type { Card } from '../types';
import type { GameMode } from '../store';

// -------------------- 房间成员 --------------------
export interface PeerInfo {
  id: string;
  name: string;
  isHost: boolean;
}

// -------------------- 游戏操作意图 --------------------
// 这些 action 描述"玩家想做什么"，host 用自己的 store 实际应用。
// 字段名沿用现有 store.ts 的动作名，方便后续 host 直接 dispatch。
export type SlotTargetPayload =
  | { type: 'hand' }
  | { type: 'team'; teamIndex: number; slotIndex: number };

export type GameAction =
  | { type: 'buyCard' }
  | { type: 'upgradeLevel' }
  | { type: 'moveCard'; fromId: string; to: SlotTargetPayload }
  | { type: 'redraw'; cardId: string }
  | { type: 'autoPlace' }
  | { type: 'recallAll' }
  | { type: 'pickTalent'; talentId: string }
  | { type: 'ready' }                          // 玩家点"下一年"
  | { type: 'unready' }
  | { type: 'chooseMode'; mode: GameMode }     // 仅 host 发起
  | { type: 'startGame' };                     // 仅 host 发起

// -------------------- Host → Clients 事件 --------------------
// payload 设计成"透明盒子"：relay 不关心内部，UI 层统一处理
export type HostEvent =
  // 全量/增量状态（此 PR 只定义协议，同步逻辑留到下一 PR）
  | { t: 'state'; state: unknown }
  // 大厅准备状态
  | { t: 'lobby'; modeChosen: GameMode | null; readyMap: Record<string, boolean> }
  // 私密：天赐候选只发给对应玩家
  | { t: 'privateHand'; hand: Card[] }
  // 广播：进入游戏
  | { t: 'gameStart' }
  // 广播：对战结果（客户端播动画）
  | { t: 'duel'; payload: unknown }
  // 系统公告
  | { t: 'toast'; msg: string }
  // host 告知某 peer："你不能留在本房间"，client 应退回大厅
  | { t: 'kick'; reason: string };

// -------------------- Client → Relay --------------------
export type ClientMsg =
  | { t: 'create'; name: string }
  | { t: 'join'; room: string; name: string }
  // 掉线后带 token 接回原 peerId / 原座位
  | { t: 'resume'; sessionToken: string }
  | { t: 'leave' }
  | { t: 'intent'; action: GameAction }
  | { t: 'hostEvent'; target?: string; payload: HostEvent } // 仅 host 发
  | { t: 'heartbeat' };

// -------------------- Relay → Client --------------------
export type ServerMsg =
  | {
      t: 'welcome';
      yourId: string;
      /** 用于断线重连的会话凭证，客户端存 sessionStorage */
      sessionToken: string;
      isHost: boolean;
      room: string;
      players: PeerInfo[];
    }
  // resume 成功：server 重新确认身份，客户端 flush 操作队列
  | {
      t: 'welcomeResume';
      yourId: string;
      isHost: boolean;
      room: string;
      players: PeerInfo[];
    }
  | { t: 'peerJoined'; peer: PeerInfo }
  // 某 peer 掉线进入宽限期（尚未真正 cleanup，可能很快 resume 回来）
  | { t: 'peerDisconnected'; peerId: string }
  // 某 peer 在宽限期内成功 resume，恢复在线状态
  | { t: 'peerResumed'; peerId: string }
  | { t: 'peerLeft'; peerId: string; newHostId?: string | null }
  | { t: 'promoted' }               // 你被升为 host
  | { t: 'intent'; from: string; action: GameAction } // 仅 host 收
  | { t: 'hostEvent'; payload: HostEvent }            // 其他成员收
  | { t: 'heartbeatAck' }
  | { t: 'error'; code: string; msg: string };
