"use client";

import * as React from "react";

import { Input as BaseInput } from "@walls/ui/input";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof BaseInput>
>(({ className, ...props }, ref) => (
  <BaseInput
    ref={ref}
    className={cn(
      "rounded-none border-0 border-b border-neutral-200 bg-transparent px-0 shadow-none focus-visible:ring-0",
      className,
    )}
    {...props}
  />
));
Input.displayName = "BorderlessInput";

export { Input };
