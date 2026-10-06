import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { KhamiLogo } from './KhamiLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Exact duration matching the progress bar completion (0.75s delay + 1.8s duration = 2.55s)
    const timer = setTimeout(() => {
      setIsCompleted(true);
      onComplete();
    }, 2650);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      id="splash-screen-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white select-none overflow-hidden"
    >
      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        {/* Geometric Studio Logo as uploaded by user */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <KhamiLogo
            className="w-32 h-32 sm:w-40 sm:h-40 drop-shadow-[0_0_20px_rgba(255,255,255,0.12)]"
            animated={true}
            strokeWidth={5}
          />
        </motion.div>

        {/* Title: "Khami Studios" in Montserrat font, white color */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.8, ease: 'easeOut' }}
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[0.25em] font-montserrat text-white uppercase pl-[0.25em]">
            Khami Studios
          </h1>
        </motion.div>

        {/* Minimalist Loading Bar - Unskippable until 100% full */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-12 w-36 sm:w-48 h-[2px] bg-zinc-900 rounded-full overflow-hidden"
        >
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.8, delay: 0.75, ease: 'easeInOut' }}
            className="h-full bg-white"
          />
        </motion.div>
      </div>
    </motion.div>
  );
};
