"use client";

import { motion } from "framer-motion";
import { Pause, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type UserStatusToastVariant = "active" | "suspended" | "deactivated";

const STATUS_TOAST_CONFIG: Record<
  UserStatusToastVariant,
  { title: string; Icon: LucideIcon }
> = {
  active: { title: "Agent activated", Icon: UserCheck },
  suspended: { title: "Agent suspended", Icon: Pause },
  deactivated: { title: "Agent deactivated", Icon: UserX },
};

interface AnimatedUserStatusToastProps {
  variant: UserStatusToastVariant;
  userName?: string;
}

export function AnimatedUserStatusToast({ variant, userName }: AnimatedUserStatusToastProps) {
  const { title, Icon } = STATUS_TOAST_CONFIG[variant];
  const isRestrictive = variant === "suspended" || variant === "deactivated";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3"
    >
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
          className={cn(
            "absolute inset-0 rounded-full",
            isRestrictive ? "bg-red-400" : "bg-kenoo-yellow",
          )}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className={cn(
            "relative z-10 rounded-full p-2",
            isRestrictive ? "bg-red-400" : "bg-kenoo-yellow",
          )}
        >
          <Icon className="h-4 w-4 text-neutral-800" />
        </motion.div>
      </motion.div>

      <div className="flex flex-col">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-sm font-semibold text-neutral-900"
        >
          {title}
        </motion.span>
        {userName && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-xs text-neutral-600"
          >
            {userName}
          </motion.span>
        )}
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
        <div className={cn(
            "text-lg",
            isRestrictive ? "text-red-400" : "text-kenoo-yellow",
          )}>✨</div>
      </motion.div>
    </motion.div>
  );
}
