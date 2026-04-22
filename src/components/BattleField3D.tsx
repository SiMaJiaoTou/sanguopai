import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { PerspectiveCamera, Text, Cylinder, Plane, Html } from '@react-three/drei';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import type { Card, EvaluateResult, Faction } from '../types';
import { POWER_CAP } from '../evaluate';
import { FORMATIONS } from '../formations';

interface Props {
  teamIndex: number;
  cards: (Card | null)[];
  evalResult: EvaluateResult | null;
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
// 注意：间距需 > TILE_W 以避免重叠
const SLOT_LAYOUT: { x: number; z: number }[] = [
  { x: -1.5125, z: -1.03125 }, // 0 后排左
  { x: 1.5125, z: -1.03125 },  // 1 后排右
  { x: -3.025, z: 1.03125 },   // 2 前排左
  { x: 0, z: 1.03125 },        // 3 前排中
  { x: 3.025, z: 1.03125 },    // 4 前排右
];

// 牌位尺寸（缩小以适配阵法最紧凑间距 1.0，如一字阵）
const TILE_W = 0.95;
const TILE_H = 0.85;

// 军团 3D 模型整体缩放（旗杆/徽章/战力牌匾等随之缩小）
const MODEL_SCALE = 0.5;

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
      </group>

      {/* 武将中文名牌（HTML 层，支持中文）—— 显示在头像立牌正下方 */}
      <Html
        position={[0, 0.02, 0.32]}
        center
        distanceFactor={6}
        zIndexRange={[20, 10]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="font-kai font-black whitespace-nowrap"
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 14,
            color: '#fef3c7',
            background: `linear-gradient(180deg, ${m.flagDark} 0%, #1a0f08 100%)`,
            border: `1.5px solid ${m.trim}`,
            boxShadow:
              '0 1px 3px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,220,160,0.3)',
            textShadow:
              '0 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(212,175,55,0.4)',
            letterSpacing: '0.08em',
          }}
        >
          {name}
        </div>
      </Html>
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

  // 外层 group 做 lerp 平滑跟随阵法变化
  const outerRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!outerRef.current) return;
    outerRef.current.position.x += (position.x - outerRef.current.position.x) * 0.12;
    outerRef.current.position.z += (position.z - outerRef.current.position.z) * 0.12;
  });

  return (
    <group ref={outerRef} position={[position.x, 0.002, position.z]}>
    <group rotation={[-Math.PI / 2, 0, 0]}>
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
    </group>
  );
}

// ======================================================================
// 水墨地图地面
// ======================================================================

function MapGround() {
  // 直接加载美术地面贴图 · public/scene.png
  const texture = useLoader(THREE.TextureLoader, '/scene.png');

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    // 不重复：整张图铺满地面，比阵法站位略大一圈以覆盖所有视角
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }, [texture]);

  // 地面足够大（50×50），保证任何运镜都不会露出边缘
  return (
    <Plane args={[50, 50]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
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
  evalResult,
  onProjected,
}: {
  cards: (Card | null)[];
  hovered: number | null;
  highlight: boolean;
  evalResult: EvaluateResult | null;
  onProjected: (pts: { left: number; top: number; halfW: number; halfH: number }[]) => void;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    // 透视相机 + 远距 + 小 FOV 模拟"正交感"：压缩近大远小畸变
    // 小 fov (22°) + 远距 (y=11, z=11) = 画面几乎无透视失真，
    // 但仍保留微弱的近大远小（比真正交相机自然）
    camera.position.set(0, 11, 11);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // 满 5 员时用阵法坐标，否则用默认 SLOT_LAYOUT
  const isFull = cards.every((c) => c !== null);
  const formation = isFull && evalResult ? FORMATIONS[evalResult.rankType.key] : null;
  const positions = useMemo(() => {
    if (formation) return formation.formation.map(([x, _y, z]) => ({ x, z }));
    return SLOT_LAYOUT;
  }, [formation]);

  // 动画插值的当前位置（用于投影到 DOM）
  const animatedRef = useRef<{ x: number; z: number }[]>(
    positions.map((p) => ({ ...p })),
  );
  const lastSig = useRef<string>('');

  useFrame(() => {
    const anim = animatedRef.current;
    for (let i = 0; i < positions.length; i++) {
      if (!anim[i]) anim[i] = { ...positions[i] };
      anim[i].x += (positions[i].x - anim[i].x) * 0.12;
      anim[i].z += (positions[i].z - anim[i].z) * 0.12;
    }

    const v = new THREE.Vector3();
    const vR = new THREE.Vector3();
    const vD = new THREE.Vector3();
    const projected: { left: number; top: number; halfW: number; halfH: number }[] = [];
    for (let i = 0; i < anim.length; i++) {
      v.set(anim[i].x, 0, anim[i].z).project(camera);
      vR.set(anim[i].x + TILE_W / 2, 0, anim[i].z).project(camera);
      vD.set(anim[i].x, 0, anim[i].z + TILE_H / 2).project(camera);
      const left = ((v.x + 1) / 2) * size.width;
      const top = ((1 - v.y) / 2) * size.height;
      const rightPx = ((vR.x + 1) / 2) * size.width;
      const downPx = ((1 - vD.y) / 2) * size.height;
      projected.push({
        left,
        top,
        halfW: Math.abs(rightPx - left),
        halfH: Math.abs(downPx - top),
      });
    }
    // 用整数像素签名判等，避免每帧 setState 抖动
    const sig = projected
      .map((p) => `${p.left | 0},${p.top | 0},${p.halfW | 0},${p.halfH | 0}`)
      .join('|');
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      onProjected(projected);
    }
  });

  return (
    <>
      {/* 灯光（整体明亮） */}
      <ambientLight intensity={1.0} color="#fff5e0" />
      <directionalLight position={[4, 8, 4]} intensity={0.6} color="#fff2cc" castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.25} color="#e8dcc0" />

      {/* 3D 地面改由 HTML 背景图层承担（scene2.png, contain 模式），此处不再渲染 MapGround */}
      {/* <MapGround /> */}
      {/* 5 个梯形槽位（跟随阵法坐标） */}
      {positions.map((pos, i) => (
        <SlotTile
          key={i}
          slotIndex={i}
          position={pos}
          empty={!cards[i]}
          isOver={hovered === i}
          highlight={highlight}
        />
      ))}

      {/* 旗子（武将）—— 立在格子中心（跟随阵法坐标 + lerp） */}
      {cards.map((c, i) =>
        c ? (
          <AnimatedFlag
            key={c.id}
            targetX={positions[i].x}
            targetZ={positions[i].z - 0.1}
            faction={c.faction}
            seed={i * 1.7}
            highlight={highlight}
          />
        ) : null,
      )}

      {/* 武将徽章（左前角，跟随） */}
      {cards.map((c, i) =>
        c ? (
          <AnimatedGroup
            key={`m-${c.id}`}
            targetX={positions[i].x - TILE_W * 0.4}
            targetZ={positions[i].z + TILE_H * 0.45}
          >
            <CommanderMark faction={c.faction} name={c.name} />
          </AnimatedGroup>
        ) : null,
      )}

      {/* 战力数字（大号立体牌匾，悬浮在格子上方前侧，跟随） */}
      {cards.map((c, i) =>
        c ? (
          <PowerBanner
            key={`p-${c.id}`}
            value={c.pointValue}
            faction={c.faction}
            targetX={positions[i].x}
            targetZ={positions[i].z + TILE_H * 0.55}
          />
        ) : null,
      )}
    </>
  );
}

/** 平滑追随目标坐标的武将旗子 */
function AnimatedFlag({
  targetX,
  targetZ,
  faction,
  seed,
  highlight,
}: {
  targetX: number;
  targetZ: number;
  faction: Faction;
  seed: number;
  highlight: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.x += (targetX - ref.current.position.x) * 0.12;
    ref.current.position.z += (targetZ - ref.current.position.z) * 0.12;
  });
  return (
    <group ref={ref} position={[targetX, 0, targetZ]} scale={MODEL_SCALE}>
      <WarFlag faction={faction} seed={seed} highlight={highlight} />
    </group>
  );
}

/** 平滑追随目标坐标的普通 group 容器 */
function AnimatedGroup({
  targetX,
  targetZ,
  children,
}: {
  targetX: number;
  targetZ: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.x += (targetX - ref.current.position.x) * 0.12;
    ref.current.position.z += (targetZ - ref.current.position.z) * 0.12;
  });
  return (
    <group ref={ref} position={[targetX, 0, targetZ]} scale={MODEL_SCALE}>
      {children}
    </group>
  );
}

/** 大号战力牌匾（跟随目标坐标平滑移动 + 轻微浮动） */
function PowerBanner({
  value,
  faction,
  targetX,
  targetZ,
}: {
  value: number;
  faction: Faction;
  targetX: number;
  targetZ: number;
}) {
  const m = FACTION_MAT[faction];
  const ref = useRef<THREE.Group>(null);
  const baseY = 0.9 * MODEL_SCALE;

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime();
      ref.current.position.x += (targetX - ref.current.position.x) * 0.12;
      ref.current.position.z += (targetZ - ref.current.position.z) * 0.12;
      ref.current.position.y = baseY + Math.sin(t * 1.5) * 0.025 * MODEL_SCALE;
    }
  });

  return (
    <group ref={ref} position={[targetX, baseY, targetZ]} rotation={[-Math.PI / 7, 0, 0]} scale={MODEL_SCALE}>
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
        战
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
}: Props) {
  const full = cards.every((c) => c !== null);
  const highlight = !!evalResult && (evalResult.rankType.score >= 6 || evalResult.isFlush);
  const [hovered, setHovered] = useState<number | null>(null);
  const [projected, setProjected] = useState<
    { left: number; top: number; halfW: number; halfH: number }[]
  >([]);

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
            {teamIndex === 0 ? '前军' : '后军'}
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
                  ◆ 阵营同心
                </motion.span>
              )}
            </div>
          ) : (
            <span className="text-xs text-amber-100/50 italic">· 配阵中 ·</span>
          )}
        </div>
      </div>

      {/* 四指标拆解 banner：始终显示。未成阵时阵法=1、阵营=0 */}
      {(() => {
        const placedCount = cards.filter((c) => !!c).length;
        const basePower = cards.reduce((s, c) => s + (c?.pointValue ?? 0), 0);
        const rankMult = full && evalResult ? evalResult.rankType.score : 1;
        const flushBonus = full && evalResult ? evalResult.suitBonus : 0;
        const capped = full && evalResult ? evalResult.capped : false;
        const finalPower = full && evalResult ? evalResult.power : basePower;
        const flushLabel = full && evalResult && evalResult.isFlush ? '阵营同心' : '—';
        const rankLabel = full && evalResult ? evalResult.rankType.name : `配阵中 · ${placedCount}/5`;

        return (
          <motion.div
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 px-3 py-3 rounded-lg"
            style={{
              background: 'linear-gradient(90deg, #1a0f08 0%, #2a1810 50%, #1a0f08 100%)',
              border: '2px solid #5a3a24',
              boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.6)',
            }}
          >
            <div className="grid grid-cols-4 gap-2 items-stretch">
              {/* 1 · 基础战斗力 */}
              <StatBox
                label="基础武勇"
                sub="已上阵之和"
                value={basePower}
                valueClass="text-emerald-300"
              />
              {/* 2 · 阵法倍率 */}
              <StatBox
                label="阵法加成"
                sub={rankLabel}
                value={`×${rankMult}`}
                valueClass={rankMult >= 5 ? 'text-gold-grad' : 'text-emerald-300'}
              />
              {/* 3 · 阵营加成 */}
              <StatBox
                label="同心加成"
                sub={flushLabel}
                value={`+${flushBonus}`}
                valueClass={flushBonus > 0 ? 'text-red-300' : 'text-amber-200/40'}
              />
              {/* 4 · 军团军势（主视觉，金光 + 大号 + 动画） */}
              <div
                className={[
                  'relative rounded-md px-2 py-2 text-center flex flex-col justify-center items-center',
                  'border-2',
                  highlight
                    ? 'border-gold shadow-glow'
                    : 'border-amber-700',
                ].join(' ')}
                style={{
                  background: highlight
                    ? 'linear-gradient(180deg, #fde68a 0%, #d4af37 55%, #8b6914 100%)'
                    : 'linear-gradient(180deg, #3a2418 0%, #2a1810 55%, #1a0f08 100%)',
                  boxShadow: highlight
                    ? 'inset 0 1px 0 rgba(255,245,200,0.6), 0 0 14px rgba(212,175,55,0.6), 0 2px 6px rgba(0,0,0,0.8)'
                    : 'inset 0 1px 0 rgba(255,200,120,0.25), 0 2px 4px rgba(0,0,0,0.7)',
                }}
              >
                <div
                  className={[
                    'text-[10px] tracking-[0.3em] font-kai font-black leading-none',
                    highlight ? 'text-[#3a1f00]' : 'text-gold-grad',
                  ].join(' ')}
                >
                  軍 團 軍 勢
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={finalPower}
                    initial={{ y: -4, opacity: 0, scale: 1.3 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 4, opacity: 0 }}
                    className={[
                      'text-2xl sm:text-3xl font-black tabular-nums font-kai leading-none mt-1',
                      highlight ? 'text-[#2a1808]' : 'text-gold-grad animate-shine',
                      capped ? 'drop-shadow-[0_0_6px_rgba(248,113,113,0.8)]' : '',
                    ].join(' ')}
                    style={{
                      textShadow: highlight
                        ? 'none'
                        : '0 0 10px rgba(251,191,36,0.6), 0 2px 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    {finalPower}
                  </motion.div>
                </AnimatePresence>
                {capped && (
                  <span className="mt-1 text-[9px] text-red-200 px-1.5 py-0.5 rounded bg-red-900/60 border border-red-400/70 font-bold tracking-widest">
                    封顶 {POWER_CAP}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Canvas + 交互层 */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 10', minHeight: 280 }}>
        <div
          className="absolute inset-0 rounded-md overflow-hidden"
          style={{
            // letterbox 留白区域的同色底（深棕），与站点主色呼应
            backgroundColor: '#2a1a10',
          }}
        >
          {/* 3D 背景图层：contain 不拉伸 + 完整显示 + 变白降低存在感 */}
          <img
            src="/scene2.png"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
            style={{
              objectFit: 'contain',
              objectPosition: 'center center',
              opacity: 0.55,
              filter: 'brightness(1.35) saturate(0.75)',
              mixBlendMode: 'screen',
            }}
          />
          <Canvas
            dpr={[1, 2]}
            gl={{
              antialias: true,
              alpha: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
          >
            <PerspectiveCamera
              makeDefault
              position={[0, 11, 11]}
              fov={22}
              near={0.1}
              far={100}
            />
            <Scene
              cards={cards}
              hovered={hovered}
              highlight={highlight}
              evalResult={evalResult}
              onProjected={setProjected}
            />
          </Canvas>
        </div>

        {/* 交互层：跟随 3D 投影坐标动态定位 */}
        <SlotOverlayGrid
          teamIndex={teamIndex}
          cards={cards}
          onHoverChange={setHovered}
          projected={projected}
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
  projected,
}: {
  teamIndex: number;
  cards: (Card | null)[];
  onHoverChange: (idx: number | null) => void;
  projected: { left: number; top: number; halfW: number; halfH: number }[];
}) {
  // 管理 hover 状态：记录哪些格子被悬停，取最新一个
  const handleHover = (hover: boolean, idx: number) => {
    if (hover) onHoverChange(idx);
    else onHoverChange(null);
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {cards.map((card, i) => {
        const p = projected[i];
        if (!p) return null;
        const w = Math.max(40, p.halfW * 2);
        const h = Math.max(40, p.halfH * 2);
        return (
          <div
            key={i}
            className="absolute pointer-events-auto"
            style={{
              left: p.left,
              top: p.top,
              width: w,
              height: h,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <SlotCell
              teamIndex={teamIndex}
              slotIndex={i}
              card={card}
              onHoverChange={handleHover}
            />
          </div>
        );
      })}
    </div>
  );
}

function SlotCell({
  teamIndex,
  slotIndex,
  card,
  onHoverChange,
}: {
  teamIndex: number;
  slotIndex: number;
  card: Card | null;
  onHoverChange: (hover: boolean, idx: number) => void;
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
    <div ref={setNodeRef} className="relative w-full h-full">
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

// ======================================================================
// 四指标 banner 的普通小指标盒子
// ======================================================================
function StatBox({
  label,
  sub,
  value,
  valueClass = 'text-amber-100',
}: {
  label: string;
  sub?: string;
  value: number | string;
  valueClass?: string;
}) {
  return (
    <div
      className="relative rounded-md px-2 py-2 text-center flex flex-col justify-center items-center border border-amber-900/60"
      style={{
        background: 'linear-gradient(180deg, rgba(58,36,24,0.7) 0%, rgba(26,15,8,0.9) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,200,120,0.12), 0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      <div className="text-[10px] tracking-[0.25em] font-kai font-black text-amber-200/75 leading-none">
        {label}
      </div>
      <div
        className={[
          'text-xl sm:text-2xl font-black tabular-nums font-kai leading-none mt-1',
          valueClass,
        ].join(' ')}
        style={{
          textShadow: '0 2px 3px rgba(0,0,0,0.8)',
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[9px] text-amber-100/45 italic mt-1 leading-tight truncate max-w-full">
          {sub}
        </div>
      )}
    </div>
  );
}
