import { useDroppable } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import type { Card } from '../types';
import { CardView } from './CardView';

interface Props {
  cards: Card[];
  canRedraw: boolean;
  onRedraw: (id: string) => void;
}

export function HandArea({ cards, canRedraw, onRedraw }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'hand-area',
    data: { type: 'hand' },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded-2xl p-4 min-h-[160px]',
        'border bg-black/30',
        isOver ? 'border-gold bg-gold/10' : 'border-white/10',
        'transition-colors',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-gold font-bold">📜 手牌区</div>
        <div className="text-xs text-white/50">共 {cards.length} 张 · 可拖拽至军团槽</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <AnimatePresence>
          {cards.map((c) => (
            <CardView key={c.id} card={c} canRedraw={canRedraw} onRedraw={onRedraw} />
          ))}
        </AnimatePresence>
        {cards.length === 0 && (
          <div className="text-white/30 text-sm py-8 px-4">（手牌区空）</div>
        )}
      </div>
    </div>
  );
}
