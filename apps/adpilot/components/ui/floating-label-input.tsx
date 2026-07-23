"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { kenooColors } from "@walls/ui/colors";
import { cn } from "@walls/utils";

export type FloatingLabelInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "placeholder" | "id"
> & {
  label: string;
  id?: string;
  containerClassName?: string;
};

const NEUTRAL_200 = "#e5e5e5";
const NEUTRAL_400 = "#a3a3a3";
const NEUTRAL_500 = "#737373";
const KENOO_SKY = kenooColors.sky.DEFAULT;

const POSITION_TRANSITION = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.6,
};

const COLOR_TRANSITION = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const FloatingLabelInput = React.forwardRef<
  HTMLInputElement,
  FloatingLabelInputProps
>(function FloatingLabelInput(
  {
    label,
    className,
    containerClassName,
    value,
    defaultValue,
    onFocus,
    onBlur,
    id,
    disabled,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  const resolvedValue =
    value !== undefined
      ? value
      : defaultValue !== undefined
        ? defaultValue
        : "";
  const hasValue = String(resolvedValue ?? "").length > 0;
  const floated = focused || hasValue;

  const accentColor = focused
    ? KENOO_SKY
    : floated
      ? NEUTRAL_500
      : NEUTRAL_400;

  return (
    <div className={cn("pt-2", containerClassName)}>
      <div className="relative">
        <motion.input
          ref={ref}
          id={inputId}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          aria-label={label}
          className={cn(
            "h-12 w-full rounded-2xl border bg-kenoo-white px-4 text-sm font-light leading-none text-foreground outline-none placeholder:text-transparent focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          initial={false}
          animate={{
            borderColor: focused ? KENOO_SKY : NEUTRAL_200,
          }}
          transition={COLOR_TRANSITION}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        <motion.label
          htmlFor={inputId}
          className={cn(
            "absolute left-3 flex origin-left cursor-text items-center px-1.5 font-light",
            floated ? "bg-kenoo-white" : "bg-transparent",
            disabled && "opacity-50",
          )}
          initial={false}
          animate={{
            top: floated ? 0 : "50%",
            y: "-50%",
            scale: floated ? 0.78 : 1,
            color: accentColor,
          }}
          transition={{
            top: POSITION_TRANSITION,
            y: POSITION_TRANSITION,
            scale: POSITION_TRANSITION,
            color: COLOR_TRANSITION,
          }}
        >
          <span className="text-sm leading-none">{label}</span>
        </motion.label>
      </div>
    </div>
  );
});
