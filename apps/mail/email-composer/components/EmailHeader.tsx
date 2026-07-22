"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailHeaderProps {
  subject: string;
  isReply: boolean;
  onClose: () => void;
  fromEmail?: string;
  onSubjectChange: (subject: string) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDrag: (e: React.MouseEvent) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
}

export function EmailHeader({ 
  subject, 
  isReply, 
  onClose, 
  fromEmail,
  onSubjectChange,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging
}: EmailHeaderProps) {
  const [localSubject, setLocalSubject] = useState(subject);

  // Update local subject when prop changes (e.g., from AI generation)
  useEffect(() => {
    setLocalSubject(subject);
  }, [subject]);

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        onDrag(e as unknown as React.MouseEvent);
      };

      const handleMouseUp = () => {
        onDragEnd();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, onDrag, onDragEnd]);

  // Handle subject input change
  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSubject = e.target.value;
    setLocalSubject(newSubject);
    onSubjectChange(newSubject);
  };

  return (
    <div 
      className={cn(
        "flex flex-col gap-2 px-6 py-4",
        "bg-gradient-to-r from-white/20 via-white/15 to-white/10",
        "backdrop-blur-sm",
        "border-b border-white/20",
        "relative overflow-hidden",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        "select-none"
      )}
      onMouseDown={(e) => {
        if (e.button === 0) { // Left click only
          onDragStart(e);
        }
      }}
    >
      {/* Glass overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-white/20 to-white/10 pointer-events-none" />
      
      {/* Content with proper z-index */}
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            {isReply ? (
              <h3 className="text-lg font-semibold text-[#374151] drop-shadow-sm">Reply</h3>
            ) : (
              <Input
                value={localSubject}
                onChange={handleSubjectChange}
                placeholder="Subject"
                className="bg-transparent border-none text-lg font-semibold text-[#374151] focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto placeholder:text-[#4b5563] drop-shadow-sm"
              />
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-white/20 transition-colors shrink-0 text-white hover:text-white/90"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {fromEmail && (
          <div className="text-sm text-[#374151] drop-shadow-sm">
            From: {fromEmail}
          </div>
        )}
      </div>
    </div>
  );
}