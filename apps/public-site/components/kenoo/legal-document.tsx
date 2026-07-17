import { SiteShell } from "@/components/kenoo/site-shell";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  contactEmail?: string;
};

export function LegalDocument({
  eyebrow,
  title,
  effectiveDate,
  intro,
  sections,
  contactEmail = "hello@kenoo.io",
}: LegalDocumentProps) {
  return (
    <SiteShell>
      <section className="border-b border-kenoo-border pt-16 md:pt-[4.25rem]">
        <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.045em] text-kenoo-ink md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-sm text-kenoo-muted">
            Last updated: {effectiveDate}
          </p>
          <p className="mt-6 text-base leading-relaxed text-kenoo-muted md:text-lg">
            {intro}
          </p>
        </div>
      </section>

      <section className="bg-kenoo-surface">
        <div className="mx-auto max-w-3xl space-y-12 px-5 py-16 md:px-8 md:py-24">
          {sections.map((section) => (
            <article key={section.title}>
              <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-2xl">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-kenoo-muted md:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && section.bullets.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}

          <article>
            <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-2xl">
              Contact
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-kenoo-muted md:text-base">
              Questions about this page? Email us at{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="font-medium text-kenoo-ink underline decoration-kenoo-border underline-offset-4 transition-colors hover:decoration-kenoo-ink"
              >
                {contactEmail}
              </a>
              .
            </p>
          </article>
        </div>
      </section>
    </SiteShell>
  );
}
