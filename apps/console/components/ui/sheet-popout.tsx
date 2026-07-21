"use client";

import * as React from "react";
import { X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@walls/ui/sheet";
import { cn } from "@/lib/utils";

const SheetPopout = Sheet;

const SheetPopoutContent = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  React.ComponentPropsWithoutRef<typeof SheetContent>
>(({ className, children, ...props }, ref) => (
  <SheetContent
    ref={ref}
    className={cn(
      "flex w-full max-w-md flex-col gap-0 border-l border-neutral-200/80 bg-white/95 p-0 backdrop-blur-xl sm:max-w-md",
      className,
    )}
    {...props}
  >
    {children}
  </SheetContent>
));
SheetPopoutContent.displayName = "SheetPopoutContent";

function SheetPopoutHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <SheetHeader
      className={cn(
        "flex flex-row items-center justify-between space-y-0 border-b border-neutral-200/60 px-6 py-4 text-left",
        className,
      )}
      {...props}
    />
  );
}

const SheetPopoutTitle = SheetTitle;

function SheetPopoutBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-hidden", className)} {...props} />;
}

function SheetPopoutFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <SheetFooter
      className={cn(
        "border-t border-neutral-200/60 px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function SheetPopoutCloseButton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <SheetClose asChild>
      <button
        type="button"
        className={cn(
          "rounded-full p-2 text-zinc-500 transition-colors hover:bg-neutral-100 hover:text-zinc-800",
          className,
        )}
        {...props}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </SheetClose>
  );
}

export {
  SheetPopout,
  SheetPopoutContent,
  SheetPopoutHeader,
  SheetPopoutTitle,
  SheetPopoutBody,
  SheetPopoutFooter,
  SheetPopoutCloseButton,
};
