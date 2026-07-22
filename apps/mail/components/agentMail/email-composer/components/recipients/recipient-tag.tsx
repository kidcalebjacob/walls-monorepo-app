// app/components/agent-mail/email-composer/components/recipients/recipient-tag.tsx
"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EmailTag {
  email: string;
  id: string;
}

interface RecipientTagProps {
  tag: EmailTag;
  onRemove: () => void;
  disabled?: boolean;
}

export function RecipientTag({ tag, onRemove, disabled = false }: RecipientTagProps) {
  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1 text-[13px] font-[Arial]"
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