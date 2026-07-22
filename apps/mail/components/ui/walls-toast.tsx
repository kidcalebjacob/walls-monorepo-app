"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Check,
  X,
  AlertTriangle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

/** `negative` = intentional off/remove (pause, delete, unlink). `error` = something failed. */
export type WallsToastVariant =
  | "success"
  | "negative"
  | "error"
  | "warning"
  | "loading";

const RED_APPEARANCE = {
  ripple: "bg-red-200",
  bg: "bg-red-100",
  color: "text-red-700",
  sparkle: false,
} as const;

const RED_WRAPPER =
  "bg-red-50 rounded-2xl shadow-lg p-4 border border-red-300";

interface WallsToastContentProps {
  variant: WallsToastVariant;
  title: string;
  description?: string;
  icon?: LucideIcon;
}

const variantDefaults: Record<
  WallsToastVariant,
  { Icon: LucideIcon; ripple: string; bg: string; color: string; sparkle: boolean }
> = {
  success: {
    Icon: Check,
    ripple: "bg-kenoo-yellow",
    bg: "bg-kenoo-yellow",
    color: "text-neutral-800",
    sparkle: true,
  },
  negative: {
    Icon: X,
    ...RED_APPEARANCE,
  },
  error: {
    Icon: X,
    ...RED_APPEARANCE,
  },
  warning: {
    Icon: AlertTriangle,
    ripple: "bg-amber-200",
    bg: "bg-amber-100",
    color: "text-amber-700",
    sparkle: false,
  },
  loading: {
    Icon: Loader2,
    ripple: "bg-kenoo-yellow/30",
    bg: "bg-kenoo-yellow/20",
    color: "text-neutral-800",
    sparkle: false,
  },
};

export function WallsToastContent({ variant, title, description, icon: IconOverride }: WallsToastContentProps) {
  const { Icon: DefaultIcon, ripple, bg, color, sparkle } = variantDefaults[variant];
  const Icon = IconOverride ?? DefaultIcon;
  const isLoading = variant === "loading";

  return (
    <div className="relative flex items-center gap-3">
      <motion.div
        initial={{ scale: 0, rotate: isLoading ? 0 : -45 }}
        animate={
          isLoading
            ? { scale: 1 }
            : { scale: [0, 1.2, 1], rotate: [-45, 10, 0] }
        }
        transition={{ duration: 0.6, times: [0, 0.6, 1], ease: "easeOut" }}
        className="relative flex shrink-0 items-center justify-center"
      >
        {!isLoading && (
          <motion.div
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute inset-0 rounded-full ${ripple}`}
          />
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: isLoading ? 0 : 0.2, duration: 0.3 }}
          className={`relative z-10 rounded-full p-2 ${bg}`}
        >
          <Icon
            className={`h-4 w-4 ${color} ${isLoading ? "animate-spin" : ""}`}
          />
        </motion.div>
      </motion.div>

      <div className="flex min-w-0 flex-col pr-6">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="font-semibold text-sm text-neutral-900"
        >
          {title}
        </motion.span>
        {description && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-xs text-neutral-600"
          >
            {description}
          </motion.span>
        )}
      </div>

      {sparkle && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: [0, 180] }}
          transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
          className="absolute right-2"
        >
          <div className="text-lg text-kenoo-yellow">✨</div>
        </motion.div>
      )}
    </div>
  );
}

const SUCCESS_WRAPPER =
  "bg-white rounded-2xl shadow-lg p-4 border border-neutral-200";

const WRAPPER_BY_VARIANT: Record<WallsToastVariant, string> = {
  success: SUCCESS_WRAPPER,
  /** Same card as success — red is only on the icon circle. */
  negative: SUCCESS_WRAPPER,
  error: RED_WRAPPER,
  warning: "bg-amber-50 rounded-2xl shadow-lg p-4 border border-amber-300",
  loading: "bg-white rounded-2xl shadow-lg p-4 border border-neutral-200",
};
const DEFAULT_DURATION = 3000;

interface WallsToastOptions {
  description?: string;
  icon?: LucideIcon;
  duration?: number;
}

function show(variant: WallsToastVariant, title: string, opts: WallsToastOptions = {}) {
  toast.custom(
    () => (
      <div className={WRAPPER_BY_VARIANT[variant]}>
        <WallsToastContent
          variant={variant}
          title={title}
          description={opts.description}
          icon={opts.icon}
        />
      </div>
    ),
    { duration: opts.duration ?? DEFAULT_DURATION },
  );
}

export const wallsToast = {
  success: (title: string, opts?: WallsToastOptions | string) => {
    if (typeof opts === "string") {
      show("success", title, { description: opts });
    } else {
      show("success", title, opts);
    }
  },
  /** Pause, delete, remove, deactivate, unlink — action succeeded, state went “off”. */
  negative: (title: string, opts?: WallsToastOptions | string) => {
    if (typeof opts === "string") {
      show("negative", title, { description: opts });
    } else {
      show("negative", title, opts);
    }
  },
  error: (title: string, opts?: WallsToastOptions | string) => {
    if (typeof opts === "string") {
      show("error", title, { description: opts });
    } else {
      show("error", title, opts);
    }
  },
  warning: (title: string, opts?: WallsToastOptions | string) => {
    if (typeof opts === "string") {
      show("warning", title, { description: opts });
    } else {
      show("warning", title, opts);
    }
  },
  loading: (title: string, opts?: WallsToastOptions | string) => {
    if (typeof opts === "string") {
      show("loading", title, { description: opts });
    } else {
      show("loading", title, opts);
    }
  },
};
