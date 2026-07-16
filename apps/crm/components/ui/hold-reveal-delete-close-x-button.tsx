"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type HoldRevealDeleteCloseXButtonProps = {
  disabled?: boolean;
  holdDurationMs?: number;
  iconButtonClass: string;
  iconInnerClass: string;
  onCloseClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Fired at the start of a press (parent typically clears `isHoldingComplete`). */
  onHoldStart: () => void;
  /** Fired when the hold duration completes (parent reveals delete). */
  onHoldComplete: () => void;
  /** Fired on release / leave / touch end (parent mirrors `cancelHold`). */
  onHoldInterrupt: () => void;
};

export function HoldRevealDeleteCloseXButton({
  disabled = false,
  holdDurationMs = 2000,
  iconButtonClass,
  iconInnerClass,
  onCloseClick,
  onHoldStart,
  onHoldComplete,
  onHoldInterrupt,
}: HoldRevealDeleteCloseXButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const holdFill = useMotionValue(0);
  const playbackRef = useRef<ReturnType<typeof animate> | null>(null);

  const stopFill = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    holdFill.set(0);
  };

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
      holdFill.set(0);
    };
  }, [holdFill]);

  const startHold = () => {
    if (disabled) return;
    onHoldStart();
    setIsPressed(true);
    stopFill();
    playbackRef.current = animate(holdFill, 1, {
      duration: holdDurationMs / 1000,
      ease: "linear",
      onComplete: () => {
        playbackRef.current = null;
        holdFill.set(0);
        setIsPressed(false);
        onHoldComplete();
      },
    });
  };

  const interruptHold = () => {
    stopFill();
    setIsPressed(false);
    onHoldInterrupt();
  };

  return (
    <button
      type="button"
      onClick={onCloseClick}
      onMouseDown={startHold}
      onMouseUp={interruptHold}
      onMouseLeave={interruptHold}
      onTouchStart={startHold}
      onTouchEnd={interruptHold}
      onTouchCancel={interruptHold}
      disabled={disabled}
      className={iconButtonClass}
    >
      <div className="relative">
        <div
          className={cn(
            iconInnerClass,
            "relative overflow-hidden",
            isPressed && "scale-95 shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)]"
          )}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 rounded-full bg-kenoo-yellow"
            style={{
              scaleY: holdFill,
              transformOrigin: "50% 100%",
            }}
          />
          <X className="relative z-10 h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
        </div>
      </div>
    </button>
  );
}
