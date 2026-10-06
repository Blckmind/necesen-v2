import React from 'react';
import { motion } from 'motion/react';

interface KhamiLogoProps {
  className?: string;
  size?: number | string;
  animated?: boolean;
  strokeWidth?: number;
}

export const KhamiLogo: React.FC<KhamiLogoProps> = ({
  className = 'w-32 h-32',
  animated = false,
  strokeWidth = 5.5
}) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Upright Square (corners at +/-56.57 from center (100,100), size 113.14) */}
        {animated ? (
          <motion.rect
            x="43.43"
            y="43.43"
            width="113.14"
            height="113.14"
            fill="none"
            stroke="#ffffff"
            strokeWidth={strokeWidth}
            strokeLinejoin="miter"
            strokeMiterlimit="10"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
          />
        ) : (
          <rect
            x="43.43"
            y="43.43"
            width="113.14"
            height="113.14"
            fill="none"
            stroke="#ffffff"
            strokeWidth={strokeWidth}
            strokeLinejoin="miter"
            strokeMiterlimit="10"
          />
        )}
        {/* Diamond (Rotated Square by 45 degrees, corners at (100,20), (180,100), (100,180), (20,100)) */}
        {animated ? (
          <motion.polygon
            points="100,20 180,100 100,180 20,100"
            fill="none"
            stroke="#ffffff"
            strokeWidth={strokeWidth}
            strokeLinejoin="miter"
            strokeMiterlimit="10"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.15, ease: 'easeInOut' }}
          />
        ) : (
          <polygon
            points="100,20 180,100 100,180 20,100"
            fill="none"
            stroke="#ffffff"
            strokeWidth={strokeWidth}
            strokeLinejoin="miter"
            strokeMiterlimit="10"
          />
        )}
      </svg>
    </div>
  );
};
