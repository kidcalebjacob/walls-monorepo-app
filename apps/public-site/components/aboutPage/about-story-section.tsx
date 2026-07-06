"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ReactNode, useMemo, useRef } from "react";

/** Top / bottom runway while the line is pinned (enter / exit the section). */
const STORY_EDGE_HOLD_VH = 95;

/** Pause on slides 2 … n−1 once they’ve landed (readable beat). */
const STORY_INLINE_SLIDE_HOLD_VH = 48;

/** Horizontal scrub distance between two slides — longer ⇒ smoother glide. */
const STORY_TRANSITION_VH = 82;

function smootherstep(u: number) {
  const t = Math.min(1, Math.max(0, u));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

type StoryProgressKnot = { t: number; p: number };

function buildStoryProgressKnots(slideCount: number): {
  scrollHeightVh: number;
  knots: StoryProgressKnot[];
} {
  const n = slideCount;
  if (n <= 1) {
    const h = 120;
    return {
      scrollHeightVh: h,
      knots: [
        { t: 0, p: 0 },
        { t: 1, p: 0 },
      ],
    };
  }

  /** Cumulative VH before normalizing → scroll progress */
  let cum = 0;
  const knotsVh: { vh: number; p: number }[] = [{ vh: 0, p: 0 }];

  cum += STORY_EDGE_HOLD_VH;
  knotsVh.push({ vh: cum, p: 0 });

  const steps = n - 1;

  for (let k = 0; k < steps; k++) {
    cum += STORY_TRANSITION_VH;
    knotsVh.push({ vh: cum, p: (k + 1) / steps });

    const afterLastMiddle = k === steps - 1;
    cum += afterLastMiddle ? STORY_EDGE_HOLD_VH : STORY_INLINE_SLIDE_HOLD_VH;
    knotsVh.push({ vh: cum, p: (k + 1) / steps });
  }

  const totalVh = Math.max(cum, 1);
  const knots = knotsVh.map((k) => ({ t: k.vh / totalVh, p: k.p }));
  return { scrollHeightVh: totalVh, knots };
}

function sampleStoryProgress(knots: StoryProgressKnot[], tRaw: number) {
  const t = clamp01(tRaw);
  if (knots.length < 2) return knots[0]?.p ?? 0;

  let seg = knots.length - 2;
  for (let i = 0; i < knots.length - 1; i++) {
    if (t <= knots[i + 1].t + 1e-12) {
      seg = i;
      break;
    }
  }

  const a = knots[seg];
  const b = knots[seg + 1];
  const span = b.t - a.t;
  if (span <= 1e-12) return a.p;

  if (Math.abs(a.p - b.p) <= 1e-9) {
    return a.p;
  }

  const uLin = clamp01((t - a.t) / span);
  return a.p + (b.p - a.p) * smootherstep(uLin);
}

const STORY_TEXT_CLASS =
  "w-full max-w-5xl text-3xl font-black uppercase leading-[1.38] text-black/80 sm:text-4xl sm:leading-[1.34] md:text-5xl md:leading-[1.28]";

const STORY_HIGHLIGHT_CLASS =
  "box-decoration-clone underline decoration-walls-yellow decoration-[6px] underline-offset-[0.08em] sm:decoration-[8px] sm:underline-offset-[0.1em]";

const STORY_PANELS: { id: string; content: ReactNode }[] = [
  {
    id: "open",
    content: (
      <>
        we opened in 2024. no funding. just one collective idea,
        set to prove that the right mix of{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>creativity</span> and{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>relentlessness</span> can{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>
          build anything from nothing
        </span>
        .
      </>
    ),
  },
  {
    id: "montreal",
    content: (
      <>
        most of us are based in montreal, but our talent is global.
        we&apos;re fully remote, yet{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>tight-knit</span>.
      </>
    ),
  },
  {
    id: "agencies",
    content: (
      <>
        we&apos;ve worked at big agencies but we had more fun building our
        own way, reimagining what it means to{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>support talent</span>.
      </>
    ),
  },
  {
    id: "think",
    content: (
      <>
        we move fast, challenge convention, and{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>
          build the future we want to see
        </span>
        .
      </>
    ),
  },
  {
    id: "core",
    content: (
      <>
        we believe in big ideas. and we believe in execution even more. with{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>creativity at the core</span> of
        every decision.
      </>
    ),
  },
  {
    id: "brands",
    content: (
      <>
        we&apos;ve worked with{" "}
        <span className={STORY_HIGHLIGHT_CLASS}>brands &amp; celebrities</span>{" "}
        like...
      </>
    ),
  },
];

function StoryPanel({
  index,
  total,
  progress,
  children,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
  children: ReactNode;
}) {
  const alignRight = index % 2 === 1;
  const focus = useTransform(progress, (p) => {
    const position = p * (total - 1);
    return Math.max(0, 1 - Math.abs(position - index) * 1.15);
  });

  const opacity = useTransform(focus, [0, 1], [0.12, 1]);
  const scale = useTransform(focus, [0, 1], [0.9, 1]);
  const textX = useTransform(focus, [0, 1], [alignRight ? 40 : -40, 0]);

  return (
    <article className="relative flex h-[100svh] w-screen shrink-0 items-center justify-center px-6 sm:px-10">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black text-[clamp(6rem,22vw,14rem)] leading-none text-black/[0.04] select-none"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <motion.div
        className="relative z-10 w-full max-w-5xl"
        style={{ opacity, scale, x: textX }}
      >
        <p
          className={`${STORY_TEXT_CLASS} ${
            alignRight ? "text-right" : "text-left"
          }`}
        >
          {children}
        </p>
      </motion.div>
    </article>
  );
}

function HorizontalStoryScroll() {
  const containerRef = useRef<HTMLElement>(null);
  const slideCount = STORY_PANELS.length;

  const { scrollHeightVh, knots } = useMemo(
    () => buildStoryProgressKnots(slideCount),
    [slideCount],
  );

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const progress = useTransform(scrollYProgress, (tv) =>
    clamp01(sampleStoryProgress(knots, tv)),
  );
  const x = useTransform(
    progress,
    [0, 1],
    ["0vw", `-${(slideCount - 1) * 100}vw`],
  );

  return (
    <section
      ref={containerRef}
      className="relative z-10 bg-gray-50"
      style={{ height: `${scrollHeightVh}vh` }}
    >
      <motion.div className="sticky top-0 h-[100svh] overflow-hidden bg-gray-50">
        <motion.div className="flex h-full will-change-transform" style={{ x }}>
          {STORY_PANELS.map((panel, index) => (
            <StoryPanel
              key={panel.id}
              index={index}
              total={slideCount}
              progress={progress}
            >
              {panel.content}
            </StoryPanel>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

function StaticStoryStack() {
  return (
    <section className="relative z-10 w-full bg-gray-50">
      {STORY_PANELS.map((panel, index) => (
        <article
          key={panel.id}
          className="flex min-h-[100svh] items-center px-6 py-28 sm:px-10"
        >
          <p className={STORY_TEXT_CLASS}>{panel.content}</p>
        </article>
      ))}
    </section>
  );
}

export function AboutStorySection() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <StaticStoryStack />;
  }

  return <HorizontalStoryScroll />;
}
