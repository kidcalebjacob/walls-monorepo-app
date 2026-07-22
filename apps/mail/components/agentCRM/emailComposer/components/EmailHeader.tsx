"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailHeaderProps {
  subject: string;
  isReply: boolean;
  onClose: () => void;
  fromEmail?: string;
  onSubjectChange: (subject: string) => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  toEmails?: string[];
  onAddFollowUp?: () => void;
}

export function EmailHeader({ 
  subject, 
  isReply, 
  onClose, 
  fromEmail,
  onSubjectChange,
  isMinimized,
  onMinimize,
  toEmails,
  onAddFollowUp
}: EmailHeaderProps) {
  const [localSubject, setLocalSubject] = useState(subject);

  // Update local subject when prop changes (e.g., from AI generation)
  useEffect(() => {
    setLocalSubject(subject);
  }, [subject]);

  // Handle subject input change
  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSubject = e.target.value;
    setLocalSubject(newSubject);
    onSubjectChange(newSubject);
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-between px-4 py-2 rounded-t-2xl",
        "bg-gray-50",
        "border-b border-gray-200",
        isMinimized && onMinimize && "cursor-pointer hover:bg-gray-100 transition-colors"
      )}
      onClick={isMinimized && onMinimize ? onMinimize : undefined}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isMinimized ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {toEmails && toEmails.length > 0 
                ? `To: ${toEmails[0]}${toEmails.length > 1 ? ` +${toEmails.length - 1}` : ''}`
                : 'New Message'
              }
            </span>
            {subject && (
              <span className="text-xs text-gray-500 truncate">- {subject}</span>
            )}
          </div>
        ) : (
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">New Message</span>
            )}
          </div>
          
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {onMinimize && !isMinimized && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-gray-200 transition-colors shrink-0 text-gray-600 hover:text-gray-900"
            onClick={onMinimize}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        )}
        {onAddFollowUp && !isMinimized && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-gray-200 transition-colors shrink-0 text-gray-600 hover:text-gray-900"
            onClick={onAddFollowUp}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-gray-200 transition-colors shrink-0 text-gray-600 hover:text-gray-900"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}