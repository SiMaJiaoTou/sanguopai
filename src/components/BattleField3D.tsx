import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Text, Cylinder, Plane } from '@react-three/drei';
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
  const ribbonRef = useRef<THREE.Mesh>(null);

  // 保存初始顶点位置，用于每帧相对变形
  const initialPositions = useRef<Float32Array | null>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // === 旗面顶点波浪动画（柔软飘动）===
    if (flagRef.current) {
      const geometry = flagRef.current.geometry as THREE.PlaneGeometry;
      const posAttr = geometry.attributes.position;

      // 初次帧缓存原始顶点
      if (!initialPositions.current) {
        initialPositions.current = new Float32Array(posAttr.array);
      }
      const init = initialPositions.current;

      // 每个顶点变形：离旗杆越远摆动越大，最靠旗杆（ix≈0）锁死
      for (let i = 0; i < posAttr.count; i++) {
        const ix = init[i * 3];
        const iy = init[i * 3 + 1];
        const flagW = 0.95;

        // 距旗杆的归一化距离 (0~1)
        const distFromPole = ix / flagW;
        // 柔和曲线：靠旗杆处 0，远端 1
        // 使用 smoothstep 避免突然起波
        const ease = distFromPole < 0.02
          ? 0
          : Math.min(1, (distFromPole - 0.02) / 0.98);
        const intensity = Math.pow(ease, 1.4);

        // 主波：旗面水平方向的柔软波浪
        const mainWave = Math.sin(ix * 6 - t * 3.5 + seed) * 0.14 * intensity;
        // 副波：上下摆动
        const subWave = Math.sin(ix * 3.5 - t * 2.2 + seed * 0.8) * 0.06 * intensity;
        // 垂直皱褶
        const vert = Math.cos(iy * 8 + t * 4 + seed) * 0.02 * intensity;

        // X 轴稍稍收缩（旗面被风吹时长度变短的视觉）
        const xShrink = 1 - 0.015 * intensity;

        posAttr.setX(i, ix * xShrink);
        posAttr.setZ(i, mainWave + subWave + vert);
        posAttr.setY(
          i,
          iy + Math.sin(ix * 4 - t * 2.5) * 0.015 * intensity,
        );
      }
      posAttr.needsUpdate = true;
      geometry.computeVertexNormals();
    }

    // === 中部飘带柔软摆动 ===
    if (ribbonRef.current) {
      ribbonRef.current.rotation.z =
        Math.PI / 16 + Math.sin(t * 2.2 + seed) * 0.25;
      ribbonRef.current.rotation.x = Math.sin(t * 1.8 + seed * 0.5) * 0.15;
    }

    // === 高倍率时整体呼吸 ===
    if (groupRef.current && highlight) {
      groupRef.current.position.y = Math.sin(t * 2) * 0.03;
    }
  });

  const poleH = 2.0;
  const flagW = 0.95;
  const flagH = 0.6;

  // 旗面贴图 —— 用 Canvas 绘制：阵营色底 + 大字 + 金边
  const flagTexture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 320;
    const ctx = c.getContext('2d')!;

    // 阵营底色渐变
    const grad = ctx.createLinearGradient(0, 0, 512, 320);
    grad.addColorStop(0, m.flagDark);
    grad.addColorStop(0.5, m.flag);
    grad.addColorStop(1, m.flagDark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 320);

    // 暗纹布料质感
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let i = 0; i < 512; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 320);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 旗面金边（内边框）
    ctx.strokeStyle = m.trim;
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 488, 296);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(20, 20, 472, 280);
    ctx.globalAlpha = 1;

    // 阵营大字（中心）
    ctx.font = 'bold 220px "STKaiti", "KaiTi", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 字体描边
    ctx.lineWidth = 14;
    ctx.strokeStyle = m.flagDark;
    ctx.strokeText(faction, 256, 170);
    // 金色填充
    const textGrad = ctx.createLinearGradient(0, 80, 0, 260);
    textGrad.addColorStop(0, '#fff5cc');
    textGrad.addColorStop(0.5, m.trim);
    textGrad.addColorStop(1, '#8b6914');
    ctx.fillStyle = textGrad;
    ctx.fillText(faction, 256, 170);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [faction, m.flag, m.flagDark, m.trim]);

  return (
    <group ref={groupRef}>
      {/* === 底座：三层结构 === */}
      <Cylinder args={[0.22, 0.26, 0.06, 16]} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#2a1810" roughness={0.95} />
      </Cylinder>
      <Cylinder args={[0.18, 0.2, 0.04, 16]} position={[0, 0.08, 0]}>
        <meshStandardMaterial color="#8b5a28" metalness={0.75} roughness={0.4} />
      </Cylinder>
      <Cylinder args={[0.14, 0.16, 0.025, 16]} position={[0, 0.12, 0]}>
        <meshStandardMaterial color={m.trim} metalness={0.9} roughness={0.2} />
      </Cylinder>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={`rivet-${i}`}
            position={[Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2]}
          >
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshStandardMaterial color={m.trim} metalness={1} roughness={0.15} />
          </mesh>
        );
      })}

      {/* === 旗杆三节 === */}
      <Cylinder args={[0.032, 0.035, 0.6, 10]} position={[0, 0.45, 0]}>
        <meshStandardMaterial color={m.pole} metalness={0.35} roughness={0.55} />
      </Cylinder>
      <Cylinder args={[0.04, 0.04, 0.05, 10]} position={[0, 0.78, 0]}>
        <meshStandardMaterial color={m.trim} metalness={0.9} roughness={0.25} />
      </Cylinder>
      <Cylinder args={[0.028, 0.032, 0.8, 10]} position={[0, 1.2, 0]}>
        <meshStandardMaterial color={m.pole} metalness={0.35} roughness={0.55} />
      </Cylinder>
      <Cylinder args={[0.036, 0.036, 0.05, 10]} position={[0, 1.65, 0]}>
        <meshStandardMaterial color={m.trim} metalness={0.9} roughness={0.25} />
      </Cylinder>
      <Cylinder args={[0.022, 0.028, 0.4, 10]} position={[0, 1.9, 0]}>
        <meshStandardMaterial color={m.pole} metalness={0.35} roughness={0.55} />
      </Cylinder>

      {/* === 旗杆顶三层 === */}
      <mesh position={[0, poleH + 0.12, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial
          color={m.trim}
          metalness={0.95}
          roughness={0.15}
          emissive={m.trim}
          emissiveIntensity={highlight ? 0.5 : 0.2}
        />
      </mesh>
      <Cylinder args={[0.04, 0.04, 0.04, 10]} position={[0, poleH + 0.19, 0]}>
        <meshStandardMaterial color={m.trim} metalness={1} roughness={0.1} />
      </Cylinder>
      <mesh position={[0, poleH + 0.3, 0]}>
        <coneGeometry args={[0.05, 0.22, 10]} />
        <meshStandardMaterial
          color={m.trim}
          metalness={0.98}
          roughness={0.1}
          emissive={m.trim}
          emissiveIntensity={highlight ? 0.6 : 0.25}
        />
      </mesh>
      <mesh position={[0, poleH + 0.44, 0]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial
          color={m.trim}
          metalness={1}
          roughness={0.1}
          emissive={m.trim}
          emissiveIntensity={highlight ? 0.8 : 0.4}
        />
      </mesh>

      {/* === 旗面与旗杆连接绳结 === */}
      <mesh position={[0.04, poleH - 0.08, 0]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color={m.flagDark} roughness={0.7} />
      </mesh>

      {/* === 旗面主体（顶点波浪动画 + 字作为贴图） === */}
      {/* 字作为贴图画在旗面上 —— 会跟随顶点一起弯曲 */}
      <group position={[0.025, poleH - flagH / 2 - 0.1, 0]}>
        <mesh ref={flagRef} position={[flagW / 2, 0, 0]}>
          <planeGeometry args={[flagW, flagH, 24, 12]} />
          <meshStandardMaterial
            map={flagTexture}
            side={THREE.DoubleSide}
            roughness={0.6}
            metalness={0.02}
            emissive={m.flagDark}
            emissiveIntensity={highlight ? 0.35 : 0.12}
            flatShading={false}
          />
        </mesh>
      </group>

      {/* === 中部飘带 === */}
      <mesh ref={ribbonRef} position={[0, poleH * 0.45, 0]}>
        <planeGeometry args={[0.14, 0.42]} />
        <meshStandardMaterial
          color={m.flagLight}
          side={THREE.DoubleSide}
          roughness={0.5}
          emissive={m.flagLight}
          emissiveIntensity={0.15}
        />
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
  // 规则矩形牌位（透视变形由 3D 相机自然产生）
  const borderColor = isOver ? '#fef3c7' : highlight ? '#fbbf24' : '#8b6914';

  return (
    <group position={[position.x, 0.002, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* 内部半透明底 */}
      <mesh>
        <planeGeometry args={[TILE_W, TILE_H]} />
        <meshStandardMaterial
          color={isOver ? '#fef3c7' : empty ? '#c9b995' : '#e8dcc0'}
          transparent
          opacity={isOver ? 0.35 : empty ? 0.1 : 0.18}
          roughness={0.95}
        />
      </mesh>
      {/* 外金边（粗） */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(TILE_W, TILE_H)]} />
        <lineBasicMaterial color={borderColor} />
      </lineSegments>
      {/* 内金边（细） */}
      <lineSegments scale={[0.92, 0.88, 1]} position={[0, 0, 0.001]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(TILE_W, TILE_H)]} />
        <lineBasicMaterial color={borderColor} transparent opacity={0.55} />
      </lineSegments>
      {/* 四角 L 型装饰 */}
      {([
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ] as [number, number][]).map(([sx, sy], i) => (
        <group key={i} position={[sx * (TILE_W / 2 - 0.08), sy * (TILE_H / 2 - 0.08), 0.002]}>
          <mesh>
            <planeGeometry args={[0.12, 0.02]} />
            <meshBasicMaterial color={borderColor} transparent opacity={0.75} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.02, 0.12]} />
            <meshBasicMaterial color={borderColor} transparent opacity={0.75} />
          </mesh>
        </group>
      ))}

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
    // 透视相机：斜俯视（参考图视角），拉远一点看全
    camera.position.set(0, 7, 6.5);
    camera.lookAt(0, 0, 0);
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

      {/* 战力数字（大号立体牌匾，悬浮在格子上方前侧） */}
      {cards.map((c, i) =>
        c ? (
          <PowerBanner
            key={`p-${c.id}`}
            value={c.pointValue}
            faction={c.faction}
            position={[
              SLOT_LAYOUT[i].x,
              0.9,
              SLOT_LAYOUT[i].z + TILE_H * 0.55,
            ]}
          />
        ) : null,
      )}
    </>
  );
}

/** 大号战力牌匾（billboard 式始终面向相机） */
function PowerBanner({
  value,
  faction,
  position,
}: {
  value: number;
  faction: Faction;
  position: [number, number, number];
}) {
  const m = FACTION_MAT[faction];
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      // 轻微上下浮动
      ref.current.position.y = position[1] + Math.sin(t * 1.5) * 0.025;
    }
  });

  return (
    <group ref={ref} position={position} rotation={[-Math.PI / 7, 0, 0]}>
      {/* 背板阴影（后方深板） */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[0.82, 0.48]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} />
      </mesh>
      {/* 外金边 */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[0.78, 0.44]} />
        <meshStandardMaterial
          color={m.trim}
          metalness={0.95}
          roughness={0.15}
          emissive={m.trim}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* 阵营色内底 */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.72, 0.38]} />
        <meshStandardMaterial
          color={m.badge}
          roughness={0.6}
          emissive={m.flagDark}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* 内金线 */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[0.68, 0.34]} />
        <meshBasicMaterial
          color={m.trim}
          transparent
          opacity={0.25}
        />
      </mesh>
      {/* 四角小铆钉装饰 */}
      {([
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ] as [number, number][]).map(([sx, sy], i) => (
        <mesh key={i} position={[sx * 0.32, sy * 0.17, 0.002]}>
          <circleGeometry args={[0.022, 12]} />
          <meshStandardMaterial
            color={m.trim}
            metalness={1}
            roughness={0.1}
            emissive={m.trim}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
      {/* 战力数字（超大） */}
      <Text
        position={[0, 0.01, 0.003]}
        fontSize={0.3}
        color="#fef3c7"
        anchorX="center"
        anchorY="middle"
        outlineColor="#000"
        outlineWidth={0.018}
        fontWeight="bold"
      >
        {value}
      </Text>
      {/* 标签"战"字 */}
      <Text
        position={[-0.3, 0.14, 0.003]}
        fontSize={0.08}
        color={m.trim}
        anchorX="center"
        anchorY="middle"
        outlineColor="#000"
        outlineWidth={0.005}
      >
        戰
      </Text>
    </group>
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
            <PerspectiveCamera
              makeDefault
              position={[0, 7, 6.5]}
              fov={38}
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
