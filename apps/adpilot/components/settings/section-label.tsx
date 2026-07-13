export function SectionLabel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
        {title}
      </p>
      {description ? (
        <p className="mt-1.5 text-sm font-light text-neutral-500">{description}</p>
      ) : null}
    </div>
  );
}
