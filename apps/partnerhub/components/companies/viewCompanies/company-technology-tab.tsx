import { cardSurfaceClass } from "../shared";
import { cn } from "@/lib/utils";

export function CompanyTechnologyTab({
  technologiesByCategory,
}: {
  technologiesByCategory: [string, string[]][];
}) {
  if (technologiesByCategory.length === 0) {
    return (
      <p className="text-sm font-light text-neutral-400">No technology data available.</p>
    );
  }

  return (
    <div className="space-y-6">
      {technologiesByCategory.map(([category, techs]) => (
        <div key={category} className={cn(cardSurfaceClass, "p-6 sm:p-8")}>
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
            {category}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {techs.map((tech) => (
              <span
                key={tech}
                className="rounded-2xl border border-neutral-200/60 bg-transparent px-3.5 py-2 text-[11px] font-light text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-6px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-neutral-300/70 hover:shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
