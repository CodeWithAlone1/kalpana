/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";

interface WaveformProps {
  isActive: boolean;
  color?: string;
}

export function Waveform({ isActive, color = "#ec4899" }: WaveformProps) {
  const bars = Array.from({ length: 12 });

  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {bars.map((_, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full"
          style={{ backgroundColor: color }}
          animate={
            isActive
              ? {
                  height: [10, 40, 15, 35, 10],
                }
              : { height: 4 }
          }
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.05,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
