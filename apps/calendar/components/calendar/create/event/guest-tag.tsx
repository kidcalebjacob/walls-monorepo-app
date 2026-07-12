"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GuestTag {
  email: string;
  id: string;
}

interface GuestTagProps {
  tag: GuestTag;
  onRemove: () => void;
  disabled?: boolean;
}

export function GuestTag({ tag, onRemove, disabled = false }: GuestTagProps) {
  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1 text-[13px] font-[Arial] bg-gray-100 hover:bg-gray-200 text-gray-800 border-0"
    >
      {tag.email}
      {!disabled && (
        <X
          className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </Badge>
  );
} 