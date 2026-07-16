"use client";

import { useEffect, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link2 } from "lucide-react";
import { cn } from '@/lib/utils';
import { EditorRef } from '../editor';

interface HyperlinkToolProps {
  editorRef: React.RefObject<EditorRef>;
}

function useEditorFromComposerRef(editorRef: React.RefObject<EditorRef | null>) {
  const [editor, setEditor] = useState<Editor | null>(() => editorRef.current?.getEditor() ?? null);

  useEffect(() => {
    const immediate = editorRef.current?.getEditor() ?? null;
    if (immediate) {
      setEditor(immediate);
      return;
    }
    const id = window.setInterval(() => {
      const ed = editorRef.current?.getEditor() ?? null;
      if (ed) {
        setEditor(ed);
        window.clearInterval(id);
      }
    }, 32);
    const maxWait = window.setTimeout(() => window.clearInterval(id), 8000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(maxWait);
    };
  }, [editorRef]);

  return editor;
}

export function HyperlinkTool({ editorRef }: HyperlinkToolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditorFromComposerRef(editorRef);

  const isLinkActive = useEditorState({
    editor,
    selector: ({ editor: ed }) => (ed ? ed.isActive('link') : false),
    equalityFn: (a, b) => a === b,
  }) ?? false;

  const handleLinkButtonClick = () => {
    if (!editor) return;

    if (editor.isActive('link')) {
      setLinkUrl((editor.getAttributes('link').href as string) || '');
    } else {
      setLinkUrl('');
    }
  };

  const handleLinkInsert = () => {
    if (!editor || !linkUrl.trim()) return;

    const href = linkUrl.trim();
    const chain = editor.chain().focus();

    if (editor.isActive('link')) {
      chain.extendMarkRange('link').setLink({ href }).run();
    } else if (editor.state.selection.empty) {
      chain
        .insertContent(href)
        .setTextSelection(editor.state.selection.from - href.length)
        .setLink({ href })
        .run();
    } else {
      chain.setLink({ href }).run();
    }

    setLinkUrl('');
    setIsOpen(false);
  };

  const removeLinkFormatting = () => {
    if (!editor) return;

    editor.chain().focus().extendMarkRange('link').unsetLink().run();

    setLinkUrl('');
    setIsOpen(false);
  };

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
          disabled={!editor}
          className={cn(
            'w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0',
            isLinkActive && 'text-sky-700'
          )}
        >
          <div className="relative">
            <div
              className={cn(
                'relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out',
                isLinkActive
                  ? 'bg-sky-100 border border-sky-200/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]'
                  : 'group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95'
              )}
            >
              <Link2
                className={cn(
                  'h-[18px] w-[18px] stroke-[1.5]',
                  isLinkActive ? 'text-sky-700' : 'text-neutral-500'
                )}
              />
            </div>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-80 z-[200] rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl p-4"
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 overflow-visible rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 px-1.5 py-1.5 transition-all">
            <input
              id="link-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && linkUrl.trim()) {
                  e.preventDefault();
                  handleLinkInsert();
                }
              }}
              className="box-border block w-full min-w-0 border-0 bg-transparent p-0 text-sm font-normal leading-normal text-foreground shadow-none outline-none ring-0 placeholder:text-neutral-400 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="https://"
            />
          </div>
          {!isLinkActive && (
            <button
              type="button"
              onClick={handleLinkInsert}
              disabled={!linkUrl.trim()}
              className="shrink-0 px-1.5 py-1.5 text-xs font-normal transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={linkUrl.trim() ? 'text-kenoo-sky hover:underline' : 'text-neutral-400'}>
                Apply
              </span>
            </button>
          )}
          {isLinkActive && (
            <button
              type="button"
              onClick={removeLinkFormatting}
              className="shrink-0 px-1.5 py-1.5 text-xs font-normal transition-all"
            >
              <span className="text-red-600 hover:underline">Remove</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}