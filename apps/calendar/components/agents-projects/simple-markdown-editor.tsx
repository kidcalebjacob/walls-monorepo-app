"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Loader2, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SCOPE_AI_MODELS = [
  { value: "claude-sonnet-4-6", provider: "Anthropic", model: "Claude Sonnet" },
  { value: "claude-opus-4-6", provider: "Anthropic", model: "Claude Opus" },
  { value: "gpt-4o", provider: "OpenAI", model: "GPT-4o" },
  { value: "gpt-4o-mini", provider: "OpenAI", model: "GPT-4o Mini" },
  { value: "sonar-pro", provider: "Perplexity", model: "Sonar Pro" },
];

const popupIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";

const popupIconInnerClass =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";

/** Wraps long unbroken strings (e.g. tokens/URLs) inside a bounded width. */
const markdownContentClass =
  "min-w-0 break-words [overflow-wrap:anywhere]";

export interface ScopeAIConfig {
  name: string;
  type: "project" | "task";
  projectName?: string;
  projectDescription?: string;
}

interface SimpleMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  aiConfig?: ScopeAIConfig;
  onAIGenerate?: (text: string) => void;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const h1 = line.match(/^#\s+(.*)/);
        const h2 = line.match(/^##\s+(.*)/);
        const h3 = line.match(/^###\s+(.*)/);
        const bullet = line.match(/^-\s+(.*)/);
        const numbered = line.match(/^(\d+)\.\s+(.*)/);
        if (h3) {
          return (
            <div key={i} className="text-sm font-semibold text-neutral-800 mt-2 mb-0.5">
              {renderInline(h3[1])}
            </div>
          );
        }
        if (h2) {
          return (
            <div key={i} className="text-base font-semibold text-neutral-900 mt-3 mb-1">
              {renderInline(h2[1])}
            </div>
          );
        }
        if (h1) {
          return (
            <div key={i} className="text-lg font-bold text-neutral-900 mt-3 mb-1">
              {renderInline(h1[1])}
            </div>
          );
        }
        if (bullet) {
          return (
            <div key={i} className="flex items-start gap-1.5 min-w-0">
              <span className="mt-[-0.5px] text-neutral-900 shrink-0">•</span>
              <span className={markdownContentClass}>{renderInline(bullet[1])}</span>
            </div>
          );
        }
        if (numbered) {
          return (
            <div key={i} className="flex items-start gap-1.5 min-w-0">
              <span className="text-neutral-500 shrink-0">{numbered[1]}.</span>
              <span className={markdownContentClass}>{renderInline(numbered[2])}</span>
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return (
          <div key={i} className={markdownContentClass}>
            {renderInline(line)}
          </div>
        );
      })}
    </>
  );
}

export function SimpleMarkdownEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  aiConfig,
  onAIGenerate,
}: SimpleMarkdownEditorProps) {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState("claude-sonnet-4-6");
  const [aiGenerating, setAiGenerating] = useState(false);

  const handleContainerBlur = (e: React.FocusEvent) => {
    // Keep editor active while interacting with AI popover content rendered in a portal.
    if (aiOpen) return;

    const nextTarget = e.relatedTarget as HTMLElement | null;
    if (
      nextTarget?.closest("[data-radix-popper-content-wrapper]") ||
      nextTarget?.closest("[data-radix-select-content]")
    ) {
      return;
    }

    // Keep the editor expanded while focus moves to other controls
    // inside the same dialog (close/save/delete, selects, etc.).
    const dialogContainer = containerRef.current?.closest(
      '[data-slot="dialog-content"], [role="dialog"]'
    );
    if (nextTarget && dialogContainer?.contains(nextTarget)) {
      return;
    }

    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsActive(false);
    }
  };

  const handleContainerClick = () => {
    if (!disabled && !isActive) {
      setIsActive(true);
      setMode("edit");
    }
  };

  useEffect(() => {
    if (isActive && mode === "edit") {
      textareaRef.current?.focus();
    }
  }, [isActive, mode]);

  const handleAIGenerate = async () => {
    if (!aiConfig || !onAIGenerate) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/walli/scope-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          name: aiConfig.name,
          type: aiConfig.type,
          model: aiModel,
          projectName: aiConfig.projectName,
          projectDescription: aiConfig.projectDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      onAIGenerate(data.content);
      setAiOpen(false);
      setAiPrompt("");
    } catch (err) {
      console.error("scope-gen error:", err);
    } finally {
      setAiGenerating(false);
    }
  };

  const showAIButton = !!(aiConfig && onAIGenerate);
  const currentModel = SCOPE_AI_MODELS.find((m) => m.value === aiModel) ?? SCOPE_AI_MODELS[0];

  return (
    <div
      ref={containerRef}
      onBlur={handleContainerBlur}
      onClick={handleContainerClick}
      className={cn(
        "relative min-w-0 rounded-md border text-sm transition-colors",
        isActive ? "border-neutral-200" : "border-transparent",
        !isActive && !disabled && "cursor-text",
        className
      )}
    >
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-2 border-b border-neutral-200/80">
          {/* Left: AI button */}
          {showAIButton ? (
            <Popover
              open={aiOpen}
              onOpenChange={(o) => {
                if (aiGenerating) return;
                setAiOpen(o);
                if (!o) setAiPrompt("");
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 text-xs font-normal px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_rgba(0,0,0,0.06)] transition-colors duration-200 hover:text-neutral-700 disabled:opacity-50"
                  aria-label="Generate scope with AI"
                >
                  {aiGenerating
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />
                    : <Sparkles className="h-3.5 w-3.5 text-neutral-500" />}
                  <span className="text-neutral-600">AI Gen</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                sideOffset={8}
                align="start"
                className="w-[380px] max-w-[calc(100vw-2rem)] p-4 bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200] rounded-[2rem]"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAIGenerate();
                  }}
                  className="space-y-4"
                >
                  <div className="rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-4 py-2">
                    <input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder={`Describe the ${aiConfig!.type} scope…`}
                      className="w-full border-0 bg-transparent focus:outline-none text-sm placeholder:text-neutral-300"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAIGenerate();
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 pl-2">
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger className="w-auto max-w-[160px] min-w-0 h-auto py-0 pl-0 pr-6 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors justify-start text-left [&>span:first-child]:min-w-0 [&>span:first-child]:text-left [&>span:first-child]:truncate [&>span:first-child]:block">
                        <SelectValue>{currentModel.model}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[250]" sideOffset={4}>
                        {SCOPE_AI_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value} className="text-sm">
                            {m.model}{" "}
                            <span className="text-neutral-600">({m.provider})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setAiOpen(false); setAiPrompt(""); }}
                        className={popupIconButtonClass}
                        aria-label="Cancel"
                      >
                        <div className={popupIconInnerClass}>
                          <X className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                        </div>
                      </button>
                      <button
                        type="submit"
                        disabled={aiGenerating}
                        className={popupIconButtonClass}
                        aria-label="Generate scope"
                      >
                        <div className={popupIconInnerClass}>
                          {aiGenerating
                            ? <Loader2 className="h-[18px] w-[18px] animate-spin text-neutral-500" />
                            : <Sparkles className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />}
                        </div>
                      </button>
                    </div>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
          ) : (
            <div />
          )}

          {/* Right: Edit / Preview toggle and collapse button */}
          <div className="flex items-center gap-1.5">
            <div className="relative inline-flex items-center rounded-xl border border-neutral-200 bg-neutral-50/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_rgba(0,0,0,0.06)]">
              <motion.div
                layout
                layoutId="markdown-editor-mode-pill"
                className={cn(
                  "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-[0_4px_10px_rgba(0,0,0,0.10)]",
                  mode === "edit" ? "left-1" : "left-[calc(50%+3px)]"
                )}
                transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.9 }}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode("edit")}
                className={cn(
                  "relative z-10 min-w-[82px] text-xs font-normal px-3.5 py-1.5 rounded-lg transition-colors duration-200",
                  mode === "edit"
                    ? "text-neutral-800"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                Edit
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode("preview")}
                className={cn(
                  "relative z-10 min-w-[82px] text-xs font-normal px-3.5 py-1.5 rounded-lg transition-colors duration-200",
                  mode === "preview"
                    ? "text-neutral-800"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                Preview
              </button>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsActive(false)}
              className="w-9 h-9 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close editor toolbar"
            >
              <div className="relative z-10 p-2.5 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
                <X className="h-[15px] w-[15px] stroke-[1.5] text-neutral-500" />
              </div>
            </button>
          </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isActive ? (
        <div className="relative h-[272px]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "absolute inset-0 w-full h-full box-border resize-none border-0 bg-transparent outline-none px-3.5 py-2 placeholder:text-neutral-300 overflow-y-auto overflow-x-hidden leading-relaxed transition-opacity break-words [overflow-wrap:anywhere] [scrollbar-width:thin] [scrollbar-color:rgb(229_229_229)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300/60 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400/70",
              mode === "edit" ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          <div
            className={cn(
              "absolute inset-0 box-border min-w-0 px-3.5 py-2 overflow-y-auto overflow-x-hidden leading-relaxed text-neutral-700 transition-opacity",
              markdownContentClass,
              "[scrollbar-width:thin] [scrollbar-color:rgb(229_229_229)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300/60 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400/70",
              mode === "preview" ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {value ? renderMarkdown(value) : null}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "min-w-0 px-3.5 py-2 h-[272px] overflow-y-auto overflow-x-hidden leading-relaxed text-neutral-700",
            markdownContentClass,
            "[scrollbar-width:thin] [scrollbar-color:rgb(229_229_229)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300/60 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400/70",
            !value && "text-neutral-300"
          )}
        >
          {value ? renderMarkdown(value) : placeholder}
        </div>
      )}
    </div>
  );
}
