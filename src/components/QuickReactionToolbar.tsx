import React from 'react';
import { motion } from 'motion/react';
import { QUICK_REACTIONS } from '../utils/emojis';
import { Plus } from 'lucide-react';

interface QuickReactionToolbarProps {
  isOpen: boolean;
  onReact: (emoji: string) => void;
  onOpenMore: () => void;
  onClose: () => void;
  isSender: boolean;
  currentReaction?: string;
}

export const QuickReactionToolbar: React.FC<QuickReactionToolbarProps> = ({
  isOpen,
  onReact,
  onOpenMore,
  onClose,
  isSender,
  currentReaction
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 10 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`absolute -top-12 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#16161c] border border-zinc-700/80 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md ${
        isSender ? 'right-0' : 'left-0'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji) => {
        const isSelected = currentReaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onReact(emoji);
              onClose();
            }}
            className={`w-8 h-8 flex items-center justify-center text-lg rounded-full hover:scale-130 active:scale-95 transition-transform cursor-pointer ${
              isSelected ? 'bg-zinc-800 ring-2 ring-[#00ff66]' : 'hover:bg-zinc-800/80'
            }`}
          >
            {emoji}
          </button>
        );
      })}
      {/* Plus button to open full emoji reaction picker */}
      <button
        type="button"
        onClick={() => {
          onOpenMore();
          onClose();
        }}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
        title="Daha çox emoji"
      >
        <Plus className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
