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
        'relative rounded-2xl p-4 min-h-[170px] scroll-paper',
        'bg-gradient-to-b from-[#1f1208]/80 to-[#0f0a05]/90',
        'border-2 transition-colors',
        isOver ? 'border-gold shadow-glow bg-gold/5' : 'border-amber-900/50',
      ].join(' ')}
    >
      {/* 卷轴上下金线 */}
      <div className="absolute top-2 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="absolute bottom-2 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-red-400">㊉</span>
          <div className="text-gold-grad font-bold tracking-widest font-kai">待命武将</div>
        </div>
        <div className="text-[10px] text-amber-200/50 tracking-widest">
          · 共 <span className="text-gold tabular-nums">{cards.length}</span> 员 · 拖拽出战 ·
        </div>
      </div>
      <div className="flex flex-wrap gap-3 relative">
        <AnimatePresence>
          {cards.map((c) => (
            <CardView key={c.id} card={c} canRedraw={canRedraw} onRedraw={onRedraw} />
          ))}
        </AnimatePresence>
        {cards.length === 0 && (
          <div className="text-amber-100/30 text-sm py-8 px-4 italic tracking-widest w-full text-center">
            · 暂无待命武将，请至主公府招募 ·
          </div>
        )}
      </div>
    </div>
  );
}
