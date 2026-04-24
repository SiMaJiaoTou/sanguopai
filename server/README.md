# SanguoPoker Relay Server

Host-authoritative WebSocket 中继，不含业务逻辑，只负责房间管理与消息转发。

## 启动

```bash
cd server
npm install
npm run dev          # 监听 ws://localhost:8787
```

环境变量 `PORT` 可覆盖端口。

## 协议

见 `server.js` 顶部注释，与前端 `src/net/protocol.ts` 保持同步。

## 部署

最小版本：一台 2C1G 的小 VPS + pm2，或直接 `fly launch` 到 Fly.io shared-cpu 免费档。

## 房间限制

- 每个房间最多 8 人
- 30 秒无心跳自动踢出
- Host 断线时由"最早进房者"接任
- 6 位房间码（字母数字，已排除易混字符）
