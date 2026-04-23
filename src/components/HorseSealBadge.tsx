import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HORSE_SEALS } from '../horseSeals';
import type { HorseSeal } from '../types';

interface Props {
  seal: HorseSeal;
  /** 印章大小（px，正方形） */
  size?: number;
  /** 印章旋转角度 */
  rotate?: number;
  /** 自定义字体大小（默认按 size 推算） */
  fontSize?: number;
  /** 额外 className（外层容器） */
  className?: string;
  /** 容器额外 style */
  style?: React.CSSProperties;
}

/**
 * 统一的神马印章徽章 + 悬浮 tooltip。
 * tooltip 通过 React Portal 渲染到 document.body，使用 position:fixed，
 * 因此不会被任何父元素的 overflow/transform/z-index 裁剪或遮挡。
 */
export function HorseSealBadge({
  seal,
  size = 28,
  rotate = -6,
  fontSize,
  className,
  style,
}: Props) {
  const info = HORSE_SEALS[seal];
  const anchorRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!hover || !anchorRef.current) return;
    // 初始测量
    setAnchorRect(anchorRef.current.getBoundingClientRect());
    // 跟随滚动/窗口变化
    const update = () => {
      if (!anchorRef.current) return;
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [hover]);

  const fs = fontSize ?? Math.max(11, Math.round(size * 0.46));

  return (
    <>
      <div
        ref={anchorRef}
        className={className}
        style={{ position: 'relative', display: 'inline-block', ...style }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div
          className="flex items-center justify-center font-kai font-black"
          style={{
            width: size,
            height: size,
            fontSize: fs,
            color: '#fef2f2',
            letterSpacing: 0,
            background: `radial-gradient(circle at 30% 25%, ${info.color}dd 0%, ${info.color}aa 55%, ${info.color}44 100%)`,
            border: `2px solid ${info.color}`,
            borderRadius: 3,
            boxShadow: `0 0 8px ${info.color}aa, inset 0 1px 0 rgba(255,240,200,0.35), inset 0 -1px 2px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.85)`,
            textShadow: '0 1px 1px rgba(0,0,0,0.95)',
            cursor: 'help',
            transform: `rotate(${rotate}deg)`,
          }}
        >
          {info.sealChar}
        </div>
      </div>

      {hover && anchorRect && typeof document !== 'undefined' &&
        createPortal(
          <HorseSealTooltip anchorRect={anchorRect} info={info} />,
          document.body,
        )}
    </>
  );
}

function HorseSealTooltip({
  anchorRect,
  info,
}: {
  anchorRect: DOMRect;
  info: typeof HORSE_SEALS[HorseSeal];
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{
    left: number;
    top: number;
    orientation: 'top' | 'bottom';
  } | null>(null);

  useLayoutEffect(() => {
    if (!tipRef.current) return;
    const tip = tipRef.current.getBoundingClientRect();
    const W = 240;
    const H = tip.height || 180;
    const margin = 10;

    // 默认显示在 anchor 上方，空间不够则切到下方
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    let left = anchorCenterX - W / 2;
    // clamp 到视口
    left = Math.max(8, Math.min(window.innerWidth - W - 8, left));
    let orientation: 'top' | 'bottom' = 'top';
    let top = anchorRect.top - H - margin;
    if (top < 8) {
      orientation = 'bottom';
      top = anchorRect.bottom + margin;
    }
    setPlacement({ left, top, orientation });
  }, [anchorRect]);

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;

  return (
    <div
      ref={tipRef}
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left: placement?.left ?? anchorCenterX - 120,
        top: placement?.top ?? anchorRect.top - 190,
        width: 240,
        zIndex: 99999,
        background: 'linear-gradient(180deg, #2a1810 0%, #1a0f08 100%)',
        border: `1.5px solid ${info.color}`,
        borderRadius: 6,
        boxShadow: `0 0 16px ${info.color}88, 0 8px 18px rgba(0,0,0,0.95)`,
        padding: '10px 12px',
        fontFamily: 'STKaiti, serif',
        opacity: placement ? 1 : 0, // 首帧测量完成前隐藏，避免闪
        transition: 'opacity 0.08s',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="flex items-center justify-center font-black text-[14px]"
          style={{
            width: 24,
            height: 24,
            color: '#fff',
            background: info.color,
            borderRadius: 3,
            border: '1px solid rgba(0,0,0,0.5)',
            textShadow: '0 1px 1px rgba(0,0,0,0.8)',
          }}
        >
          {info.sealChar}
        </span>
        <span
          className="text-[15px] font-black tracking-widest"
          style={{
            background: `linear-gradient(180deg, #fff5cc 0%, ${info.color} 75%, #4a1010 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {info.name}
        </span>
      </div>
      <div
        className="text-[10px] tracking-widest font-black mb-2"
        style={{ color: info.color }}
      >
        {info.sealName}
      </div>
      <div className="text-[11.5px] text-amber-100/90 leading-snug mb-2">
        {info.effect}
      </div>
      <div className="text-[10px] text-amber-200/70 leading-snug italic">
        <span className="text-amber-300 not-italic">触发：</span>
        {info.trigger}
      </div>
      <div className="text-[10.5px] text-amber-100/70 leading-snug mt-1.5 border-t border-amber-900/40 pt-1.5">
        {info.detail}
      </div>
      {/* 小三角指向 anchor */}
      <div
        style={{
          position: 'absolute',
          left: Math.max(
            10,
            Math.min(
              230 - 12,
              anchorCenterX - (placement?.left ?? anchorCenterX - 120) - 6,
            ),
          ),
          [placement?.orientation === 'bottom' ? 'top' : 'bottom']: -6,
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          [placement?.orientation === 'bottom'
            ? 'borderBottom'
            : 'borderTop']: `6px solid ${info.color}`,
        }}
      />
    </div>
  );
}
