"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

// Bouncy overshoot easing (same as PremiumToggle reference)
const BOUNCY_EASING = "cubic-bezier(0.68, -0.55, 0.265, 1.55)"

const SequenceSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, checked, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-neutral-300/40 bg-kenoo-white/70 shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-kenoo-sky/40 shadow-[inset_0_4px_8px_rgba(0,0,0,0.16)]" : "",
      className
    )}
    checked={checked}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none flex items-center justify-center h-4 w-4 rounded-full ring-0 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        checked
          ? "bg-neutral-100 shadow-lg"
          : "bg-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.14)]"
      )}
      style={{
        transition: `transform 0.5s ${BOUNCY_EASING}`,
      }}
    />
  </SwitchPrimitives.Root>
))
SequenceSwitch.displayName = SwitchPrimitives.Root.displayName

export { SequenceSwitch }

