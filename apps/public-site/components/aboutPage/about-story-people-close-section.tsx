"use client";

import Link from "next/link";
import { ReactNode } from "react";

/** Strong editorial slab — aligns with horizontal story typography */
const STORY_PEOPLE_TEXT_CLASS =
  "w-full max-w-[min(100%,54rem)] text-3xl font-black uppercase leading-[1.38] tracking-[-0.02em] text-black/85 sm:text-4xl sm:leading-[1.32] sm:tracking-tight md:text-[2.75rem] md:leading-[1.26] lg:text-5xl lg:leading-[1.22]";

const STORY_PEOPLE_HIGHLIGHT_CLASS =
  "box-decoration-clone underline decoration-walls-yellow decoration-[6px] underline-offset-[0.08em] sm:decoration-[8px] sm:underline-offset-[0.1em]";

const STORY_PEOPLE_PS_CLASS =
  "w-full max-w-[min(100%,54rem)] text-xl font-black uppercase leading-snug tracking-tight text-black/55 sm:text-2xl sm:leading-relaxed md:text-[1.65rem]";

const STORY_PEOPLE_CLOSE_CONTENT: ReactNode = (
  <>
    at the end of the day, we&apos;re just a bunch of people who care about{" "}
    <span className={STORY_PEOPLE_HIGHLIGHT_CLASS}>creativity</span> and{" "}
    <span className={STORY_PEOPLE_HIGHLIGHT_CLASS}>
      challenging the world to think differently
    </span>
    .
  </>
);

/** Closing story beat — left-aligned slab with soft backdrop */
export function AboutStoryPeopleCloseSection() {
  return (
    <section className="relative z-10 w-full overflow-hidden bg-gray-50">
      <div
        aria-hidden
        className="pointer-events-none absolute top-24 right-[-12%] h-[clamp(260px,42vw,480px)] w-[clamp(260px,42vw,480px)] rounded-full bg-gradient-to-bl from-black/[0.04] to-transparent blur-3xl"
      />

      <article className="relative mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col justify-center gap-[clamp(2.5rem,_6vh,_4rem)] px-7 py-[clamp(5rem,_12vh,_8rem)] sm:px-12 lg:px-16 xl:px-[4.25rem]">
        <p className={`${STORY_PEOPLE_TEXT_CLASS} text-left`}>
          {STORY_PEOPLE_CLOSE_CONTENT}
        </p>

        <div className="flex w-full max-w-[min(100%,54rem)] flex-col gap-4 text-left sm:gap-5">
          <p className={`${STORY_PEOPLE_PS_CLASS} text-left`}>
            P.S. thanks for listening to our story, now we want to hear yours
          </p>
          <Link
            href="/contact"
            aria-label="Tell us your story — go to the contact page"
            className="group relative inline-flex w-fit max-w-full items-baseline text-lg font-black uppercase tracking-tight text-black transition-[color,letter-spacing] duration-500 ease-out hover:text-black/90 sm:text-xl md:text-2xl"
          >
            <span className="relative">
              Tell us yours
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-[3px] w-full origin-left scale-x-100 bg-black transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-0 sm:-bottom-1.5 sm:h-1"
              />
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-[3px] w-full origin-right scale-x-0 bg-walls-yellow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 sm:-bottom-1.5 sm:h-1"
              />
            </span>
          </Link>
        </div>
      </article>
    </section>
  );
}
