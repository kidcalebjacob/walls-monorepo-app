"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  motion,
  useReducedMotion,
  type PanInfo,
  type Transition,
} from "framer-motion";
import Image from "next/image";
import { normalizeContractType } from "@/lib/representation/contract-type";
import { createClient } from "@walls/supabase/client";

const NAVIGATION_COOLDOWN_MS = 400;
/** Keep the carousel light on a marketing page */
const MAX_EXCLUSIVE_SPOTLIGHT = 10;

export type FeaturedTalentSlide = {
  id: string;
  src: string;
  /** Profile display name; may be empty if missing in DB */
  name: string;
  alt: string;
};

async function fetchActiveTalentSlides(): Promise<FeaturedTalentSlide[]> {
  const supabase = createClient();

  const { data: talentData, error: talentError } = await supabase
    .from("talent")
    .select(
      `
        id,
        avatar_url,
        profile_id,
        contract_type,
        profile:profiles!talent_profile_id_fkey(
          id,
          name
        )
      `,
    )
    .eq("status", "Active")
    .order("id", { ascending: true });

  if (talentError) {
    console.error("About talent showcase: error fetching talent", talentError);
    return [];
  }

  if (!talentData?.length) return [];

  const slides: FeaturedTalentSlide[] = [];

  for (const row of talentData) {
    if (normalizeContractType(row.contract_type) !== "exclusive") {
      continue;
    }

    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const url =
      typeof row.avatar_url === "string" ? row.avatar_url.trim() : "";
    if (!url) continue;

    const displayName =
      typeof profile?.name === "string" ? profile.name.trim() : "";

    slides.push({
      id: String(row.id),
      src: url,
      name: displayName,
      alt:
        displayName.length > 0
          ? `Portrait — ${displayName}`
          : "Represented creator",
    });
  }

  slides.sort((a, b) => {
    const ka = (a.name || a.alt).toLowerCase();
    const kb = (b.name || b.alt).toLowerCase();
    return ka.localeCompare(kb, undefined, { sensitivity: "base" });
  });

  return slides.slice(0, MAX_EXCLUSIVE_SPOTLIGHT);
}

function getCardStyle(index: number, currentIndex: number, total: number) {
  let diff = index - currentIndex;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;

  if (diff === 0) {
    return { y: 0, scale: 1, opacity: 1, zIndex: 5, rotateX: 0 };
  }
  if (diff === -1) {
    return { y: -160, scale: 0.82, opacity: 0.6, zIndex: 4, rotateX: 8 };
  }
  if (diff === -2) {
    return { y: -280, scale: 0.7, opacity: 0.3, zIndex: 3, rotateX: 15 };
  }
  if (diff === 1) {
    return { y: 160, scale: 0.82, opacity: 0.6, zIndex: 4, rotateX: -8 };
  }
  if (diff === 2) {
    return { y: 280, scale: 0.7, opacity: 0.3, zIndex: 3, rotateX: -15 };
  }
  return {
    y: diff > 0 ? 400 : -400,
    scale: 0.6,
    opacity: 0,
    zIndex: 0,
    rotateX: diff > 0 ? -20 : 20,
  };
}

function isStackCardVisible(
  index: number,
  currentIndex: number,
  total: number,
) {
  let diff = index - currentIndex;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return Math.abs(diff) <= 2;
}

export function AboutRepresentedTalentStackSection() {
  const [images, setImages] = useState<FeaturedTalentSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const lastNavigationTime = useRef(0);
  const lenRef = useRef(0);
  lenRef.current = images.length;

  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const slides = await fetchActiveTalentSlides();
      if (cancelled) return;
      setImages(slides);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const len = images.length;
    if (len === 0) return;
    setCurrentIndex((i) => Math.min(Math.max(i, 0), len - 1));
  }, [images.length]);

  const navigate = useCallback((newDirection: number) => {
    const len = lenRef.current;
    if (len === 0) return;

    const now = Date.now();
    if (now - lastNavigationTime.current < NAVIGATION_COOLDOWN_MS) return;
    lastNavigationTime.current = now;

    setCurrentIndex((prev) => {
      if (newDirection > 0) {
        return prev === len - 1 ? 0 : prev + 1;
      }
      return prev === 0 ? len - 1 : prev - 1;
    });
  }, []);

  const onMotionDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 50;
      if (info.offset.y < -threshold) {
        navigate(1);
      } else if (info.offset.y > threshold) {
        navigate(-1);
      }
    },
    [navigate],
  );

  const stackTransition = useMemo<Transition>(
    () =>
      prefersReducedMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 300, damping: 30, mass: 1 },
    [prefersReducedMotion],
  );

  const jumpToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    lastNavigationTime.current = Date.now();
  }, []);

  if (!loading && images.length === 0) {
    return null;
  }

  if (loading || images.length === 0) {
    return (
      <section className="relative flex min-h-[100svh] w-full items-center justify-center bg-gray-50">
        <p className="text-xs font-medium tracking-[0.35em] text-black/40 uppercase">
          Loading creators…
        </p>
      </section>
    );
  }

  const activeSlide = images[currentIndex];
  const nameLabel =
    activeSlide.name.trim().length > 0
      ? activeSlide.name
      : "Represented creator";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured represented talent"
      className="relative flex min-h-[min(100dvh,100svh)] w-full flex-col items-center justify-center overflow-x-hidden bg-gray-50 px-6 pt-28 pb-32 sm:px-10 sm:pt-36 sm:pb-44 lg:pt-44 lg:pb-52"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/[0.02] blur-3xl" />
      </div>

      <div className="relative z-10 grid w-full max-w-7xl grid-cols-1 gap-12 px-4 sm:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.35fr)] sm:items-center sm:gap-8 lg:gap-12 xl:gap-14">
        {/* Drag cue + dots — cue sits to the left of nav dots */}
        <div className="order-3 flex w-full shrink-0 flex-row items-center justify-center gap-10 sm:order-none sm:w-full sm:justify-end sm:justify-self-end sm:gap-10 sm:self-center sm:py-6 sm:pr-2 lg:gap-11 lg:pr-6">
          {!prefersReducedMotion && images.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.6 }}
              aria-hidden
              className="flex shrink-0 flex-col items-center gap-2 text-black/45"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
              </motion.div>
              <span className="text-xs font-medium tracking-[0.2em] uppercase">
                Drag stack
              </span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </motion.div>
            </motion.div>
          )}

          <div className="flex shrink-0 flex-row items-center justify-center gap-3 sm:flex-col sm:gap-2 sm:items-end">
            {images.map((slide, index) => (
              <button
                key={`dot-${slide.id}`}
                type="button"
                onClick={() => {
                  jumpToSlide(index);
                }}
                className={`rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-black max-sm:h-2 max-sm:w-6 sm:h-6 sm:w-2"
                    : "h-2 w-2 bg-black/30 hover:bg-black/50"
                }`}
                aria-label={`Show creator ${index + 1} of ${images.length}`}
                aria-current={index === currentIndex ? true : undefined}
              />
            ))}
          </div>
        </div>

        {/* Card stack — center */}
        <div className="relative order-1 flex w-[280px] shrink-0 justify-center py-10 sm:order-none sm:w-[320px] sm:justify-self-center sm:py-16 lg:py-20">
          <div
            className="relative flex h-[500px] w-full items-center justify-center"
            style={{ perspective: "1200px" }}
          >
            {images.map((image, index) => {
              const showInStack = prefersReducedMotion
                ? index === currentIndex
                : isStackCardVisible(index, currentIndex, images.length);
              if (!showInStack) return null;

              const style = getCardStyle(index, currentIndex, images.length);
              const isCurrent = index === currentIndex;

              const animated = prefersReducedMotion
                ? {
                    y: 0,
                    scale: 1,
                    opacity: 1,
                    rotateX: 0,
                    zIndex: 5,
                  }
                : {
                    y: style.y,
                    scale: style.scale,
                    opacity: style.opacity,
                    rotateX: style.rotateX,
                    zIndex: style.zIndex,
                  };

              return (
                <motion.div
                  key={image.id}
                  className={`absolute touch-pan-x ${
                    isCurrent ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                  }`}
                  animate={animated}
                  transition={stackTransition}
                  drag={prefersReducedMotion || !isCurrent ? false : "y"}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.2}
                  onDragEnd={onMotionDragEnd}
                  style={{
                    transformStyle: "preserve-3d",
                    zIndex: style.zIndex,
                  }}
                >
                  <div
                    className="relative h-[420px] w-[280px] overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.08]"
                    style={{
                      boxShadow: isCurrent
                        ? "0 25px 50px -12px rgb(0 0 0 / 0.15), 0 0 0 1px rgb(0 0 0 / 0.06)"
                        : "0 10px 30px -10px rgb(0 0 0 / 0.1)",
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-black/10 via-transparent to-transparent" />

                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="h-full w-full object-cover object-center"
                      draggable={false}
                      priority={isCurrent}
                      sizes="280px"
                    />

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-gray-50/70 to-transparent" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Name — generous width; asymmetric grid column gives extra room on the right */}
        <div className="order-2 flex w-full justify-center px-2 text-center sm:order-none sm:min-h-[440px] sm:items-center sm:justify-start sm:justify-self-stretch sm:px-4 sm:text-right md:px-6 lg:ps-10">
          <div className="flex w-full max-w-[min(23rem,_100%)] flex-col gap-5 sm:max-w-[min(30rem,_100%)] sm:text-right lg:max-w-[min(480px,_100%)] lg:gap-6">
            <motion.p
              key={activeSlide.id}
              aria-live="polite"
              aria-atomic="true"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
              className="break-words hyphens-auto text-balance font-black uppercase leading-snug tracking-tight text-black/90 text-[clamp(1.8125rem,2.9vw,3.375rem)]"
            >
              {nameLabel}
            </motion.p>
            <p className="shrink-0 font-medium text-[0.6875rem] tracking-[0.28em] text-black/38 uppercase tabular-nums sm:text-right">
              <span aria-hidden>{String(currentIndex + 1).padStart(2, "0")}</span>
              <span className="mx-2 opacity-40" aria-hidden>
                /
              </span>
              <span aria-hidden>{String(images.length).padStart(2, "0")}</span>
              <span className="sr-only">
                Slide {currentIndex + 1} of {images.length}
              </span>
            </p>
          </div>
        </div>
      </div>

    </section>
  );
}
