"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface AnimatedTaskCompleteToastProps {
  taskTitle?: string;
  count?: number;
}

export function AnimatedTaskCompleteToast({
  taskTitle,
  count = 1,
}: AnimatedTaskCompleteToastProps) {
  const headline =
    count > 1 ? `${count} tasks completed` : "Task completed";

  return (
    <div className="relative flex items-center gap-3">
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{
          scale: [0, 1.2, 1],
          rotate: [-45, 10, 0],
        }}
        transition={{
          duration: 0.6,
          times: [0, 0.6, 1],
          ease: "easeOut",
        }}
        className="relative flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{
            scale: [1, 2.5],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
          className="absolute inset-0 rounded-full bg-kenoo-yellow"
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="relative z-10 rounded-full bg-kenoo-yellow p-2"
        >
          <Check className="h-4 w-4 text-neutral-800" strokeWidth={2.5} />
        </motion.div>
      </motion.div>

      <div className="flex flex-col pr-6">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-sm font-semibold text-neutral-900"
        >
          {headline}
        </motion.span>
        {count === 1 && taskTitle ? (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-xs text-neutral-600"
          >
            {taskTitle}
          </motion.span>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: [0, 1, 0],
          scale: [0, 1, 0],
          rotate: [0, 180],
        }}
        transition={{
          delay: 0.5,
          duration: 0.6,
          ease: "easeOut",
        }}
        className="absolute right-2"
      >
        <div className="text-lg text-kenoo-yellow">✨</div>
      </motion.div>
    </div>
  );
}
