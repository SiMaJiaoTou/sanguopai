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
          className="fixed top-20 left-1/2 z-50 px-4 py-2 rounded-xl bg-black/80 backdrop-blur border border-gold/40 shadow-glow text-gold text-sm font-bold max-w-[90vw] text-center"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
