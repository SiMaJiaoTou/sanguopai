import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLobbyStore } from '../net/lobbyStore';
import type { ConnectionStatus } from '../net/Network';

/**
 * 主菜单 · 创建房间 · 加入房间 · 房间待命
 * 全部使用三国水墨 / 羊皮纸风格，和主游戏视觉统一
 */
export function LobbyScreens({
  onEnterSinglePlayer,
  onEnterGame,
}: {
  /** 单机开战 */
  onEnterSinglePlayer: () => void;
  /** host 点击"启程" 进入游戏 */
  onEnterGame: () => void;
}) {
  const screen = useLobbyStore((s) => s.screen);

  return (
    <div className="fixed inset-0 z-[60] bg-scroll overflow-y-auto">
      <AnimatePresence mode="wait">
        {screen === 'main' && (
          <motion.div key="main" {...fade}>
            <MainMenu onEnterSinglePlayer={onEnterSinglePlayer} />
          </motion.div>
        )}
        {screen === 'create' && (
          <motion.div key="create" {...fade}>
            <CreateRoom />
          </motion.div>
        )}
        {screen === 'join' && (
          <motion.div key="join" {...fade}>
            <JoinRoom />
          </motion.div>
        )}
        {screen === 'room' && (
          <motion.div key="room" {...fade}>
            <LobbyRoom onEnterGame={onEnterGame} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28 },
};

// ======================================================================
// 主菜单
// ======================================================================
function MainMenu({
  onEnterSinglePlayer,
}: {
  onEnterSinglePlayer: () => void;
}) {
  const setScreen = useLobbyStore((s) => s.setScreen);

  return (
    <ScrollFrame>
      <TitleBlock
        title="三 國 爭 雄"
        subtitle="群雄并起 · 逐鹿天下"
      />

      <div className="mt-10 space-y-4 max-w-[420px] mx-auto">
        <MenuButton
          icon="⚔"
          title="单 机 征 伐"
          subtitle="与七雄 AI 共逐中原"
          onClick={onEnterSinglePlayer}
          primary
        />
        <MenuButton
          icon="旗"
          title="创 建 房 间"
          subtitle="竖起旗号，等待盟友来投"
          onClick={() => setScreen('create')}
        />
        <MenuButton
          icon="投"
          title="加 入 房 间"
          subtitle="持密信访友，入盟参战"
          onClick={() => setScreen('join')}
        />
      </div>

      <Footer />
    </ScrollFrame>
  );
}

function MenuButton({
  icon,
  title,
  subtitle,
  onClick,
  primary,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.015 }}
      whileTap={{ y: 2, scale: 0.99 }}
      onClick={onClick}
      className="relative w-full text-left p-5 rounded-md font-kai flex items-center gap-5 overflow-hidden"
      style={{
        background: primary
          ? 'linear-gradient(180deg, rgba(255,245,205,0.96) 0%, rgba(215,175,105,0.92) 100%)'
          : 'linear-gradient(180deg, rgba(240,220,180,0.88) 0%, rgba(200,170,120,0.84) 100%)',
        border: `2px solid ${primary ? '#8b6914' : '#7a5a2c'}`,
        boxShadow: primary
          ? '0 0 14px rgba(255,220,120,0.6), inset 0 1px 0 rgba(255,255,230,0.75), inset 0 -2px 4px rgba(80,50,10,0.35), 0 4px 12px rgba(0,0,0,0.5)'
          : 'inset 0 1px 0 rgba(255,240,200,0.6), inset 0 -2px 4px rgba(80,50,20,0.3), 0 3px 8px rgba(0,0,0,0.45)',
      }}
    >
      <div
        className="flex items-center justify-center rounded-full font-kai font-black"
        style={{
          width: 52,
          height: 52,
          fontSize: 22,
          color: '#fef3c7',
          letterSpacing: 0,
          background: primary
            ? 'radial-gradient(circle at 30% 25%, #7a1818 0%, #3a0404 100%)'
            : 'radial-gradient(circle at 30% 25%, #3a2418 0%, #1a0f08 100%)',
          border: `2px solid ${primary ? '#d4af37' : '#8b6914'}`,
          boxShadow:
            '0 2px 6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,240,200,0.35)',
          textShadow: '0 1px 2px rgba(0,0,0,0.9)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-lg font-black tracking-[0.3em] leading-none"
          style={{
            background: 'linear-gradient(180deg, #7a1818 0%, #3a0404 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {title}
        </div>
        <div className="text-[11px] text-red-900/65 italic tracking-widest mt-1">
          {subtitle}
        </div>
      </div>
      <div className="text-red-900/45 text-2xl font-kai">›</div>
    </motion.button>
  );
}

// ======================================================================
// 创建房间
// ======================================================================
function CreateRoom() {
  const {
    nickname,
    setNickname,
    createRoom,
    setScreen,
    connectionStatus,
    lastError,
  } = useLobbyStore((s) => ({
    nickname: s.nickname,
    setNickname: s.setNickname,
    createRoom: s.createRoom,
    setScreen: s.setScreen,
    connectionStatus: s.connectionStatus,
    lastError: s.lastError,
  }));

  const [local, setLocal] = useState(nickname);
  const isConnecting =
    connectionStatus === 'connecting' || connectionStatus === 'reconnecting';

  const submit = () => {
    const n = local.trim();
    if (!n) return;
    setNickname(n);
    createRoom();
  };

  return (
    <ScrollFrame>
      <BackButton onClick={() => setScreen('main')} />
      <TitleBlock title="竖 立 大 旗" subtitle="定名号 · 开府邸 · 待贤士" />

      <div className="mt-8 max-w-[420px] mx-auto space-y-6">
        <InputField
          label="主公名号"
          value={local}
          onChange={setLocal}
          placeholder="如：曹孟德 / 刘玄德"
          maxLength={16}
        />

        <RelayUrlField />

        {lastError && <ErrorLine text={lastError} />}
        <StatusLine status={connectionStatus} />

        <motion.button
          whileHover={!isConnecting && local.trim() ? { y: -2 } : undefined}
          whileTap={!isConnecting && local.trim() ? { y: 2 } : undefined}
          onClick={submit}
          disabled={isConnecting || !local.trim()}
          className="btn-seal btn-seal-gold w-full py-4 text-base tracking-[0.4em] relative overflow-hidden"
        >
          <div className="text-[15px] leading-none">
            {isConnecting ? '正 在 开 府…' : '建 立 主 公 府'}
          </div>
          <div className="sweep-sheen" />
        </motion.button>
      </div>

      <Footer />
    </ScrollFrame>
  );
}

// ======================================================================
// 加入房间
// ======================================================================
function JoinRoom() {
  const {
    nickname,
    setNickname,
    joinRoom,
    setScreen,
    connectionStatus,
    lastError,
  } = useLobbyStore((s) => ({
    nickname: s.nickname,
    setNickname: s.setNickname,
    joinRoom: s.joinRoom,
    setScreen: s.setScreen,
    connectionStatus: s.connectionStatus,
    lastError: s.lastError,
  }));

  const [name, setName] = useState(nickname);
  const [code, setCode] = useState('');
  const isConnecting =
    connectionStatus === 'connecting' || connectionStatus === 'reconnecting';

  const submit = () => {
    const n = name.trim();
    const c = code.trim().toUpperCase();
    if (!n || !c) return;
    setNickname(n);
    joinRoom(c);
  };

  return (
    <ScrollFrame>
      <BackButton onClick={() => setScreen('main')} />
      <TitleBlock title="持 符 入 盟" subtitle="持密书 · 访贤府 · 共图大业" />

      <div className="mt-8 max-w-[420px] mx-auto space-y-6">
        <InputField
          label="我的名号"
          value={name}
          onChange={setName}
          placeholder="如：孙仲谋 / 袁本初"
          maxLength={16}
        />
        <InputField
          label="符 印 · 房 间 码"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          placeholder="6 位字母数字"
          maxLength={8}
          monospace
        />

        <RelayUrlField />

        {lastError && <ErrorLine text={lastError} />}
        <StatusLine status={connectionStatus} />

        <motion.button
          whileHover={
            !isConnecting && name.trim() && code.trim()
              ? { y: -2 }
              : undefined
          }
          whileTap={
            !isConnecting && name.trim() && code.trim() ? { y: 2 } : undefined
          }
          onClick={submit}
          disabled={isConnecting || !name.trim() || !code.trim()}
          className="btn-seal btn-seal-gold w-full py-4 text-base tracking-[0.4em] relative overflow-hidden"
        >
          <div className="text-[15px] leading-none">
            {isConnecting ? '正 在 入 盟…' : '入 盟 参 战'}
          </div>
          <div className="sweep-sheen" />
        </motion.button>
      </div>

      <Footer />
    </ScrollFrame>
  );
}

// ======================================================================
// 房间待命大厅
// ======================================================================
function LobbyRoom({ onEnterGame }: { onEnterGame: () => void }) {
  const {
    roomCode,
    peers,
    myPeerId,
    isHost,
    connectionStatus,
    leaveRoom,
  } = useLobbyStore((s) => ({
    roomCode: s.roomCode,
    peers: s.peers,
    myPeerId: s.myPeerId,
    isHost: s.isHost,
    connectionStatus: s.connectionStatus,
    leaveRoom: s.leaveRoom,
  }));

  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // 填充到 8 格
  const slots = Array.from({ length: 8 }, (_, i) => peers[i] ?? null);
  const canStart = isHost && peers.length >= 1;

  return (
    <ScrollFrame>
      <TitleBlock title="主 公 府 议 事" subtitle="群雄已至，共议征伐" />

      {/* 房间码 */}
      <div className="mt-6 max-w-[520px] mx-auto">
        <div
          className="flex items-center justify-between p-4 rounded-md relative"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,245,205,0.92) 0%, rgba(215,175,105,0.88) 100%)',
            border: '2px solid #8b6914',
            boxShadow:
              '0 0 14px rgba(255,220,120,0.45), inset 0 1px 0 rgba(255,255,230,0.7), 0 3px 8px rgba(0,0,0,0.45)',
          }}
        >
          <div>
            <div className="text-[10px] text-red-900/65 tracking-[0.45em] font-kai font-black">
              符 印
            </div>
            <div
              className="text-3xl font-black tabular-nums mt-1 font-kai"
              style={{
                letterSpacing: '0.3em',
                background: 'linear-gradient(180deg, #7a1818 0%, #3a0404 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {roomCode ?? '——'}
            </div>
          </div>
          <button
            onClick={copy}
            className="btn-seal text-[12px] px-4 py-2 tracking-[0.25em]"
          >
            {copied ? '已 拓 下' : '拓 印'}
          </button>
        </div>
      </div>

      {/* 成员列表：8 格卡位 */}
      <div className="mt-6 max-w-[680px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
        {slots.map((peer, idx) => (
          <SeatCard
            key={peer?.id ?? `empty-${idx}`}
            peer={peer}
            seatNo={idx + 1}
            isSelf={peer?.id === myPeerId}
          />
        ))}
      </div>

      {/* 连接状态 */}
      <div className="mt-6 max-w-[520px] mx-auto">
        <StatusLine status={connectionStatus} />
      </div>

      {/* 操作 */}
      <div className="mt-6 max-w-[520px] mx-auto flex items-center gap-3 flex-wrap">
        <button onClick={leaveRoom} className="btn-wood text-xs px-4 py-2.5">
          撤 旗 离 盟
        </button>
        <div className="flex-1" />
        {isHost ? (
          <motion.button
            whileHover={canStart ? { y: -2 } : undefined}
            whileTap={canStart ? { y: 2 } : undefined}
            onClick={onEnterGame}
            disabled={!canStart}
            className="btn-seal btn-seal-gold px-10 py-3 text-base tracking-[0.35em] relative overflow-hidden"
          >
            <div className="text-[15px] leading-none">擂 鼓 出 征</div>
            <div className="sweep-sheen" />
          </motion.button>
        ) : (
          <div
            className="text-[11.5px] tracking-widest font-kai italic"
            style={{ color: '#6b4a10' }}
          >
            · 等待主公擂鼓发兵 ·
          </div>
        )}
      </div>

      <Footer />
    </ScrollFrame>
  );
}

function SeatCard({
  peer,
  seatNo,
  isSelf,
}: {
  peer: { id: string; name: string; isHost: boolean } | null;
  seatNo: number;
  isSelf: boolean;
}) {
  if (!peer) {
    return (
      <div
        className="p-3 rounded-md text-center font-kai"
        style={{
          background: 'rgba(58,36,24,0.3)',
          border: '1.5px dashed rgba(139,90,40,0.6)',
          minHeight: 86,
        }}
      >
        <div className="text-[10px] text-amber-200/50 tracking-widest">
          · 虚 位 ·
        </div>
        <div className="text-amber-200/35 mt-2 text-xs tabular-nums">
          座 {seatNo}
        </div>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative p-3 rounded-md font-kai"
      style={{
        background:
          'linear-gradient(180deg, rgba(90,58,28,0.85) 0%, rgba(42,26,16,0.95) 100%)',
        border: `2px solid ${peer.isHost ? '#d4af37' : '#8b6914'}`,
        boxShadow: peer.isHost
          ? '0 0 12px rgba(212,175,55,0.7), inset 0 1px 0 rgba(255,240,200,0.4)'
          : 'inset 0 1px 0 rgba(255,200,120,0.25), 0 2px 5px rgba(0,0,0,0.55)',
        minHeight: 86,
      }}
    >
      {peer.isHost && (
        <div
          className="absolute -top-2 -left-2 flex items-center justify-center font-kai font-black rounded-full"
          style={{
            width: 30,
            height: 30,
            fontSize: 12,
            color: '#2a1608',
            background:
              'radial-gradient(circle at 30% 25%, #fff5cc 0%, #d4af37 70%, #6b4a10 100%)',
            border: '2px solid #2a1608',
            boxShadow: '0 0 8px rgba(255,220,120,0.75)',
          }}
        >
          主
        </div>
      )}
      {isSelf && (
        <div
          className="absolute -top-2 -right-2 seal-red flex items-center justify-center font-kai font-black"
          style={{
            padding: '1px 6px',
            fontSize: 10,
            letterSpacing: '0.18em',
            borderRadius: 2,
          }}
        >
          己 方
        </div>
      )}
      <div className="text-[10px] text-amber-200/60 tracking-widest mb-1">
        座 {seatNo}
      </div>
      <div
        className="font-black tracking-widest truncate"
        style={{
          fontSize: 15,
          background: `linear-gradient(180deg, #fff5cc 0%, ${
            peer.isHost ? '#f7d57a' : '#e3d4b8'
          } 60%, #6b4a10 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {peer.name}
      </div>
      <div
        className="text-[10px] italic mt-0.5 tracking-widest"
        style={{ color: peer.isHost ? '#fbbf24' : 'rgba(253,230,138,0.55)' }}
      >
        {peer.isHost ? '主公 · 掌令' : '客卿 · 待命'}
      </div>
    </motion.div>
  );
}

// ======================================================================
// 通用小组件
// ======================================================================
function ScrollFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-[720px]">
        <div className="scroll-axis" />
        <div
          className="relative parchment px-6 sm:px-10 py-8 sm:py-12"
          style={{
            borderLeft: '3px solid #5a3a1c',
            borderRight: '3px solid #5a3a1c',
            boxShadow:
              'inset 0 0 60px rgba(100,60,20,0.25), inset 0 0 120px rgba(70,40,10,0.18)',
          }}
        >
          <div className="ornament-meander mb-2 opacity-60" />
          {children}
          <div className="ornament-meander mt-8 opacity-60" />
        </div>
        <div className="scroll-axis" />
      </div>
    </div>
  );
}

function TitleBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-red-900/60 tracking-[0.8em] font-kai font-black mb-1">
        天 地 人
      </div>
      <div
        className="text-4xl sm:text-5xl font-black font-kai tracking-[0.3em]"
        style={{
          background: 'linear-gradient(180deg, #7a1818 0%, #3a0404 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 0 rgba(120,40,20,0.2)',
        }}
      >
        {title}
      </div>
      <div className="text-[12px] text-red-900/60 italic tracking-[0.2em] font-kai mt-1">
        —— {subtitle} ——
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  monospace,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  monospace?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-red-900/70 tracking-[0.35em] font-kai font-black mb-1.5">
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full px-4 py-3 text-lg font-kai ${
          monospace ? 'tabular-nums tracking-[0.3em]' : 'tracking-widest'
        }`}
        style={{
          background:
            'linear-gradient(180deg, rgba(255,245,205,0.95) 0%, rgba(230,200,150,0.92) 100%)',
          border: '2px solid #7a5a2c',
          borderRadius: 3,
          color: '#3a0404',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,230,0.7), inset 0 -2px 4px rgba(80,50,20,0.3), 0 2px 4px rgba(0,0,0,0.35)',
          outline: 'none',
          fontWeight: 900,
        }}
      />
    </div>
  );
}

function RelayUrlField() {
  const { relayUrl, setRelayUrl } = useLobbyStore((s) => ({
    relayUrl: s.relayUrl,
    setRelayUrl: s.setRelayUrl,
  }));
  const [show, setShow] = useState(false);
  return (
    <div>
      <button
        onClick={() => setShow((v) => !v)}
        className="text-[10px] tracking-[0.25em] text-red-900/55 italic font-kai hover:text-red-900/85 transition-colors"
      >
        {show ? '收 起 中 继 地 址' : '自 定 中 继 地 址'}
      </button>
      {show && (
        <input
          value={relayUrl}
          onChange={(e) => setRelayUrl(e.target.value)}
          placeholder="ws://localhost:8787 或 wss://yourdomain/ws"
          className="mt-2 w-full px-3 py-2 text-xs font-mono"
          style={{
            background: 'rgba(255,245,205,0.9)',
            border: '1.5px solid #7a5a2c',
            borderRadius: 3,
            color: '#3a0404',
            outline: 'none',
          }}
        />
      )}
    </div>
  );
}

function StatusLine({ status }: { status: ConnectionStatus }) {
  const text = (
    {
      idle: '· 未 连 接 ·',
      connecting: '· 正 在 请 缨 ·',
      connected: '· 已 与 中 军 接 壤 ·',
      in_room: '· 已 入 府 邸 ·',
      reconnecting: '· 信 使 断 线 · 重 新 请 缨 中 ·',
      error: '· 中 军 失 联 ·',
    } as Record<ConnectionStatus, string>
  )[status];
  const color = (
    {
      idle: 'rgba(92,38,20,0.45)',
      connecting: '#a8753a',
      connected: '#5a7a28',
      in_room: '#5a7a28',
      reconnecting: '#c8521a',
      error: '#a02020',
    } as Record<ConnectionStatus, string>
  )[status];
  const spinner = status === 'connecting' || status === 'reconnecting';
  return (
    <div
      className="text-[11px] tracking-[0.3em] font-kai italic text-center flex items-center justify-center gap-2"
      style={{ color }}
    >
      {spinner && <Spinner />}
      {text}
    </div>
  );
}

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
      }}
    />
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div
      className="text-[12px] tracking-widest font-kai text-center px-3 py-2 rounded"
      style={{
        background: 'rgba(160,30,30,0.18)',
        border: '1.5px solid #a02020',
        color: '#7a1010',
      }}
    >
      ✖ {text}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute left-6 top-6 text-[12px] tracking-[0.3em] font-kai text-red-900/65 hover:text-red-900 transition-colors"
    >
      ‹ 返 回
    </button>
  );
}

function Footer() {
  return (
    <div className="mt-10 text-center text-[10px] text-red-900/40 italic tracking-widest font-kai">
      · 建安之年 · 群雄逐鹿 ·
    </div>
  );
}

/** 页面卸载前通知 Network 心跳停止（避免切页后残留） */
export function useLobbyLifecycle() {
  useEffect(() => {
    return () => {
      // no-op：Network 自己管理心跳
    };
  }, []);
}
