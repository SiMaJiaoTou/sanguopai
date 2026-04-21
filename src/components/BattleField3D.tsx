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

/** 阵营配色（更明快，参考古地图战棋） */
const FACTION_MAT: Record<
  Faction,
  {
    flag: string;       // 旗面主色
    flagDark: string;
    pole: string;       // 旗杆色
    badge: string;      // 武将徽章底色
    badgeAccent: string;
    label: string;      // 盾牌横幅
  }
> = {
  魏: {
    flag: '#1e40af',
    flagDark: '#0a1f4d',
    pole: '#8b6914',
    badge: '#1e3a5f',
    badgeAccent: '#3b82f6',
    label: '#1e3a5f',
  },
  蜀: {
    flag: '#dc2626',
    flagDark: '#7f1d1d',
    pole: '#8b6914',
    badge: '#7a1f1f',
    badgeAccent: '#ef4444',
    label: '#7a1f1f',
  },
  吴: {
    flag: '#059669',
    flagDark: '#064e3b',
    pole: '#8b6914',
    badge: '#0f3826',
    badgeAccent: '#10b981',
    label: '#0f3826',
  },
  群: {
    flag: '#b45309',
    flagDark: '#78350f',
    pole: '#8b6914',
    badge: '#3d3a2a',
    badgeAccent: '#fbbf24',
    label: '#3d3a2a',
  },
};

const SLOTS = 5;
// 槽位宽 2.4，高 1.6（梯形近大远小），间距 0.3
const SLOT_W = 2.4;
const SLOT_H = 1.6;
const SLOT_GAP = 0.35;

// ======================================================================
// 单面旗子 —— 简化小兵（一根旗杆 + 旗面）
// ======================================================================

function SingleFlag({
  faction,
  position,
  scale,
  seedIdx,
}: {
  faction: Faction;
  position: [number, number, number];
  scale: number;
  seedIdx: number;
}) {
  const m = FACTION_MAT[faction];
  const flagRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (flagRef.current) {
      const t = state.clock.getElapsedTime();
      flagRef.current.rotation.y = Math.sin(t * 1.5 + seedIdx) * 0.25;
      flagRef.current.rotation.z = Math.sin(t * 2.2 + seedIdx * 0.7) * 0.08;
    }
  });

  const poleH = 0.7 * scale;
  const flagW = 0.35 * scale;
  const flagH = 0.22 * scale;

  return (
    <group position={position} scale={scale}>
      {/* 旗杆 */}
      <Cylinder args={[0.015, 0.015, poleH, 6]} position={[0, poleH / 2, 0]}>
        <meshStandardMaterial color={m.pole} roughness={0.7} />
      </Cylinder>
      {/* 旗杆顶饰 */}
      <mesh position={[0, poleH + 0.02, 0]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* 旗面 */}
      <mesh
        ref={flagRef}
        position={[flagW / 2 + 0.015, poleH - flagH / 2 - 0.05, 0]}
      >
        <planeGeometry args={[flagW, flagH, 4, 2]} />
        <meshStandardMaterial
          color={m.flag}
          side={THREE.DoubleSide}
          roughness={0.55}
          emissive={m.flag}
          emissiveIntensity={0.12}
        />
      </mesh>
    </group>
  );
}

// ======================================================================
// 旗子群 —— 参考图的"兵马"（密集旗阵）
// ======================================================================

function ArmyFlags({ faction, bounds }: { faction: Faction; bounds: { w: number; h: number } }) {
  // 在梯形区域内随机排布 7~10 面旗子
  const flags = useMemo(() => {
    const list: { x: number; z: number; scale: number; seed: number }[] = [];
    const count = 9;
    // 3 排 × 3 列的近梯形分布
    for (let r = 0; r < 3; r++) {
      const rowProgress = r / 2; // 0 远 → 1 近
      const rowW = bounds.w * (0.55 + rowProgress * 0.3); // 远窄近宽
      const rowZ = bounds.h * (0.3 - rowProgress * 0.55);
      const perRow = r === 0 ? 2 : r === 1 ? 3 : 4;
      for (let c = 0; c < perRow; c++) {
        const colProgress = (perRow as number) === 1 ? 0.5 : c / (perRow - 1);
        const x = -rowW / 2 + rowW * colProgress;
        list.push({
          x: x + (Math.random() - 0.5) * 0.06,
          z: rowZ + (Math.random() - 0.5) * 0.06,
          scale: 0.85 + rowProgress * 0.3,
          seed: list.length * 1.7,
        });
      }
    }
    return list.slice(0, count);
  }, [bounds.w, bounds.h]);

  return (
    <group>
      {flags.map((f, i) => (
        <SingleFlag
          key={i}
          faction={faction}
          position={[f.x, 0.02, f.z]}
          scale={f.scale}
          seedIdx={f.seed}
        />
      ))}
    </group>
  );
}

// ======================================================================
// 武将徽章 —— 圆形 3D 头像标牌（左前角）
// ======================================================================

function CommanderMark({
  faction,
  position,
}: {
  faction: Faction;
  position: [number, number, number];
}) {
  const m = FACTION_MAT[faction];

  return (
    <group position={position} rotation={[-Math.PI / 2.2, 0, 0]}>
      {/* 圆形头像底盘 */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 24]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* 内圈阵营色 */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 24]} />
        <meshStandardMaterial color={m.badge} roughness={0.5} />
      </mesh>

      {/* 简化人像（正面对相机，z 轴朝外） */}
      <group position={[0, 0.06, 0]} rotation={[Math.PI / 2.2, 0, 0]}>
        {/* 帽子 */}
        <mesh position={[0, 0.08, 0]}>
          <coneGeometry args={[0.12, 0.1, 8]} />
          <meshStandardMaterial color={m.flagDark} roughness={0.6} />
        </mesh>
        {/* 头 */}
        <mesh position={[0, -0.02, 0]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#d4a574" roughness={0.6} />
        </mesh>
        {/* 肩 */}
        <mesh position={[0, -0.16, 0]}>
          <coneGeometry args={[0.15, 0.14, 8]} />
          <meshStandardMaterial color={m.flag} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

// ======================================================================
// 梯形牌位
// ======================================================================

function SlotTile({
  x,
  z,
  empty,
  isOver,
  highlight,
}: {
  x: number;
  z: number;
  empty: boolean;
  isOver: boolean;
  highlight: boolean;
}) {
  // 梯形几何：近大远小
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const nearW = SLOT_W * 0.5;
    const farW = SLOT_W * 0.38;
    const halfH = SLOT_H / 2;
    s.moveTo(-nearW, halfH);
    s.lineTo(nearW, halfH);
    s.lineTo(farW, -halfH);
    s.lineTo(-farW, -halfH);
    s.closePath();
    return s;
  }, []);

  const borderColor = isOver ? '#fde68a' : highlight ? '#d4af37' : '#8b6914';

  return (
    <group position={[x, 0.001, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* 牌位内部（半透明米黄） */}
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={isOver ? '#fde68a' : '#e8dcc0'}
          transparent
          opacity={isOver ? 0.35 : empty ? 0.15 : 0.22}
          roughness={0.9}
        />
      </mesh>
      {/* 金色描边（用 lineSegments） */}
      <lineSegments>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={borderColor} linewidth={2} transparent opacity={0.9} />
      </lineSegments>
      {/* 内层金边 */}
      <lineSegments position={[0, 0, 0.002]} scale={[0.94, 0.88, 1]}>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={borderColor} linewidth={1} transparent opacity={0.5} />
      </lineSegments>
      {empty && (
        <Text
          position={[0, 0, 0.003]}
          fontSize={0.16}
          color={isOver ? '#fde68a' : '#8b6914'}
          anchorX="center"
          anchorY="middle"
          fontStyle="italic"
        >
          {isOver ? `降 · ${Math.floor(Math.random() * 5) + 1}` : '空位'}
        </Text>
      )}
    </group>
  );
}

// ======================================================================
// 水墨地图底
// ======================================================================

function MapGround() {
  // 用一张过程生成的 canvas 贴图做水墨地图
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    // 羊皮纸底色
    const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 400);
    grad.addColorStop(0, '#e8dcc0');
    grad.addColorStop(0.5, '#d4b483');
    grad.addColorStop(1, '#a89670');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // 水墨河流（浅灰曲线）
    ctx.strokeStyle = 'rgba(80, 60, 40, 0.22)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const y0 = 60 + i * 90;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= 512; x += 40) {
        const y = y0 + Math.sin(x * 0.015 + i) * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 远山轮廓（浅灰三角）
    ctx.fillStyle = 'rgba(90, 70, 50, 0.18)';
    for (let i = 0; i < 8; i++) {
      const cx = i * 70 + 20;
      const cy = 40 + (i % 3) * 10;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy + 20);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 15, cy + 8);
      ctx.lineTo(cx + 35, cy);
      ctx.lineTo(cx + 55, cy + 20);
      ctx.closePath();
      ctx.fill();
    }
    // 随机墨点
    ctx.fillStyle = 'rgba(60, 40, 20, 0.15)';
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 3 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  return (
    <Plane args={[20, 12]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <meshStandardMaterial
        map={texture}
        roughness={0.95}
        metalness={0}
        color="#e8dcc0"
      />
    </Plane>
  );
}

// ======================================================================
// 3D 场景主体
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
    camera.position.set(0, 4.5, 4);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // 5 槽位布局：2 行（上 2 下 3 或参考图的 1 行 5 列）
  // 参考图是 2×3 格子。我们用 2 行：
  //   上排 2 位（z = -0.9）
  //   下排 3 位（z = +0.9）
  // 但 PRD 要求 5 槽。用 1 行 5 列斜摆更贴近参考图的横向感
  const xs = useMemo(() => {
    return Array.from({ length: SLOTS }, (_, i) => {
      const step = SLOT_W * 0.55 + SLOT_GAP;
      return (i - (SLOTS - 1) / 2) * step;
    });
  }, []);

  return (
    <>
      {/* 灯光 */}
      <ambientLight intensity={0.85} color="#fff5e0" />
      <directionalLight
        position={[3, 6, 3]}
        intensity={0.6}
        color="#fff2cc"
      />
      <directionalLight position={[-3, 4, 2]} intensity={0.3} color="#e8dcc0" />

      {/* 水墨地图 */}
      <MapGround />

      {/* 5 个槽位 */}
      {xs.map((x, i) => (
        <SlotTile
          key={i}
          x={x}
          z={0}
          empty={!cards[i]}
          isOver={hovered === i}
          highlight={highlight}
        />
      ))}

      {/* 旗子兵阵 */}
      {cards.map((c, i) =>
        c ? (
          <group key={c.id} position={[xs[i], 0, 0]}>
            <ArmyFlags faction={c.faction} bounds={{ w: SLOT_W * 0.7, h: SLOT_H }} />
          </group>
        ) : null,
      )}

      {/* 武将圆徽章（左前角） */}
      {cards.map((c, i) =>
        c ? (
          <CommanderMark
            key={`c-${c.id}`}
            faction={c.faction}
            position={[xs[i] - SLOT_W * 0.28, 0.02, SLOT_H * 0.48]}
          />
        ) : null,
      )}

      {/* 战力数字（悬浮在牌位上方） */}
      {cards.map((c, i) =>
        c ? (
          <group key={`p-${c.id}`} position={[xs[i] + SLOT_W * 0.22, 0.02, SLOT_H * 0.48]} rotation={[-Math.PI / 2.2, 0, 0]}>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[0.45, 0.22]} />
              <meshStandardMaterial color="#1a0f08" />
            </mesh>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.47, 0.24]} />
              <meshBasicMaterial color="#d4af37" transparent opacity={0.35} />
            </mesh>
            <Text
              position={[0, 0, 0.003]}
              fontSize={0.13}
              color="#fde68a"
              anchorX="center"
              anchorY="middle"
              outlineColor="#000"
              outlineWidth={0.006}
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
// 主组件（带交互叠层）
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
            <span
              className={['tabular-nums', evalResult.isFlush ? 'text-gold-grad' : 'text-amber-200/40'].join(' ')}
            >
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

      {/* 3D Canvas + HTML 交互叠层 */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 7', minHeight: 200 }}>
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
              position={[0, 4.5, 4]}
              zoom={90}
              near={0.1}
              far={100}
            />
            <Scene cards={cards} hovered={hovered} highlight={highlight} />
          </Canvas>
        </div>

        {/* HTML 拖拽叠层 */}
        <div className="absolute inset-0 grid grid-cols-5 gap-0 pointer-events-none">
          {cards.map((c, i) => (
            <SlotInteractionLayer
              key={i}
              teamIndex={teamIndex}
              slotIndex={i}
              card={c}
              onHoverChange={(h) => setHovered((prev) => (h ? i : prev === i ? null : prev))}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ======================================================================
// 交互层（HTML 叠加）
// ======================================================================

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
