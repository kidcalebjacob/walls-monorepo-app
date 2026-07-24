export function StatField({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;

  return (
    <div className={className}>
      <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1.5 truncate text-[15px] font-light text-neutral-900">{value}</p>
    </div>
  );
}
