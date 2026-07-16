import { KENOO_PORTAL_URL } from "@/lib/urls";

export function FinalCta() {
  return (
    <section className="border-t border-kenoo-border bg-kenoo-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-20 md:flex-row md:items-center md:px-8 md:py-24">
        <div className="max-w-lg">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-kenoo-ink md:text-4xl">
            Start with a clean workspace.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-kenoo-muted">
            Get set up quickly, then grow into the rest of the platform when your
            team is ready.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={KENOO_PORTAL_URL}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-kenoo-accent px-5 text-sm font-medium text-white transition-colors hover:bg-kenoo-accent-hover"
          >
            Get started
          </a>
          <a
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-kenoo-border px-5 text-sm font-medium text-kenoo-ink transition-colors hover:bg-kenoo-subtle"
          >
            Talk to us
          </a>
        </div>
      </div>
    </section>
  );
}
