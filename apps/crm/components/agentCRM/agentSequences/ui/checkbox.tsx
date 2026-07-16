"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type SequenceCheckboxIndicator = "check" | "dot";

export type SequenceCheckboxProps =
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    /** `dot`: circular outline + kenoo-sky dot when checked (no check icon). Default: checkmark. */
    indicator?: SequenceCheckboxIndicator;
  };

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  SequenceCheckboxProps
>(({ className, indicator = "check", ...props }, ref) => {
  const isDot = indicator === "dot";

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer relative inline-flex shrink-0 items-center justify-center align-middle leading-none ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isDot
          ? cn(
              "box-border h-4 w-4 rounded-full border border-neutral-300 bg-transparent",
              "data-[state=checked]:border-neutral-300 data-[state=checked]:bg-transparent",
              "focus-visible:ring-neutral-300/45"
            )
          : cn(
              "box-border h-4 w-4 rounded-sm border border-primary",
              "data-[state=checked]:bg-kenoo-yellow data-[state=checked]:text-black"
            ),
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center text-current"
        )}
      >
        {isDot ? (
          <span
            className="block h-2 w-2 shrink-0 rounded-full bg-kenoo-sky"
            aria-hidden
          />
        ) : (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
