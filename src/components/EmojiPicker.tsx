import React, { useState } from 'react';
import { motion } from 'motion/react';
import { EMOJI_CATEGORIES } from '../utils/emojis';
import { X } from 'lucide-react';

interface EmojiPickerProps {
  isOpen: boolean;
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onSelectEmoji,
  onClose,
  className = ''
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.name === activeCategory) || EMOJI_CATEGORIES[0];
  const allFilteredEmojis = searchQuery.trim()
    ? Array.from(new Set(EMOJI_CATEGORIES.flatMap((c) => c.emojis)))
    : currentCategory.emojis;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.15 }}
      className={`bg-[#141419] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col w-[320px] sm:w-[350px] max-h-[380px] z-40 ${className}`}
    >
      {/* Category Tabs Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-2 py-1.5 bg-[#0e0e12]">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => {
                setActiveCategory(cat.name);
                setSearchQuery('');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono-tech transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === cat.name && !searchQuery
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-zinc-500 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid of Emojis */}
      <div className="flex-1 p-2 overflow-y-auto max-h-[290px] grid grid-cols-7 sm:grid-cols-8 gap-1 auto-rows-max">
        {allFilteredEmojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            className="w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-zinc-800/80 active:scale-125 transition-transform cursor-pointer select-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
