"use client";

import * as React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";

import { kenooColors } from "@walls/ui/colors";
import { cn } from "@/lib/utils";

import { MiniCalendar } from "@/components/ui/mini-calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type FloatingLabelDatePickerProps = {
  label: string;
  value?: Date | null;
  onChange: (date: Date | null) => void;
  displayFormat?: string;
  disabled?: boolean;
  /** Days disabled in the calendar (react-day-picker matcher). */
  disabledDays?: React.ComponentProps<typeof MiniCalendar>["disabled"];
  defaultMonth?: Date;
  showClearButton?: boolean;
  clearLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  className?: string;
  containerClassName?: string;
  contentClassName?: string;
  closeOnSelect?: boolean;
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

export function FloatingLabelDatePicker({
  label,
  value = null,
  onChange,
  displayFormat = "MMM d, yyyy",
  disabled = false,
  disabledDays,
  defaultMonth,
  showClearButton = true,
  clearLabel = "Clear date",
  open,
  onOpenChange,
  align = "start",
  className,
  containerClassName,
  contentClassName,
  closeOnSelect = true,
}: FloatingLabelDatePickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const hasValue = value instanceof Date && !Number.isNaN(value.getTime());
  const floated = isOpen || hasValue;
  const accentColor = isOpen
    ? KENOO_SKY
    : floated
      ? NEUTRAL_500
      : NEUTRAL_400;

  return (
    <div className={cn("pt-2", containerClassName)}>
      <Popover modal={false} open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <motion.button
            type="button"
            disabled={disabled}
            aria-label={label}
            className={cn(
              "relative flex h-12 w-full cursor-pointer items-center rounded-2xl border bg-kenoo-white px-4 text-left text-sm font-light leading-none text-foreground outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            initial={false}
            animate={{
              borderColor: isOpen ? KENOO_SKY : NEUTRAL_200,
            }}
            transition={COLOR_TRANSITION}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                !hasValue && "text-transparent",
              )}
            >
              {hasValue ? format(value, displayFormat) : label}
            </span>
            <motion.span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3 flex origin-left items-center px-1.5 font-light",
                floated ? "bg-kenoo-white" : "bg-transparent",
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
            </motion.span>
          </motion.button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "w-auto rounded-3xl border-0 p-0 shadow-[0_14px_32px_rgba(0,0,0,0.18)]",
            contentClassName,
          )}
          align={align}
        >
          <MiniCalendar
            showClearButton={showClearButton}
            clearLabel={clearLabel}
            selected={hasValue ? value ?? undefined : undefined}
            disabled={disabledDays}
            defaultMonth={defaultMonth ?? (hasValue ? value ?? undefined : undefined)}
            onSelect={(date) => {
              onChange(date ?? null);
              if (closeOnSelect) setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
