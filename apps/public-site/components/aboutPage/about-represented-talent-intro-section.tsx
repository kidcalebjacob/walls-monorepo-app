"use client";

import { ReactNode } from "react";

/** Matches `about-story-section` typography */
const REP_TALENT_TEXT_CLASS =
  "w-full max-w-5xl text-3xl font-black uppercase leading-[1.38] text-black/80 sm:text-4xl sm:leading-[1.34] md:text-5xl md:leading-[1.28]";

const REP_TALENT_HIGHLIGHT_CLASS =
  "box-decoration-clone underline decoration-walls-yellow decoration-[6px] underline-offset-[0.08em] sm:decoration-[8px] sm:underline-offset-[0.1em]";

const REPRESENTED_TALENT_INTRO_CONTENT: ReactNode = (
  <>
    and represent{" "}
    <span className={REP_TALENT_HIGHLIGHT_CLASS}>talent</span> like...
  </>
);

/** Static headline — no scroll-synced horizontal motion (carousel below is drag-driven). */
export function AboutRepresentedTalentIntroSection() {
  return (
    <section className="relative z-10 w-full bg-gray-50">
      <article className="flex min-h-[100svh] items-center justify-center px-6 py-20 sm:px-10">
        <p className={`${REP_TALENT_TEXT_CLASS} text-center`}>
          {REPRESENTED_TALENT_INTRO_CONTENT}
        </p>
      </article>
    </section>
  );
}
