"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@walls/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-visible rounded-full bg-neutral-200/90">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--kenoo-sky)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-4 cursor-pointer rounded-full border border-[var(--kenoo-sky)]/40 bg-white shadow-md transition-transform outline-none focus:outline-none focus-visible:outline-none hover:scale-105 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
