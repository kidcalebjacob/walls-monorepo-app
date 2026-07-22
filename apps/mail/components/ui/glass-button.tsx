import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  [
    "relative inline-flex items-center justify-center",
    "rounded-full cursor-pointer select-none",
    "transition-all duration-200",
    "border border-white/30",
    // slightly darker base so the glass reads more clearly
    "bg-neutral-400/20",
    "backdrop-blur-xl",
    // subtle base shadow so it still floats when not hovered
    "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_3px_10px_rgba(0,0,0,0.06)]",
    "bg-neutral-400/20",
    // keep same shadow on hover (icon wiggle provides feedback instead)
    "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_3px_10px_rgba(0,0,0,0.06)]",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "text-sm font-medium px-4 py-2",
        default: "text-base font-medium px-6 py-3",
        lg: "text-lg font-medium px-8 py-4",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(glassButtonVariants({ size }), className)}
        {...props}
      />
    );
  }
);

GlassButton.displayName = "GlassButton";

