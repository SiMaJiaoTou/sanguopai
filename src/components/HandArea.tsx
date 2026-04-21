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
        'relative rounded-lg wood-panel bronze-border rivets min-h-[180px]',
        isOver ? 'wood-light' : 'wood-dark',
        'transition-colors',
      ].join(' ')}
      style={
        isOver
          ? {
              boxShadow:
                '0 0 20px rgba(212,175,55,0.4), 0 8px 20px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,200,120,0.3)',
            }
          : undefined
      }
    >
      <div className="rivet-b" />

      <div className="flex items-center justify-between mb-3 ink-underline relative">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-base">㊉</span>
          <div className="text-gold-grad font-black tracking-[0.25em] font-kai">
            待 命 武 將
          </div>
        </div>
        <div className="text-[10px] text-amber-200/60 tracking-widest italic">
          · 共 <span className="text-gold-grad font-black tabular-nums">{cards.length}</span> 員 · 拖拽出陣 ·
        </div>
      </div>

      <div className="flex flex-wrap gap-3 relative">
        <AnimatePresence>
          {cards.map((c) => (
            <CardView key={c.id} card={c} canRedraw={canRedraw} onRedraw={onRedraw} />
          ))}
        </AnimatePresence>
        {cards.length === 0 && (
          <div className="text-amber-100/40 text-sm py-10 px-4 italic tracking-widest w-full text-center">
            · 暫無待命武將 · 請至主公府招募 ·
          </div>
        )}
      </div>
    </div>
  );
}
