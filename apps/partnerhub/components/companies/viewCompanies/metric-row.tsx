import { cn } from "@/lib/utils";

export function MetricRow({
  label,
  value,
  accent = "bg-[var(--walls-sky)]",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200/50 py-4 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", accent)} />
        <span className="truncate text-sm font-light text-neutral-600">{label}</span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
        {value}
      </span>
    </div>
  );
}
