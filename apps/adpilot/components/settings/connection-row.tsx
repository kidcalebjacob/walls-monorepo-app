import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@walls/ui/skeleton";
import { cn } from "@walls/utils";

import { panelGlassClass } from "@/components/ui/button-styles";

export function ConnectionRow({
  href,
  icon,
  title,
  status,
  connected,
  statusLoading = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  status: string;
  connected: boolean;
  /** When true, show a status skeleton instead of the status text. */
  statusLoading?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-200",
        "hover:bg-white/95",
        panelGlassClass,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {statusLoading ? (
          <Skeleton className="mt-1.5 h-3 w-28 rounded bg-neutral-200/80" />
        ) : (
          <p
            className={cn(
              "mt-0.5 truncate text-xs font-light",
              connected ? "text-emerald-700" : "text-neutral-500",
            )}
          >
            {status}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-neutral-600" />
    </Link>
  );
}
