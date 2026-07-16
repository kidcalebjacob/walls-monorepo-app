import { FinalCta } from "@/components/kenoo/final-cta";
import { SiteShell } from "@/components/kenoo/site-shell";
import { KENOO_MODULES } from "@/lib/modules";

export default function ProductPage() {
  return (
    <SiteShell>
      <section className="border-b border-kenoo-border pt-16 md:pt-[4.25rem]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
            Product
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.045em] text-kenoo-ink md:text-5xl">
            A complete business OS, designed to stay simple.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-kenoo-muted md:text-lg">
            Kenoo brings CRM, projects, calendar, finance, workflows, and AI
            into one workspace with a consistent, easy-to-read interface.
          </p>
        </div>
      </section>

      <section className="bg-kenoo-canvas">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <div className="space-y-20 md:space-y-28">
            {KENOO_MODULES.map((module, index) => (
              <article
                key={module.id}
                id={module.id}
                className="scroll-mt-28 grid gap-6 md:grid-cols-[200px_1fr] md:gap-12"
              >
                <div>
                  <p className="font-mono text-xs text-kenoo-muted">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-3xl">
                    {module.name}
                  </h2>
                </div>
                <div className="max-w-xl border-t border-kenoo-border pt-6 md:border-t-0 md:pt-0">
                  <p className="font-display text-xl tracking-[-0.02em] text-kenoo-ink">
                    {module.headline}
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-kenoo-muted">
                    {module.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FinalCta />
    </SiteShell>
  );
}
