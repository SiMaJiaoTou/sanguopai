# 三国：将星牌局 (Sanguo Poker)

轻量级、卡牌构筑、类德州扑克 Roguelite 单机网页游戏。

## 技术栈

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** —— 深色国风主题
- **@dnd-kit/core** —— 拖拽交互
- **framer-motion** —— 发牌/翻牌/战力数字动画
- **zustand** —— 轻量状态管理

## 开发与运行

### 单机

```bash
cd D:\SanguoPoker
npm install
npm run dev
```

浏览器会自动打开 http://localhost:5173，主菜单选【单机征伐】即可。

### 联机（8 人 Host-Authoritative）

启动 WebSocket 中继（仅做消息转发，不含业务逻辑）：

```bash
cd server
npm install
npm run dev          # 监听 ws://localhost:8787
```

前端不需改任何配置，默认会连 `ws://localhost:8787`。线上部署时可在客户端"自定中继地址"里填 `wss://你的域名/ws`，或在构建时注入 `VITE_RELAY_URL` 环境变量。

玩法：
- 主菜单选【创建房间】→ 输入名号 → 得到 6 位符印
- 其它玩家选【加入房间】→ 输入符印 + 名号
- 房间最多 8 人；房主点【擂鼓出征】同步开局
- 房主断线时由最早进房者自动接任

## 项目结构

```
src/
├── main.tsx              入口
├── App.tsx               主页面组装 + DnD 编排
├── index.css             Tailwind + 全局样式
├── types.ts              Card / HandType / RoundConfig 类型定义
├── data.ts               156 武将名单 + Deck 生成 + 洗牌 + 回合表 + 阵营主题
├── evaluate.ts           evaluateHand 牌型判定（14 种）
├── store.ts              zustand 游戏状态机
└── components/
    ├── CardView.tsx      单张卡牌（可拖拽、右上角换牌按钮）
    ├── TeamSlot.tsx      单个出战槽位（可放置）
    ├── TeamPanel.tsx     队伍面板（5 槽 + 实时牌型 + 战力）
    ├── HandArea.tsx      手牌区（可放置）
    ├── TopBar.tsx        顶部状态栏
    └── GameOverModal.tsx 终局结算弹窗
```

## 核心规则要点

- 156 张牌 = 4 阵营 × 13 点数 × 3 位武将；点数 `3~10=3~10, J=11, Q=12, K=13, A=14, 2=15`
- 单队战力 = **(5 张牌 pointValue 之和) × 牌型倍率**
- 14 种牌型按 PRD 优先级严格判定（五条 20× 最高 → 散牌 1× 最低）
- 6 回合推进，每回合抽牌 + 增加 2 次换将令；换牌次数跨回合继承
- 换牌：把选中卡 push 回 deck → 洗牌 → 从顶部 pop 新牌放回原位

## 交互

- **拖拽**：手牌 ↔ 出战槽 自由互换；拖到已占槽位会触发交换/挤回
- **一键布阵**：把手牌顺序填入空槽，快速配队
- **换将令**：点击卡牌右上角 `⟳`，消耗 1 次换牌次数替换该卡
- **结束休战**：仅当必须填满的队伍全部满员时可点击

## 终局评级

- ≥ 1200：一统天下
- ≥ 800：问鼎中原
- ≥ 500：割据一方
- 其它：草莽英雄
