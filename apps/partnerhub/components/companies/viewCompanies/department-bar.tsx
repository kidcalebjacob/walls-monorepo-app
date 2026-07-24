export function DepartmentBar({
  department,
  count,
  max,
}: {
  department: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="truncate text-sm font-light text-neutral-600">{department}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200/70">
        <div
          className="h-full rounded-full bg-[var(--walls-sky)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
