'use client';

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFABProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function MobileFAB({ onClick, className, disabled = false }: MobileFABProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 md:hidden">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex-none bg-black/60 backdrop-blur-xl shadow-lg border border-white/5",
          "rounded-full w-16 h-16 flex items-center justify-center",
          "active:bg-black/50 active:shadow-xl",
          "transition-all duration-300",
          "hover:scale-105 hover:bg-black/45 hover:shadow-xl",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          "before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none",
          className
        )}
      >
        <Plus className="w-8 h-8 text-kenoo-yellow flex-none" />
      </button>
    </div>
  );
}
