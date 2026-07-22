"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Link2 } from "lucide-react";
import { EditorRef } from '../editor';

interface HyperlinkToolProps {
  editorRef: React.RefObject<EditorRef | null>;
}

export function HyperlinkTool({ editorRef }: HyperlinkToolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = editorRef.current?.getEditor();

  const handleLinkButtonClick = () => {
    if (!editor) return;

    // Check if we're editing an existing link
    const marks = editor.state.selection.$from.marks();
    const linkMark = marks.find(mark => mark.type.name === 'link');

    if (linkMark) {
      setLinkUrl(linkMark.attrs.href || '');
    } else {
      setLinkUrl('');
    }
  };

  const handleLinkInsert = () => {
    if (!editor || !linkUrl.trim()) return;

    // If there's no selected text, insert the URL as visible text and link it
    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent(linkUrl)
        .setTextSelection(editor.state.selection.from - linkUrl.length)
        .setLink({ href: linkUrl })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setLink({ href: linkUrl })
        .run();
    }

    setLinkUrl('');
    setIsOpen(false);
  };

  const removeLinkFormatting = () => {
    if (!editor) return;
    
    editor
      .chain()
      .focus()
      .unsetLink()
      .run();

    setLinkUrl('');
    setIsOpen(false);
  };

  const isEditingLink = editor?.isActive('link');

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) {
        handleLinkButtonClick();
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-10 w-10 rounded-lg transition-all duration-200 ${isEditingLink ? 'bg-muted' : ''} hover:bg-neutral-100 hover:shadow-inner hover:border hover:border-neutral-200/50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]`}
        >
          <Link2 className="h-5 w-5 text-neutral-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-80 z-[200] rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl p-4"
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pl-0.5 pr-4 py-2 focus-within:border-kenoo-yellow focus-within:ring-2 focus-within:ring-kenoo-yellow/30 transition-all">
            <Input
              id="link-url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 min-w-0 w-full shadow-none h-auto py-0 placeholder:text-neutral-400"
              placeholder="https://"
            />
          </div>
          <button
            type="button"
            onClick={handleLinkInsert}
            disabled={!linkUrl.trim()}
            className="px-2 py-1.5 text-sm font-medium shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={linkUrl.trim() ? 'text-kenoo-sky hover:underline' : 'text-neutral-400'}>
              Apply
            </span>
          </button>
          {isEditingLink && (
            <button
              type="button"
              onClick={removeLinkFormatting}
              className="px-4 py-2 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center gap-2 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all text-sm font-medium text-gray-700 hover:text-red-600 shrink-0"
            >
              Remove Link
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}