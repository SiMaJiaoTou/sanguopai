import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Text, Cylinder, Plane } from '@react-three/drei';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import type { Card, EvaluateResult, Faction } from '../types';
import { POWER_CAP } from '../evaluate';

interface Props {
  teamIndex: number;
  cards: (Card | null)[];
  evalResult: EvaluateResult | null;
  canRedraw: boolean;
  onRedraw: (id: string) => void;
}

/** 阵营配色（旗帜色为主） */
const FACTION_MAT: Record<
  Faction,
  {
    flag: string;       // 旗面主色
    flagLight: string;
    flagDark: string;
    trim: string;       // 旗面金边
    badge: string;      // 武将徽章底
    badgeAccent: string;
    pole: string;       // 旗杆
  }
> = {
  魏: {
    flag: '#1e3a8a',
    flagLight: '#3b82f6',
    flagDark: '#0a1f4d',
    trim: '#d4af37',
    badge: '#1e3a5f',
    badgeAccent: '#3b82f6',
    pole: '#8b6914',
  },
  蜀: {
    flag: '#b91c1c',
    flagLight: '#ef4444',
    flagDark: '#5a0f0f',
    trim: '#fbbf24',
    badge: '#7a1f1f',
    badgeAccent: '#fca5a5',
    pole: '#8b6914',
  },
  吴: {
    flag: '#047857',
    flagLight: '#10b981',
    flagDark: '#022c22',
    trim: '#fbbf24',
    badge: '#0f3826',
    badgeAccent: '#6ee7b7',
    pole: '#8b6914',
  },
  群: {
    flag: '#92400e',
    flagLight: '#d97706',
    flagDark: '#3a1a05',
    trim: '#fbbf24',
    badge: '#3d3a2a',
    badgeAccent: '#fcd34d',
    pole: '#8b6914',
  },
};

// 5 槽位布局：参考图的 2×3 形式（后排 2 + 前排 3）
// 世界坐标：Z 向屏幕里 = 负，越大越远
const SLOT_LAYOUT: { x: number; z: number }[] = [
  { x: -1.4, z: -0.9 }, // 0 后排左
  { x: 1.4, z: -0.9 },  // 1 后排右
  { x: -2.2, z: 0.9 },  // 2 前排左
  { x: 0, z: 0.9 },     // 3 前排中
  { x: 2.2, z: 0.9 },   // 4 前排右
];

// 牌位尺寸
const TILE_W = 1.8;
const TILE_H = 1.3;

// ======================================================================
// 单面大旗（= 一个武将）
// ======================================================================

function WarFlag({
  faction,
  seed,
  highlight,
}: {
  faction: Faction;
  seed: number;
  highlight: boolean;
}) {
  const m = FACTION_MAT[faction];
  const flagRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const glyphRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (flagRef.current) {
      // 旗帜飘动（波浪变形需要 shader，这里用旋转模拟）
      flagRef.current.rotation.y = Math.sin(t * 1.5 + seed) * 0.35;
      flagRef.current.rotation.z = Math.sin(t * 2.2 + seed * 0.7) * 0.08;
    }
    if (glyphRef.current) {
      // 旗字跟随旗面旋转
      glyphRef.current.rotation.y = Math.sin(t * 1.5 + seed) * 0.35;
    }
    if (groupRef.current && highlight) {
      groupRef.current.position.y = Math.sin(t * 2) * 0.03;
    }
  });

  const poleH = 1.9;
  const flagW = 0.95;
  const flagH = 0.6;

  return (
    <group ref={groupRef}>
      {/* 旗座 */}
      <Cylinder args={[0.12, 0.15, 0.1, 12]} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#3a2418" roughness={0.8} />
      </Cylinder>
      <Cylinder args={[0.13, 0.13, 0.02, 12]} position={[0, 0.11, 0]}>
        <meshStandardMaterial color={m.trim} metalness={0.9} roughness={0.25} />
      </Cylinder>

      {/* 旗杆 */}
      <Cylinder args={[0.025, 0.025, poleH, 8]} position={[0, poleH / 2 + 0.1, 0]}>
        <meshStandardMaterial color={m.pole} metalness={0.4} roughness={0.55} />
      </Cylinder>

      {/* 旗杆顶装饰（金枪尖） */}
      <mesh position={[0, poleH + 0.15, 0]}>
        <coneGeometry args={[0.05, 0.18, 8]} />
        <meshStandardMaterial
          color={m.trim}
          metalness={0.95}
          roughness={0.15}
          emissive={m.trim}
          emissiveIntensity={highlight ? 0.4 : 0.15}
        />
      </mesh>

      {/* 旗面（transform origin 在左边贴旗杆） */}
      <group position={[0.025, poleH - flagH / 2, 0]}>
        <mesh ref={flagRef} position={[flagW / 2, 0, 0]}>
          <planeGeometry args={[flagW, flagH, 8, 4]} />
          <meshStandardMaterial
            color={m.flag}
            side={THREE.DoubleSide}
            roughness={0.55}
            metalness={0.05}
            emissive={m.flagDark}
            emissiveIntensity={highlight ? 0.35 : 0.15}
          />
        </mesh>
        {/* 旗面金边（正面 / 背面双层） */}
        <mesh position={[flagW / 2, 0, 0.001]}>
          <planeGeometry args={[flagW * 0.94, flagH * 0.9]} />
          <meshBasicMaterial color={m.trim} transparent opacity={0.25} side={THREE.DoubleSide} />
        </mesh>
        {/* 阵营字 - 立体字 */}
        <group ref={glyphRef} position={[flagW / 2, 0, 0.01]}>
          <Text
            fontSize={0.38}
            color={m.trim}
            anchorX="center"
            anchorY="middle"
            outlineColor={m.flagDark}
            outlineWidth={0.02}
            fontWeight="bold"
          >
            {faction}
          </Text>
          {/* 背面字（翻转） */}
          <Text
            position={[0, 0, -0.02]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.38}
            color={m.trim}
            anchorX="center"
            anchorY="middle"
            outlineColor={m.flagDark}
            outlineWidth={0.02}
            fontWeight="bold"
          >
            {faction}
          </Text>
        </group>
      </group>

      {/* 旗下彩带装饰（飘在旗杆中部） */}
      <mesh position={[0, poleH * 0.4, 0]} rotation={[0, 0, Math.PI / 16]}>
        <planeGeometry args={[0.12, 0.3]} />
        <meshStandardMaterial color={m.flagLight} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
}

// ======================================================================
// 武将圆徽章（左前角小立牌）
// ======================================================================

function CommanderMark({ faction, name }: { faction: Faction; name: string }) {
  const m = FACTION_MAT[faction];

  return (
    <group>
      {/* 圆章底盘（平躺在地） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.32, 32]} />
        <meshStandardMaterial color={m.trim} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.28, 32]} />
        <meshStandardMaterial color={m.badge} roughness={0.5} />
      </mesh>

      {/* 武将立体头像（立起来的竖牌） */}
      <group position={[0, 0.02, -0.05]} rotation={[-Math.PI / 5, 0, 0]}>
        {/* 竖牌底板 */}
        <mesh>
          <planeGeometry args={[0.45, 0.55]} />
          <meshStandardMaterial color={m.badge} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* 金边 */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[0.47, 0.57]} />
          <meshBasicMaterial color={m.trim} transparent opacity={0.5} />
        </mesh>
        {/* 简化人像 */}
        <mesh position={[0, 0.08, 0.002]}>
          <circleGeometry args={[0.12, 20]} />
          <meshBasicMaterial color="#d4a574" />
        </mesh>
        {/* 帽子 */}
        <mesh position={[0, 0.2, 0.003]}>
          <planeGeometry args={[0.26, 0.08]} />
          <meshBasicMaterial color={m.flagDark} />
        </mesh>
        {/* 肩 */}
        <mesh position={[0, -0.08, 0.002]}>
          <planeGeometry args={[0.28, 0.18]} />
          <meshBasicMaterial color={m.flag} />
        </mesh>

        {/* 名字条 */}
        <mesh position={[0, -0.24, 0.002]}>
          <planeGeometry args={[0.42, 0.1]} />
          <meshBasicMaterial color={m.flagDark} />
        </mesh>
        <Text
          position={[0, -0.24, 0.006]}
          fontSize={0.07}
          color="#fef3c7"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          {name.length > 3 ? name.slice(0, 3) : name}
        </Text>
      </group>
    </group>
  );
}

// ======================================================================
// 梯形牌位（平躺在地面上）
// ======================================================================

function SlotTile({
  slotIndex,
  position,
  empty,
  isOver,
  highlight,
}: {
  slotIndex: number;
  position: { x: number; z: number };
  empty: boolean;
  isOver: boolean;
  highlight: boolean;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const nearW = TILE_W / 2;
    const farW = TILE_W / 2 * 0.8;
    const halfH = TILE_H / 2;
    s.moveTo(-nearW, halfH);
    s.lineTo(nearW, halfH);
    s.lineTo(farW, -halfH);
    s.lineTo(-farW, -halfH);
    s.closePath();
    return s;
  }, []);

  const borderColor = isOver ? '#fef3c7' : highlight ? '#fbbf24' : '#8b6914';

  return (
    <group position={[position.x, 0.002, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* 内部透明底 */}
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={isOver ? '#fef3c7' : empty ? '#c9b995' : '#e8dcc0'}
          transparent
          opacity={isOver ? 0.35 : empty ? 0.1 : 0.18}
          roughness={0.95}
        />
      </mesh>
      {/* 金色描边 */}
      <lineSegments>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={borderColor} />
      </lineSegments>
      {/* 内层细边 */}
      <lineSegments scale={[0.92, 0.88, 1]} position={[0, 0, 0.001]}>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={borderColor} transparent opacity={0.5} />
      </lineSegments>

      {empty && (
        <Text
          position={[0, 0, 0.005]}
          fontSize={0.14}
          color={isOver ? '#fef3c7' : '#8b6914'}
          anchorX="center"
          anchorY="middle"
          fontStyle="italic"
        >
          {isOver ? `降 · ${slotIndex + 1}` : `空位 · ${slotIndex + 1}`}
        </Text>
      )}
    </group>
  );
}

// ======================================================================
// 水墨地图地面
// ======================================================================

function MapGround() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 640;
    const ctx = c.getContext('2d')!;

    // 雪地米黄底
    const grad = ctx.createRadialGradient(512, 320, 100, 512, 320, 700);
    grad.addColorStop(0, '#f2e6cb');
    grad.addColorStop(0.5, '#ddc89a');
    grad.addColorStop(1, '#a89070');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 640);

    // 水墨河流（柔和灰蓝）
    ctx.strokeStyle = 'rgba(100, 110, 110, 0.28)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const y0 = 100 + i * 150;
      ctx.moveTo(-20, y0);
      for (let x = 0; x <= 1040; x += 60) {
        const y = y0 + Math.sin(x * 0.008 + i * 1.3) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 河流深色描边
    ctx.strokeStyle = 'rgba(80, 90, 100, 0.22)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const y0 = 100 + i * 150;
      ctx.moveTo(-20, y0);
      for (let x = 0; x <= 1040; x += 60) {
        const y = y0 + Math.sin(x * 0.008 + i * 1.3) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 远山轮廓（雪山）
    ctx.fillStyle = 'rgba(140, 140, 140, 0.35)';
    for (let i = 0; i < 10; i++) {
      const cx = i * 110 + 50;
      const cy = 50 + (i % 4) * 12;
      ctx.beginPath();
      ctx.moveTo(cx - 60, cy + 40);
      ctx.lineTo(cx - 20, cy);
      ctx.lineTo(cx, cy + 15);
      ctx.lineTo(cx + 30, cy - 5);
      ctx.lineTo(cx + 60, cy + 20);
      ctx.lineTo(cx + 90, cy + 40);
      ctx.closePath();
      ctx.fill();
    }
    // 雪山顶白雪
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 10; i++) {
      const cx = i * 110 + 50;
      const cy = 50 + (i % 4) * 12;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy);
      ctx.lineTo(cx - 5, cy + 8);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.lineTo(cx + 30, cy - 5);
      ctx.lineTo(cx + 15, cy - 3);
      ctx.closePath();
      ctx.fill();
    }

    // 城郭（右上角，参考图有）
    ctx.fillStyle = 'rgba(70, 60, 50, 0.4)';
    ctx.fillRect(900, 40, 80, 40);
    ctx.fillRect(920, 20, 40, 20);
    ctx.fillRect(940, 60, 20, 30);

    // 墨点散点
    ctx.fillStyle = 'rgba(60, 50, 40, 0.18)';
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 640;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 2 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <Plane args={[20, 12]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <meshStandardMaterial map={texture} roughness={0.98} />
    </Plane>
  );
}

// ======================================================================
// 3D 场景
// ======================================================================

function Scene({
  cards,
  hovered,
  highlight,
}: {
  cards: (Card | null)[];
  hovered: number | null;
  highlight: boolean;
}) {
  const { camera } = useThree();

  useEffect(() => {
    // 斜俯视（参考图视角）
    camera.position.set(0, 5.5, 3.8);
    camera.lookAt(0, 0, 0.2);
  }, [camera]);

  return (
    <>
      {/* 灯光（整体明亮） */}
      <ambientLight intensity={1.0} color="#fff5e0" />
      <directionalLight position={[4, 8, 4]} intensity={0.6} color="#fff2cc" castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.25} color="#e8dcc0" />

      {/* 水墨地图 */}
      <MapGround />

      {/* 5 个梯形槽位 */}
      {SLOT_LAYOUT.map((pos, i) => (
        <SlotTile
          key={i}
          slotIndex={i}
          position={pos}
          empty={!cards[i]}
          isOver={hovered === i}
          highlight={highlight}
        />
      ))}

      {/* 旗子（武将）—— 立在格子中心 */}
      {cards.map((c, i) =>
        c ? (
          <group key={c.id} position={[SLOT_LAYOUT[i].x, 0, SLOT_LAYOUT[i].z - 0.1]}>
            <WarFlag faction={c.faction} seed={i * 1.7} highlight={highlight} />
          </group>
        ) : null,
      )}

      {/* 武将徽章（左前角） */}
      {cards.map((c, i) =>
        c ? (
          <group
            key={`m-${c.id}`}
            position={[SLOT_LAYOUT[i].x - TILE_W * 0.4, 0, SLOT_LAYOUT[i].z + TILE_H * 0.45]}
          >
            <CommanderMark faction={c.faction} name={c.name} />
          </group>
        ) : null,
      )}

      {/* 战力数字（右前角） */}
      {cards.map((c, i) =>
        c ? (
          <group
            key={`p-${c.id}`}
            position={[SLOT_LAYOUT[i].x + TILE_W * 0.35, 0.01, SLOT_LAYOUT[i].z + TILE_H * 0.5]}
            rotation={[-Math.PI / 2.5, 0, 0]}
          >
            <mesh>
              <planeGeometry args={[0.4, 0.2]} />
              <meshStandardMaterial color="#1a0f08" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.42, 0.22]} />
              <meshBasicMaterial color="#d4af37" transparent opacity={0.35} />
            </mesh>
            <Text
              position={[0, 0, 0.005]}
              fontSize={0.13}
              color="#fde68a"
              anchorX="center"
              anchorY="middle"
              outlineColor="#000"
              outlineWidth={0.005}
            >
              {c.pointValue}
            </Text>
          </group>
        ) : null,
      )}
    </>
  );
}

// ======================================================================
// 主组件（Canvas + 交互叠层）
// ======================================================================

export function BattleField3D({
  teamIndex,
  cards,
  evalResult,
  canRedraw: _canRedraw,
  onRedraw: _onRedraw,
}: Props) {
  const full = cards.every((c) => c !== null);
  const highlight = !!evalResult && (evalResult.rankType.score >= 6 || evalResult.isFlush);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <motion.div
      layout
      className={[
        'relative rounded-lg wood-panel bronze-border rivets min-w-0',
        'wood-dark',
      ].join(' ')}
      style={
        highlight
          ? {
              boxShadow:
                '0 0 24px rgba(212,175,55,0.5), 0 12px 24px rgba(0,0,0,0.9), inset 0 2px 3px rgba(255,200,120,0.25)',
            }
          : undefined
      }
    >
      <div className="rivet-b" />

      {/* 头部 */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap ink-underline">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-red-500 text-base">㊉</span>
          <div className="text-gold-grad font-black text-base sm:text-lg tracking-[0.25em] font-kai">
            {teamIndex === 0 ? '前軍' : '後軍'}
          </div>
          {full && evalResult ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <motion.span
                key={evalResult.rankType.key}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260 }}
                className={[
                  'px-3 py-1 rounded text-sm font-black border-2 font-kai tracking-widest',
                  highlight ? 'border-gold text-[#2a1808]' : 'border-amber-700 text-amber-50',
                ].join(' ')}
                style={{
                  background: highlight
                    ? 'linear-gradient(180deg, #fde68a 0%, #d4af37 50%, #8b6914 100%)'
                    : 'linear-gradient(180deg, #5a3a24 0%, #3a2418 100%)',
                  boxShadow: highlight
                    ? 'inset 0 1px 0 rgba(255,245,200,0.5), 0 2px 4px rgba(0,0,0,0.7)'
                    : 'inset 0 1px 0 rgba(255,200,120,0.3), 0 2px 4px rgba(0,0,0,0.6)',
                }}
              >
                {evalResult.rankType.name}
              </motion.span>
              {evalResult.isFlush && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-2 py-1 rounded text-sm font-black text-white border-2 border-red-300 font-kai tracking-widest"
                  style={{
                    background: 'linear-gradient(180deg, #c82828 0%, #7a1f1f 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,180,160,0.5), 0 2px 4px rgba(0,0,0,0.7)',
                  }}
                >
                  ◆ 同花
                </motion.span>
              )}
            </div>
          ) : (
            <span className="text-xs text-amber-100/50 italic">· 配陣中 ·</span>
          )}
        </div>

        <div className="text-right">
          <div className="text-[10px] text-amber-200/60 tracking-widest font-kai">軍團戰力</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={evalResult?.power ?? 0}
              initial={{ y: -6, opacity: 0, scale: 1.4 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 6, opacity: 0 }}
              className={[
                'text-3xl sm:text-4xl font-black tabular-nums font-kai leading-none',
                highlight ? 'text-gold-grad animate-shine' : 'text-amber-100',
              ].join(' ')}
            >
              {full && evalResult ? evalResult.power : 0}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 算法拆解 */}
      {full && evalResult && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 px-3 py-2 rounded-lg text-sm leading-tight"
          style={{
            background: 'linear-gradient(90deg, #1a0f08 0%, #2a1810 50%, #1a0f08 100%)',
            border: '2px solid #5a3a24',
            boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.6)',
          }}
        >
          <div className="flex items-center justify-center gap-2 font-kai font-black flex-wrap text-lg sm:text-xl">
            <span className="text-emerald-300 tabular-nums">{evalResult.pointSum}</span>
            <span className="text-amber-200/50 text-base">×</span>
            <span className="text-amber-200/50 text-base">(</span>
            <span className="text-emerald-300 tabular-nums">{evalResult.rankType.score}</span>
            <span className="text-amber-200/50 text-base">+</span>
            <span className={['tabular-nums', evalResult.isFlush ? 'text-gold-grad' : 'text-amber-200/40'].join(' ')}>
              {evalResult.suitBonus}
            </span>
            <span className="text-amber-200/50 text-base">)</span>
            <span className="text-amber-200/50 text-base">=</span>
            <span className={['tabular-nums', evalResult.capped ? 'text-red-400 line-through' : 'text-gold-grad'].join(' ')}>
              {evalResult.rawPower}
            </span>
            {evalResult.capped && (
              <>
                <span className="text-amber-200/50 text-base">→</span>
                <span className="text-red-400 tabular-nums">{POWER_CAP}</span>
                <span className="text-[10px] text-red-300 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-400/60 font-bold tracking-widest">
                  封頂
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Canvas + 交互层 */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 10', minHeight: 280 }}>
        <div className="absolute inset-0 rounded-md overflow-hidden">
          <Canvas
            dpr={[1, 2]}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            style={{ background: 'transparent' }}
          >
            <OrthographicCamera
              makeDefault
              position={[0, 5.5, 3.8]}
              zoom={100}
              near={0.1}
              far={100}
            />
            <Scene cards={cards} hovered={hovered} highlight={highlight} />
          </Canvas>
        </div>

        {/* 2×3 交互层：按参考图网格布局 */}
        <SlotOverlayGrid
          teamIndex={teamIndex}
          cards={cards}
          onHoverChange={setHovered}
        />
      </div>
    </motion.div>
  );
}

// ======================================================================
// 交互层（HTML 2x3 网格，映射到 3D 槽位）
// ======================================================================

function SlotOverlayGrid({
  teamIndex,
  cards,
  onHoverChange,
}: {
  teamIndex: number;
  cards: (Card | null)[];
  onHoverChange: (idx: number | null) => void;
}) {
  // 管理 hover 状态：记录哪些格子被悬停，取最新一个
  const handleHover = (hover: boolean, idx: number) => {
    if (hover) onHoverChange(idx);
    else onHoverChange(null);
  };

  return (
    <div
      className="absolute inset-0 grid gap-1 p-4 pointer-events-none"
      style={{
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: '1fr 1fr',
      }}
    >
      <SlotCell teamIndex={teamIndex} slotIndex={0} card={cards[0]} onHoverChange={handleHover} style={{ gridColumn: '1 / 3', gridRow: '1 / 2' }} />
      <SlotCell teamIndex={teamIndex} slotIndex={1} card={cards[1]} onHoverChange={handleHover} style={{ gridColumn: '3 / 5', gridRow: '1 / 2' }} />
      <SlotCell teamIndex={teamIndex} slotIndex={2} card={cards[2]} onHoverChange={handleHover} style={{ gridColumn: '1 / 2', gridRow: '2 / 3' }} />
      <SlotCell teamIndex={teamIndex} slotIndex={3} card={cards[3]} onHoverChange={handleHover} style={{ gridColumn: '2 / 4', gridRow: '2 / 3' }} />
      <SlotCell teamIndex={teamIndex} slotIndex={4} card={cards[4]} onHoverChange={handleHover} style={{ gridColumn: '4 / 5', gridRow: '2 / 3' }} />
    </div>
  );
}

function SlotCell({
  teamIndex,
  slotIndex,
  card,
  onHoverChange,
  style,
}: {
  teamIndex: number;
  slotIndex: number;
  card: Card | null;
  onHoverChange: (hover: boolean, idx: number) => void;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${teamIndex}-${slotIndex}`,
    data: { type: 'team', teamIndex, slotIndex },
  });

  useEffect(() => {
    onHoverChange(isOver, slotIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOver]);

  return (
    <div
      ref={setNodeRef}
      className="relative pointer-events-auto"
      style={style}
    >
      {card && <DraggableOverlay card={card} />}
    </div>
  );
}

function DraggableOverlay({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    touchAction: 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 50,
        }
      : {}),
  };

  return <div ref={setNodeRef} style={style} {...listeners} {...attributes} />;
}
