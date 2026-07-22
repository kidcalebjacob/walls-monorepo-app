"use client";

import { Editor } from '@tiptap/react';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Baseline,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TextFormattingToolProps {
  editor: Editor | null;
}

const fonts = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Serif', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Verdana', value: 'Verdana' }
];

const fontSizes = [
  { label: 'Small', value: '14px' },
  { label: 'Normal', value: '16px' },
  { label: 'Large', value: '20px' },
  { label: 'Huge', value: '24px' }
];

const colors = [
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#cc0000' },
  { label: 'Blue', value: '#0000cc' },
  { label: 'Green', value: '#00cc00' },
];

const backgroundColors = [
  { label: 'Yellow', value: 'rgb(255,229,153)' },
  { label: 'Light Blue', value: 'rgb(201,218,248)' },
  { label: 'Light Green', value: 'rgb(217,234,211)' },
  { label: 'Light Pink', value: 'rgb(249,203,203)' },
];

const alignments = [
  { label: 'Left', value: 'left', Icon: AlignLeft },
  { label: 'Center', value: 'center', Icon: AlignCenter },
  { label: 'Right', value: 'right', Icon: AlignRight },
  { label: 'Justify', value: 'justify', Icon: AlignJustify },
];

function ToolbarDivider() {
  return <div className="h-5 w-px bg-neutral-300 mx-0.5 shrink-0" aria-hidden />;
}

export function TextFormattingTool({ editor }: TextFormattingToolProps) {
  const currentFont = editor?.getAttributes('textStyle').fontFamily || 'Arial';
  const currentSize = editor?.getAttributes('textStyle').fontSize || '16px';
  const currentAlign = editor?.getAttributes('paragraph').textAlign || 'left';

  const fontLabel = fonts.find(f => f.value === currentFont)?.label ?? 'Sans Serif';
  const sizeLabel = fontSizes.find(s => s.value === currentSize)?.label ?? 'Normal';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg transition-all duration-200 hover:bg-neutral-100 hover:shadow-inner hover:border hover:border-neutral-200/50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]"
          disabled={!editor}
        >
          <Baseline className="h-5 w-5 text-neutral-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-auto max-w-[calc(100vw-2rem)] p-2 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200]"
      >
        {!editor ? (
          <span className="text-sm text-muted-foreground">Editor not ready</span>
        ) : (
    <div className="inline-flex items-center rounded-full bg-transparent px-0 py-0">
      {/* Undo / Redo */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <ToolbarDivider />

      {/* Font */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 rounded-md px-2 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900 text-sm font-normal"
          >
            <span style={{ fontFamily: currentFont }} className="max-w-[72px] truncate">
              {fontLabel}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200] min-w-[140px]">
          {fonts.map((font) => (
            <DropdownMenuItem
              key={font.value}
              className="rounded-lg focus:bg-neutral-100 cursor-pointer"
              onClick={() => editor.chain().focus().setFontFamily(font.value).run()}
            >
              <span style={{ fontFamily: font.value }}>{font.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Size */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 rounded-md px-2 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900 text-sm font-normal"
          >
            <Type className="h-4 w-4 shrink-0" />
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200] min-w-[100px]">
          {fontSizes.map((size) => (
            <DropdownMenuItem
              key={size.value}
              className="rounded-lg focus:bg-neutral-100 cursor-pointer"
              onClick={() => editor.chain().focus().setMark('textStyle', { fontSize: size.value }).run()}
            >
              {size.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarDivider />

      {/* Bold, Italic, Underline */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800",
          editor.isActive('bold') && "bg-sky-100 text-sky-700 hover:bg-sky-100/90"
        )}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800",
          editor.isActive('italic') && "bg-sky-100 text-sky-700 hover:bg-sky-100/90"
        )}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800",
          editor.isActive('underline') && "bg-sky-100 text-sky-700 hover:bg-sky-100/90"
        )}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </Button>

      <ToolbarDivider />

      {/* Text color */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 rounded-md px-2 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900 text-sm font-normal"
          >
            <span className="underline decoration-2 underline-offset-2">A</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200] p-2">
          <div className="grid grid-cols-4 gap-1">
            {colors.map((color) => (
              <button
                key={color.value}
                type="button"
                className="w-7 h-7 rounded-md border border-neutral-200 hover:ring-2 hover:ring-neutral-300 transition-shadow"
                style={{ backgroundColor: color.value }}
                onClick={() => editor.chain().focus().setColor(color.value).run()}
                title={color.label}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarDivider />

      {/* Alignment */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 rounded-md px-2 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900 text-sm font-normal"
          >
            {currentAlign === 'left' && <AlignLeft className="h-4 w-4" />}
            {currentAlign === 'center' && <AlignCenter className="h-4 w-4" />}
            {currentAlign === 'right' && <AlignRight className="h-4 w-4" />}
            {currentAlign === 'justify' && <AlignJustify className="h-4 w-4" />}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200] min-w-[120px]">
          {alignments.map(({ value, Icon }) => (
            <DropdownMenuItem
              key={value}
              className="rounded-lg focus:bg-neutral-100 cursor-pointer"
              onClick={() => editor.chain().focus().setTextAlign(value as 'left' | 'center' | 'right' | 'justify').run()}
            >
              <Icon className="h-4 w-4 mr-2" />
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Lists */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800",
          editor.isActive('orderedList') && "bg-sky-100 text-sky-700 hover:bg-sky-100/90"
        )}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-md text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-800",
          editor.isActive('bulletList') && "bg-sky-100 text-sky-700 hover:bg-sky-100/90"
        )}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>

      <ToolbarDivider />

      {/* More: highlight / background color */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-md px-2 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900 text-sm font-normal"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200] p-3 w-48">
          <p className="text-xs font-medium text-neutral-500 mb-2 px-1">Highlight</p>
          <div className="grid grid-cols-4 gap-1">
            {backgroundColors.map((color) => (
              <button
                key={color.value}
                type="button"
                className="w-8 h-8 rounded-md border border-neutral-200 hover:ring-2 hover:ring-neutral-300 transition-shadow"
                style={{ backgroundColor: color.value }}
                onClick={() => editor.chain().focus().setMark('textStyle', { backgroundColor: color.value }).run()}
                title={color.label}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
