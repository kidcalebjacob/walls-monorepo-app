import { FinalCta } from "@/components/kenoo/final-cta";
import { SiteShell } from "@/components/kenoo/site-shell";

export default function AboutPage() {
  return (
    <SiteShell>
      <section className="border-b border-kenoo-border pt-16 md:pt-[4.25rem]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
            About
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.045em] text-kenoo-ink md:text-5xl">
            Software should feel calm to use.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-kenoo-muted md:text-lg">
            Business tools are only getting more complex. Kenoo is built to keep
            that power available while making everyday work clearer and easier.
          </p>
        </div>
      </section>

      <section className="bg-kenoo-surface">
        <div className="mx-auto max-w-6xl space-y-16 px-5 py-16 md:px-8 md:py-24">
          <article className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-3xl">
              All-in-one, without the clutter
            </h2>
            <p className="mt-4 text-base leading-relaxed text-kenoo-muted md:text-lg">
              Teams already want CRM, projects, scheduling, finance, and
              automation in one place. Our focus is making that suite reliable,
              readable, and pleasant to use every day.
            </p>
          </article>

          <article className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-3xl">
              Depth with restraint
            </h2>
            <p className="mt-4 text-base leading-relaxed text-kenoo-muted md:text-lg">
              AI, custom workflows, and the full ops stack are all here. The
              interface stays focused so you can see the state of your business
              and move faster.
            </p>
          </article>

          <article className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-3xl">
              Made for operators
            </h2>
            <p className="mt-4 text-base leading-relaxed text-kenoo-muted md:text-lg">
              Kenoo is for teams that care about clarity and dependability. We
              favor fewer flourishes and more software that simply works.
            </p>
          </article>
        </div>
      </section>

      <FinalCta />
    </SiteShell>
  );
}
