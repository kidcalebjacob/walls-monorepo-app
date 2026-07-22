"use client";

import { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";

interface AttachmentsToolProps {
  onAttachmentsChange: (files: File[]) => void;
}

export function AttachmentsTool({ onAttachmentsChange }: AttachmentsToolProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    onAttachmentsChange(files);
    event.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-hidden
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        className="h-10 w-10 rounded-lg transition-all duration-200 hover:bg-neutral-100 hover:shadow-inner hover:border hover:border-neutral-200/50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]"
      >
        <Paperclip className="h-5 w-5 text-neutral-600" />
      </Button>
    </>
  );
}

/** Gmail-style attachment chips shown in the editor view. Render this in the composer body (e.g. above footer). */
export function AttachmentsList({
  attachments,
  onAttachmentsChange,
}: {
  attachments: File[];
  onAttachmentsChange: (files: File[]) => void;
}) {
  if (attachments.length === 0) return null;

  const handleRemove = (index: number) => {
    const next = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 w-full px-2 py-2">
      {attachments.map((file, index) => (
        <div
          key={index}
          className="inline-flex items-center gap-2 rounded-xl bg-white/80 backdrop-blur-xl border border-kenoo-yellow shadow-2xl px-3 py-2 text-sm text-kenoo-sky min-w-0 max-w-full group"
        >
          <span className="min-w-0 truncate" title={file.name}>
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className="shrink-0 p-0.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
