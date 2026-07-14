"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@walls/utils";

const BOUNCY_EASING = "cubic-bezier(0.68, -0.55, 0.265, 1.55)";

type SwitchSize = "sm" | "md" | "lg";

const SWITCH_SIZES: Record<
  SwitchSize,
  { root: string; thumb: string }
> = {
  sm: {
    root: "h-5 w-9",
    thumb: "h-4 w-4 data-[state=checked]:translate-x-4",
  },
  md: {
    root: "h-6 w-11",
    thumb: "h-5 w-5 data-[state=checked]:translate-x-5",
  },
  lg: {
    root: "h-7 w-[3.25rem]",
    thumb: "h-6 w-6 data-[state=checked]:translate-x-6",
  },
};

type SwitchProps = React.ComponentPropsWithoutRef<
  typeof SwitchPrimitives.Root
> & {
  size?: SwitchSize;
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = "sm", ...props }, ref) => {
  const sizes = SWITCH_SIZES[size];

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-neutral-300/40 bg-gray-50/70 shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-walls-sky/40 data-[state=checked]:shadow-[inset_0_4px_8px_rgba(0,0,0,0.16)]",
        sizes.root,
        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none flex items-center justify-center rounded-full bg-neutral-100 ring-0 shadow-[0_1px_3px_rgba(0,0,0,0.14)] data-[state=unchecked]:translate-x-0 data-[state=checked]:shadow-lg",
          sizes.thumb,
        )}
        style={{
          // Tailwind v4 moves the thumb via the `translate` property, while v3
          // used `transform`. Transition both so the bouncy slide works on either.
          transition: `translate 0.5s ${BOUNCY_EASING}, transform 0.5s ${BOUNCY_EASING}`,
        }}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

type LabeledSwitchProps = {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
  size?: SwitchSize;
};

function LabeledSwitch({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
  id,
  className,
  size = "sm",
}: LabeledSwitchProps) {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <label
          htmlFor={switchId}
          className="cursor-pointer text-sm font-medium text-foreground"
        >
          {label}
        </label>
        {description ? (
          <p className="mt-1 text-xs font-light leading-5 text-neutral-500">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        size={size}
      />
    </div>
  );
}

export { Switch, LabeledSwitch };
export type { SwitchProps, SwitchSize };
