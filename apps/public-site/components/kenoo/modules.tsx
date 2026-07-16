import Link from "next/link";

import { KENOO_MODULES } from "@/lib/modules";

export function Modules() {
  return (
    <section className="border-t border-kenoo-border bg-kenoo-canvas">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
            Modules
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-kenoo-ink md:text-4xl">
            One workspace. Six modules.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-kenoo-muted">
            The tools your team needs, connected in a single product that stays
            consistent from screen to screen.
          </p>
        </div>

        <ul className="mt-12 divide-y divide-kenoo-border border-y border-kenoo-border">
          {KENOO_MODULES.map((module, index) => (
            <li key={module.id}>
              <Link
                href={`/product#${module.id}`}
                className="group flex flex-col gap-2 py-6 transition-colors md:flex-row md:items-baseline md:gap-10 md:py-7"
              >
                <span className="font-mono text-xs text-kenoo-muted md:w-10">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-xl font-semibold tracking-[-0.03em] text-kenoo-ink md:w-40">
                  {module.name}
                </span>
                <span className="flex-1 text-sm leading-relaxed text-kenoo-muted md:text-base">
                  {module.headline}. {module.description}
                </span>
                <span className="text-sm text-kenoo-accent opacity-0 transition-opacity group-hover:opacity-100 md:translate-x-0">
                  Explore →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
