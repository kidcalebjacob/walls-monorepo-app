"use client";

import {
  SheetPopout,
  SheetPopoutContent,
  SheetPopoutHeader,
  SheetPopoutTitle,
  SheetPopoutBody,
  SheetPopoutFooter,
  SheetPopoutCloseButton,
} from "@/components/ui/sheet-popout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface AppAccessPopoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  /** Optional footer actions (e.g. Save, Cancel) */
  footer?: React.ReactNode;
}

export function AppAccessPopout({
  open,
  onOpenChange,
  title = "App access",
  children,
  footer,
}: AppAccessPopoutProps) {
  return (
    <SheetPopout open={open} onOpenChange={onOpenChange}>
      <SheetPopoutContent side="right" className="p-0 gap-0">
        <SheetPopoutHeader>
          <SheetPopoutTitle>{title}</SheetPopoutTitle>
          <SheetPopoutCloseButton onClick={() => onOpenChange(false)} />
        </SheetPopoutHeader>

        <SheetPopoutBody>
          <ScrollArea className="h-full">
            <div className="p-6 pb-8 space-y-4">
              {children ?? (
                <div className="rounded-2xl bg-neutral-100/80 backdrop-blur-md shadow-inner border border-neutral-200/50 p-6 text-center">
                  <p className="text-sm text-zinc-500">No content</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetPopoutBody>

        {footer != null && (
          <SheetPopoutFooter>{footer}</SheetPopoutFooter>
        )}
      </SheetPopoutContent>
    </SheetPopout>
  );
}

/** Button styled to match the popout/marketplace design */
export function AppAccessPopoutButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "px-4 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/30 flex items-center justify-center gap-2 hover:bg-white/20 transition-colors group shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-zinc-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
