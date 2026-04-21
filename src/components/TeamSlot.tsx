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
        'shrink-0 rounded-lg flex items-center justify-center relative',
        isOver ? 'border-2 border-amber-400' : 'border-2 border-amber-900',
        'transition-colors',
      ].join(' ')}
    >
      {!card && (
        <div
          className="absolute inset-0 rounded-md"
          style={{
            background:
              'linear-gradient(135deg, rgba(26,15,8,0.8) 0%, rgba(58,36,24,0.6) 50%, rgba(26,15,8,0.8) 100%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(120,80,40,0.3)',
          }}
        />
      )}
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
          className="text-amber-100/40 italic font-kai tracking-widest relative"
          style={{ fontSize: width && width < 80 ? 10 : 12 }}
        >
          空 {slotIndex + 1}
        </span>
      )}
    </div>
  );
}
