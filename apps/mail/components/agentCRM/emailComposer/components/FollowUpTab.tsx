"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FollowUpTabProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  index: number;
  totalTabs: number;
  isMainTab?: boolean;
}

export function FollowUpTab({ 
  id, 
  label, 
  isActive, 
  onClick, 
  onClose,
  index,
  totalTabs,
  isMainTab
}: FollowUpTabProps) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-1.5 px-4 py-2 rounded-t-lg",
        "cursor-pointer transition-all duration-150",
        isActive 
          ? "z-10 bg-white shadow-[0_-2px_4px_rgba(0,0,0,0.08)]" 
          : "z-0 bg-gray-200 hover:bg-gray-250",
        index === 0 && "ml-1",
        index === totalTabs - 1 && "mr-1",
        isMainTab ? "min-w-[140px] max-w-[140px]" : "min-w-[140px] max-w-[220px]"
      )}
      onClick={onClick}
      style={{
        clipPath: index === 0 
          ? "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)"
          : index === totalTabs - 1
          ? "polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)"
          : "polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)"
      }}
    >
      <span 
        className={cn(
          "text-xs font-normal flex-1 text-left",
          isActive ? "text-gray-900" : "text-gray-600",
          isMainTab ? "truncate" : "truncate"
        )}
        style={isMainTab ? { maxWidth: '140px' } : undefined}
      >
        {label || `Follow-up ${index + 1}`}
      </span>
      {!(isMainTab && totalTabs === 1) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 hover:bg-gray-300 rounded-full shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onClose(e);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
