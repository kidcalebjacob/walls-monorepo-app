"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const floatButtonClass =
  "rounded-full border border-neutral-300/30 bg-gray-50/80 backdrop-blur-sm backdrop-saturate-150 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_22px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out hover:border-neutral-300/55 hover:bg-gray-50/80 hover:text-foreground hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99]";

const floatIconButtonClass = cn(
  floatButtonClass,
  "group h-10 w-10 p-0 flex items-center justify-center"
);

const floatIconClass =
  "w-4 h-4 text-neutral-400 transition-colors duration-300 group-hover:text-walls-sky";

export function FloatIconButton({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Button variant="ghost" asChild className={floatIconButtonClass}>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <Icon className={floatIconClass} strokeWidth={1.75} />
      </a>
    </Button>
  );
}
