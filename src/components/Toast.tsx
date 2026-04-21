import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  message: string | null;
  onClose: () => void;
}

export function Toast({ message, onClose }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: -30, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: -30, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className={[
            'fixed top-20 left-1/2 z-50',
            'px-5 py-2.5 rounded-lg wood-dark bronze-border',
            'text-gold-grad text-sm font-black max-w-[90vw] text-center font-kai tracking-widest',
          ].join(' ')}
          style={{
            boxShadow:
              '0 8px 24px rgba(0,0,0,0.8), 0 0 16px rgba(212,175,55,0.4), inset 0 1px 2px rgba(255,200,120,0.35)',
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
