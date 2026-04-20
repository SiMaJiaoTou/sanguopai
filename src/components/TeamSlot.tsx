import { useDroppable } from '@dnd-kit/core';
import type { Card } from '../types';
import { CardView } from './CardView';

interface SlotProps {
  teamIndex: number;
  slotIndex: number;
  card: Card | null;
  canRedraw: boolean;
  onRedraw: (id: string) => void;
  width?: number;
  height?: number;
}

export function TeamSlot({
  teamIndex,
  slotIndex,
  card,
  canRedraw,
  onRedraw,
  width,
  height,
}: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${teamIndex}-${slotIndex}`,
    data: { type: 'team', teamIndex, slotIndex },
  });

  const style: React.CSSProperties = {
    width: width ? `${width}px` : 96,
    height: height ? `${height}px` : 136,
    flex: '0 0 auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'shrink-0 rounded-xl flex items-center justify-center',
        'border-2 border-dashed',
        isOver ? 'border-gold bg-gold/10' : 'border-white/20 bg-white/5',
        'transition-colors',
      ].join(' ')}
    >
      {card ? (
        <CardView
          card={card}
          canRedraw={canRedraw}
          onRedraw={onRedraw}
          width={width}
          height={height}
        />
      ) : (
        <span
          className="text-white/40"
          style={{ fontSize: width && width < 80 ? 10 : 12 }}
        >
          空位 {slotIndex + 1}
        </span>
      )}
    </div>
  );
}
