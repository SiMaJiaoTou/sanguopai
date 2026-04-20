import { useDroppable } from '@dnd-kit/core';
import type { Card } from '../types';
import { CardView } from './CardView';

interface SlotProps {
  teamIndex: number;
  slotIndex: number;
  card: Card | null;
  canRedraw: boolean;
  onRedraw: (id: string) => void;
}

export function TeamSlot({ teamIndex, slotIndex, card, canRedraw, onRedraw }: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team-${teamIndex}-${slotIndex}`,
    data: { type: 'team', teamIndex, slotIndex },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'w-[96px] h-[136px] shrink-0 rounded-xl flex items-center justify-center',
        'border-2 border-dashed',
        isOver ? 'border-gold bg-gold/10' : 'border-white/20 bg-white/5',
        'transition-colors',
      ].join(' ')}
    >
      {card ? (
        <CardView card={card} canRedraw={canRedraw} onRedraw={onRedraw} />
      ) : (
        <span className="text-xs text-white/40">空位 {slotIndex + 1}</span>
      )}
    </div>
  );
}
