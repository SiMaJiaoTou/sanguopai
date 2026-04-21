import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, RoundedBox, Text, Cylinder, Cone, Sphere, Box } from '@react-three/drei';
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

/** 阵营 3D 材质配置 */
const FACTION_MAT: Record<
  Faction,
  {
    armor: string;
    armorAccent: string;
    cloth: string;
    tassel: string;      // 缨穗
    flag: string;
    metal: string;
    emissive: string;
    glow: number;
  }
> = {
  魏: {
    armor: '#1e3a5f',
    armorAccent: '#3b82f6',
    cloth: '#1e40af',
    tassel: '#dc2626',
    flag: '#2563eb',
    metal: '#94a3b8',
    emissive: '#1e40af',
    glow: 0.15,
  },
  蜀: {
    armor: '#7a1f1f',
    armorAccent: '#ef4444',
    cloth: '#991b1b',
    tassel: '#fbbf24',
    flag: '#dc2626',
    metal: '#d4af37',
    emissive: '#7a1f1f',
    glow: 0.25,
  },
  吴: {
    armor: '#0f3826',
    armorAccent: '#10b981',
    cloth: '#065f46',
    tassel: '#fbbf24',
    flag: '#059669',
    metal: '#d4af37',
    emissive: '#065f46',
    glow: 0.15,
  },
  群: {
    armor: '#3d3a2a',
    armorAccent: '#fbbf24',
    cloth: '#78350f',
    tassel: '#dc2626',
    flag: '#b45309',
    metal: '#d4af37',
    emissive: '#78350f',
    glow: 0.2,
  },
};

const SLOTS = 5;
const SLOT_SPACING = 1.8; // 牌位间距

// ======================================================================
// 3D 子模型
// ======================================================================

/** 单个 3D 武将小兵模型 */
function SoldierModel({
  faction,
  highlight,
  index,
}: {
  faction: Faction;
  highlight: boolean;
  index: number;
}) {
  const m = FACTION_MAT[faction];
  const groupRef = useRef<THREE.Group>(null);
  const flagRef = useRef<THREE.Mesh>(null);
  const tasselRef = useRef<THREE.Group>(null);

  // 待机摇摆 + 旗帜飘动
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.8 + index) * 0.05;
      groupRef.current.position.y = Math.sin(t * 1.2 + index * 0.5) * 0.02;
    }
    if (flagRef.current) {
      flagRef.current.rotation.z = Math.sin(t * 2 + index) * 0.15;
    }
    if (tasselRef.current) {
      tasselRef.current.rotation.x = Math.sin(t * 2.5 + index * 0.3) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* === 底座方砖 === */}
      <RoundedBox args={[0.65, 0.08, 0.45]} radius={0.03} smoothness={4} position={[0, 0.04, 0]}>
        <meshStandardMaterial color="#3a2418" roughness={0.8} />
      </RoundedBox>
      {/* 底座金边 */}
      <Box args={[0.68, 0.02, 0.48]} position={[0, 0.01, 0]}>
        <meshStandardMaterial color={m.metal} metalness={0.8} roughness={0.3} />
      </Box>

      {/* === 双腿 === */}
      <Cylinder args={[0.05, 0.06, 0.35, 8]} position={[-0.1, 0.25, 0]}>
        <meshStandardMaterial color={m.cloth} roughness={0.7} />
      </Cylinder>
      <Cylinder args={[0.05, 0.06, 0.35, 8]} position={[0.1, 0.25, 0]}>
        <meshStandardMaterial color={m.cloth} roughness={0.7} />
      </Cylinder>

      {/* === 腰带 === */}
      <Cylinder args={[0.14, 0.14, 0.06, 10]} position={[0, 0.45, 0]}>
        <meshStandardMaterial color={m.metal} metalness={0.9} roughness={0.2} />
      </Cylinder>

      {/* === 躯干（铠甲） === */}
      <RoundedBox
        args={[0.32, 0.42, 0.2]}
        radius={0.04}
        smoothness={4}
        position={[0, 0.7, 0]}
      >
        <meshStandardMaterial
          color={m.armor}
          metalness={0.7}
          roughness={0.35}
          emissive={m.emissive}
          emissiveIntensity={highlight ? m.glow + 0.2 : m.glow}
        />
      </RoundedBox>

      {/* 护心镜 */}
      <Cylinder args={[0.09, 0.09, 0.03, 16]} position={[0, 0.72, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color={m.metal}
          metalness={1}
          roughness={0.15}
          emissive={m.armorAccent}
          emissiveIntensity={highlight ? 0.4 : 0.15}
        />
      </Cylinder>

      {/* === 肩甲 === */}
      <Sphere args={[0.11, 10, 10]} position={[-0.2, 0.88, 0]} scale={[1, 0.8, 1]}>
        <meshStandardMaterial color={m.metal} metalness={0.9} roughness={0.25} />
      </Sphere>
      <Sphere args={[0.11, 10, 10]} position={[0.2, 0.88, 0]} scale={[1, 0.8, 1]}>
        <meshStandardMaterial color={m.metal} metalness={0.9} roughness={0.25} />
      </Sphere>

      {/* === 双臂 === */}
      <Cylinder
        args={[0.05, 0.05, 0.32, 8]}
        position={[-0.22, 0.7, 0]}
        rotation={[0, 0, 0.15]}
      >
        <meshStandardMaterial color={m.armor} roughness={0.5} />
      </Cylinder>
      <Cylinder
        args={[0.05, 0.05, 0.32, 8]}
        position={[0.22, 0.7, 0]}
        rotation={[0, 0, -0.15]}
      >
        <meshStandardMaterial color={m.armor} roughness={0.5} />
      </Cylinder>

      {/* === 颈部 === */}
      <Cylinder args={[0.06, 0.07, 0.08, 8]} position={[0, 0.96, 0]}>
        <meshStandardMaterial color="#d4a574" roughness={0.7} />
      </Cylinder>

      {/* === 头部 === */}
      <Sphere args={[0.11, 12, 12]} position={[0, 1.06, 0]}>
        <meshStandardMaterial color="#d4a574" roughness={0.6} />
      </Sphere>

      {/* === 头盔 === */}
      <Sphere
        args={[0.13, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
        position={[0, 1.1, 0]}
      >
        <meshStandardMaterial color={m.metal} metalness={0.95} roughness={0.2} />
      </Sphere>

      {/* 头盔顶钉 */}
      <Sphere args={[0.03, 8, 8]} position={[0, 1.22, 0]}>
        <meshStandardMaterial color={m.metal} metalness={1} roughness={0.1} />
      </Sphere>

      {/* === 红缨（从头盔顶向后飘） === */}
      <group ref={tasselRef} position={[0, 1.22, 0]}>
        <Cone
          args={[0.04, 0.2, 8]}
          position={[0, 0.08, -0.05]}
          rotation={[0.3, 0, 0]}
        >
          <meshStandardMaterial
            color={m.tassel}
            emissive={m.tassel}
            emissiveIntensity={0.3}
            roughness={0.6}
          />
        </Cone>
      </group>

      {/* === 长矛（右手持） === */}
      <group position={[0.28, 0.9, 0]} rotation={[0, 0, -0.1]}>
        {/* 矛杆 */}
        <Cylinder args={[0.015, 0.015, 1.4, 8]} position={[0.15, 0.3, 0]} rotation={[0, 0, -0.25]}>
          <meshStandardMaterial color="#5a3810" roughness={0.9} />
        </Cylinder>
        {/* 矛尖 */}
        <Cone args={[0.03, 0.12, 8]} position={[0.35, 0.95, 0]} rotation={[0, 0, -0.25]}>
          <meshStandardMaterial color={m.metal} metalness={0.95} roughness={0.2} />
        </Cone>
        {/* 矛下红缨 */}
        <Cone args={[0.04, 0.1, 8]} position={[0.3, 0.82, 0]} rotation={[Math.PI, 0, -0.25]}>
          <meshStandardMaterial color={m.tassel} roughness={0.7} />
        </Cone>
      </group>

      {/* === 小旗帜（左肩后） === */}
      <group position={[-0.3, 1.0, -0.05]} rotation={[0, 0, 0.15]}>
        {/* 旗杆 */}
        <Cylinder args={[0.01, 0.01, 1.1, 6]} position={[0, 0.3, 0]}>
          <meshStandardMaterial color="#8b6914" metalness={0.6} roughness={0.4} />
        </Cylinder>
        {/* 旗面 */}
        <mesh ref={flagRef} position={[0.15, 0.55, 0]}>
          <planeGeometry args={[0.3, 0.2]} />
          <meshStandardMaterial
            color={m.flag}
            side={THREE.DoubleSide}
            emissive={m.flag}
            emissiveIntensity={0.2}
            roughness={0.5}
          />
        </mesh>
        {/* 旗杆顶饰 */}
        <Sphere args={[0.02, 6, 6]} position={[0, 0.85, 0]}>
          <meshStandardMaterial color={m.metal} metalness={1} roughness={0.1} />
        </Sphere>
      </group>
    </group>
  );
}

/** 点将台地板（青石） */
function PlatformGround() {
  return (
    <group>
      {/* 主平台 */}
      <RoundedBox args={[12, 0.3, 4]} radius={0.1} position={[0, -0.15, 0]}>
        <meshStandardMaterial color="#3a2a1c" roughness={0.9} />
      </RoundedBox>

      {/* 台面金边 */}
      <Box args={[12.1, 0.02, 4.1]} position={[0, 0.01, 0]}>
        <meshStandardMaterial color="#8b6914" metalness={0.7} roughness={0.4} />
      </Box>

      {/* 前阶梯 */}
      <RoundedBox args={[11, 0.15, 0.6]} radius={0.05} position={[0, -0.35, 2.3]}>
        <meshStandardMaterial color="#2a1c12" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[10, 0.15, 0.5]} radius={0.05} position={[0, -0.5, 2.8]}>
        <meshStandardMaterial color="#1a120a" roughness={0.95} />
      </RoundedBox>

      {/* 后方点将台基座 */}
      <RoundedBox args={[6, 1.2, 0.3]} radius={0.1} position={[0, 0.6, -2.2]}>
        <meshStandardMaterial color="#2a1c12" roughness={0.9} />
      </RoundedBox>

      {/* 青石地砖纹（用小方块拼接） */}
      {Array.from({ length: 12 }).map((_, i) =>
        Array.from({ length: 4 }).map((_, j) => (
          <Box
            key={`tile-${i}-${j}`}
            args={[0.95, 0.005, 0.95]}
            position={[-5.5 + i * 1.0, 0.008, -1.5 + j * 1.0]}
          >
            <meshStandardMaterial
              color={(i + j) % 2 === 0 ? '#4a3a2a' : '#3a2a1c'}
              roughness={0.95}
            />
          </Box>
        )),
      )}
    </group>
  );
}

/** 点将台上的"主帅"大旗 */
function MainBanner({ teamIndex }: { teamIndex: number }) {
  const flagRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (flagRef.current) {
      const t = state.clock.getElapsedTime();
      flagRef.current.rotation.y = Math.sin(t * 1.2) * 0.15;
    }
  });

  return (
    <group position={[teamIndex === 0 ? -4.5 : 4.5, 1.2, -2.2]}>
      {/* 旗杆 */}
      <Cylinder args={[0.05, 0.05, 3, 10]} position={[0, 1.5, 0]}>
        <meshStandardMaterial color="#8b6914" metalness={0.7} roughness={0.4} />
      </Cylinder>
      {/* 旗杆顶龙头装饰 */}
      <Cone args={[0.08, 0.2, 6]} position={[0, 3.1, 0]}>
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
      </Cone>
      {/* 大旗面 */}
      <mesh ref={flagRef} position={[0.5, 2.2, 0]}>
        <planeGeometry args={[1.2, 1.5]} />
        <meshStandardMaterial
          color="#7a1f1f"
          side={THREE.DoubleSide}
          emissive="#7a1f1f"
          emissiveIntensity={0.25}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

/** 点将台上的大鼎 */
function Cauldron({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 鼎腿 */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <Cylinder
            key={i}
            args={[0.04, 0.05, 0.3, 6]}
            position={[Math.cos(angle) * 0.2, 0.15, Math.sin(angle) * 0.2]}
          >
            <meshStandardMaterial color="#4a3810" metalness={0.8} roughness={0.4} />
          </Cylinder>
        );
      })}
      {/* 鼎身 */}
      <Cylinder args={[0.3, 0.2, 0.4, 16]} position={[0, 0.5, 0]}>
        <meshStandardMaterial
          color="#5a3810"
          metalness={0.85}
          roughness={0.35}
          emissive="#d4af37"
          emissiveIntensity={0.1}
        />
      </Cylinder>
      {/* 鼎口 */}
      <Cylinder args={[0.33, 0.3, 0.08, 16]} position={[0, 0.74, 0]}>
        <meshStandardMaterial color="#8b6914" metalness={0.9} roughness={0.25} />
      </Cylinder>
      {/* 火焰 */}
      <FireFlame position={[0, 0.85, 0]} />
    </group>
  );
}

/** 火焰特效 */
function FireFlame({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      ref.current.scale.y = 0.8 + Math.sin(t * 8) * 0.2;
      ref.current.scale.x = 0.9 + Math.sin(t * 6) * 0.1;
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <coneGeometry args={[0.15, 0.4, 8]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#dc2626"
        emissiveIntensity={1.2}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

/** 3D 阵位（槽位） */
function SlotTileMesh({
  slotIndex,
  x,
  empty,
  isOver,
  highlight,
}: {
  slotIndex: number;
  x: number;
  empty: boolean;
  isOver: boolean;
  highlight: boolean;
}) {
  return (
    <group position={[x, 0.05, 0]}>
      {/* 青铜底座 */}
      <RoundedBox args={[1.5, 0.08, 1.2]} radius={0.04} position={[0, 0, 0]}>
        <meshStandardMaterial
          color={isOver ? '#d4af37' : empty ? '#1a1008' : '#2a1c12'}
          metalness={0.3}
          roughness={0.7}
          emissive={isOver ? '#d4af37' : highlight ? '#d4af37' : '#000'}
          emissiveIntensity={isOver ? 0.5 : highlight ? 0.15 : 0}
        />
      </RoundedBox>
      {/* 金边框 */}
      <Box args={[1.52, 0.01, 1.22]} position={[0, 0.045, 0]}>
        <meshStandardMaterial
          color={isOver ? '#fde68a' : '#8b6914'}
          metalness={0.95}
          roughness={0.25}
          emissive={isOver ? '#fde68a' : '#000'}
          emissiveIntensity={isOver ? 0.4 : 0}
        />
      </Box>
      {empty && (
        <Text
          position={[0, 0.06, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.18}
          color={isOver ? '#fde68a' : '#8b6914'}
          anchorX="center"
          anchorY="middle"
        >
          {isOver ? `降 · ${slotIndex + 1}` : `空 ${slotIndex + 1}`}
        </Text>
      )}
    </group>
  );
}

/** 战力显示浮标（3D 位置，HTML 渲染） */
function PowerTag({ x, value, faction }: { x: number; value: number; faction: Faction }) {
  const m = FACTION_MAT[faction];
  return (
    <group position={[x, 0.12, 0.55]}>
      <RoundedBox args={[0.45, 0.2, 0.05]} radius={0.02} position={[0, 0.1, 0]}>
        <meshStandardMaterial color="#1a0f08" roughness={0.7} />
      </RoundedBox>
      <Box args={[0.47, 0.005, 0.052]} position={[0, 0.21, 0]}>
        <meshStandardMaterial color={m.metal} metalness={0.9} roughness={0.3} />
      </Box>
      <Text
        position={[0, 0.1, 0.03]}
        fontSize={0.13}
        color="#fde68a"
        anchorX="center"
        anchorY="middle"
        outlineColor="#000"
        outlineWidth={0.005}
      >
        {value}
      </Text>
    </group>
  );
}

/** 阵营徽章 3D 盾牌（立在槽位前） */
function FactionShield({ x, faction }: { x: number; faction: Faction }) {
  const m = FACTION_MAT[faction];
  return (
    <group position={[x - 0.55, 0.3, 0.55]}>
      {/* 盾身 */}
      <RoundedBox args={[0.28, 0.36, 0.04]} radius={0.03} position={[0, 0, 0]}>
        <meshStandardMaterial
          color={m.armor}
          metalness={0.6}
          roughness={0.4}
          emissive={m.emissive}
          emissiveIntensity={0.2}
        />
      </RoundedBox>
      {/* 金边 */}
      <Box args={[0.3, 0.38, 0.035]} position={[0, 0, -0.005]}>
        <meshStandardMaterial color={m.metal} metalness={0.9} roughness={0.25} />
      </Box>
      {/* 阵营字 */}
      <Text
        position={[0, 0, 0.025]}
        fontSize={0.18}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        outlineColor={m.armor}
        outlineWidth={0.008}
      >
        {faction}
      </Text>
    </group>
  );
}

/** 完整 3D 场景 */
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
    camera.position.set(0, 3.5, 4.5);
    camera.lookAt(0, 0.5, 0);
  }, [camera]);

  // 槽位 X 坐标
  const xs = useMemo(
    () => Array.from({ length: SLOTS }, (_, i) => (i - (SLOTS - 1) / 2) * SLOT_SPACING),
    [],
  );

  return (
    <>
      {/* === 灯光 === */}
      <ambientLight intensity={0.5} color="#ffd28c" />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        color="#fff2cc"
        castShadow
      />
      <pointLight position={[0, 3, 2]} intensity={0.6} color="#fbbf24" distance={10} />
      {/* 朱砂氛围光 */}
      <pointLight position={[-4, 2, -2]} intensity={0.4} color="#dc2626" distance={6} />
      <pointLight position={[4, 2, -2]} intensity={0.4} color="#dc2626" distance={6} />

      {/* === 天穹远景雾 === */}
      <fog attach="fog" args={['#2a1810', 5, 18]} />

      {/* === 点将台地面 === */}
      <PlatformGround />

      {/* === 主帅旗 === */}
      <MainBanner teamIndex={0} />

      {/* === 两侧大鼎 === */}
      <Cauldron position={[-3.2, 0, -1.8]} />
      <Cauldron position={[3.2, 0, -1.8]} />

      {/* === 5 个槽位 === */}
      {xs.map((x, i) => (
        <SlotTileMesh
          key={i}
          slotIndex={i}
          x={x}
          empty={!cards[i]}
          isOver={hovered === i}
          highlight={highlight}
        />
      ))}

      {/* === 武将小兵 === */}
      {cards.map((c, i) =>
        c ? (
          <group key={c.id} position={[xs[i], 0.1, -0.1]}>
            <SoldierModel faction={c.faction} highlight={highlight} index={i} />
          </group>
        ) : null,
      )}

      {/* === 阵营盾牌 === */}
      {cards.map((c, i) =>
        c ? <FactionShield key={`s-${c.id}`} x={xs[i]} faction={c.faction} /> : null,
      )}

      {/* === 战力数字 === */}
      {cards.map((c, i) =>
        c ? (
          <PowerTag key={`p-${c.id}`} x={xs[i]} value={c.pointValue} faction={c.faction} />
        ) : null,
      )}
    </>
  );
}

/**
 * 主组件 —— Canvas 外层 + HTML 叠加交互层
 * 交互：用透明 HTML grid 覆盖在 Canvas 上，分成 5 个 droppable/draggable 槽位区
 * 这样保留 dnd-kit 的完整交互，3D 视觉只是"显示层"
 */
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
            <span
              className={[
                'tabular-nums',
                evalResult.isFlush ? 'text-gold-grad' : 'text-amber-200/40',
              ].join(' ')}
            >
              {evalResult.suitBonus}
            </span>
            <span className="text-amber-200/50 text-base">)</span>
            <span className="text-amber-200/50 text-base">=</span>
            <span
              className={[
                'tabular-nums',
                evalResult.capped ? 'text-red-400 line-through' : 'text-gold-grad',
              ].join(' ')}
            >
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

      {/* 3D Canvas + HTML 拖拽叠层 */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', minHeight: 220 }}>
        {/* Three.js 3D 场景 */}
        <div className="absolute inset-0 rounded-md overflow-hidden">
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            style={{
              background:
                'linear-gradient(180deg, #3a1f12 0%, #1a0f08 50%, #0a0502 100%)',
            }}
          >
            <OrthographicCamera
              makeDefault
              position={[0, 3.5, 4.5]}
              zoom={70}
              near={0.1}
              far={100}
            />
            <Scene cards={cards} hovered={hovered} highlight={highlight} />
          </Canvas>
        </div>

        {/* HTML 拖拽叠层 —— 5 个透明区覆盖在 3D 上 */}
        <div className="absolute inset-0 grid grid-cols-5 gap-0 p-2 pointer-events-none">
          {cards.map((c, i) => (
            <SlotInteractionLayer
              key={i}
              teamIndex={teamIndex}
              slotIndex={i}
              card={c}
              onHoverChange={(hov) => setHovered(hov ? i : hovered === i ? null : hovered)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** 单个槽位的 HTML 交互层（透明，负责拖拽 + 悬停） */
function SlotInteractionLayer({
  teamIndex,
  slotIndex,
  card,
  onHoverChange,
}: {
  teamIndex: number;
  slotIndex: number;
  card: Card | null;
  onHoverChange: (hover: boolean) => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `team-${teamIndex}-${slotIndex}`,
    data: { type: 'team', teamIndex, slotIndex },
  });

  useEffect(() => {
    onHoverChange(isOver);
  }, [isOver, onHoverChange]);

  return (
    <div ref={setDropRef} className="relative h-full pointer-events-auto">
      {card && (
        <DraggableOverlay
          card={card}
          slotIndex={slotIndex}
        />
      )}
    </div>
  );
}

/** 已上阵武将的拖拽热区（透明，只收触发事件） */
function DraggableOverlay({ card }: { card: Card; slotIndex: number }) {
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
