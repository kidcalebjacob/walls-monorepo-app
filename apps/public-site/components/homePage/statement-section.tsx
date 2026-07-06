"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { motion, useScroll, useTransform, useMotionValue, useAnimationFrame } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatementSectionProps {
  isMobileView: boolean;
}

const statementTextColor = "rgba(23, 23, 23, 0.9)"; // neutral-900/90
const wallsSkyColor = "#6eadc0";

const STATEMENT_VIDEO_DESKTOP =
  "https://assets.wallsentertainment.com/sky-video-bg.mp4#t=0.001";
const STATEMENT_VIDEO_MOBILE =
  "https://assets.wallsentertainment.com/mobile-sky-punchout-video.mp4";

export function StatementSection({ isMobileView }: StatementSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const statementRef = useRef<HTMLParagraphElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const stripXVal = useMotionValue(0);
  const stripX = useTransform(stripXVal, (v) => `${v}%`);

  useAnimationFrame((_time, delta) => {
    const baseSpeed = 0.6;
    const deltaSeconds = delta / 1000;
    const increment = baseSpeed * deltaSeconds;
    let x = stripXVal.get() - increment;
    while (x < -50) x += 50;
    stripXVal.set(x);
  });

  const { scrollYProgress } = useScroll({
    target: statementRef,
    offset: ["start 1", "start 0.65"],
  });
  const colorProgress = useTransform(
    scrollYProgress,
    [0, 1],
    [statementTextColor, wallsSkyColor]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const play = () => video.play().catch(() => {});
    if (video.readyState >= 2) play();
    else video.addEventListener("loadeddata", play);
    return () => video.removeEventListener("loadeddata", play);
  }, [isMobileView]);

  return (
    <>
    <section className="relative mb-8 flex min-h-0 w-full flex-col overflow-hidden md:mb-0 md:min-h-screen md:block">
      {/* Desktop: SVG mask defs for yellow cutout (video shows through text). Not used on mobile—mask is unreliable on iOS Safari. */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none hidden md:block" width="100%" height="100%" aria-hidden>
        <defs>
          <mask id="yellow-cutout-mask-desktop" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <text x="4%" y="36%" fill="black" fontWeight="900" fontSize="14vw" style={{ letterSpacing: "-0.05em" }}>WALLS</text>
            <text x="4%" y="62%" fill="black" fontWeight="900" fontSize="14vw" style={{ letterSpacing: "-0.05em" }}>ENT.</text>
            <text x="4%" y="88%" fill="black" fontWeight="900" fontSize="14vw" style={{ letterSpacing: "-0.05em" }}>GROUP</text>
          </mask>
        </defs>
      </svg>

      {/* Background while video loads */}
      <div className="absolute inset-0 bg-walls-yellow z-0" aria-hidden />

      <video
        key={isMobileView ? "statement-mobile" : "statement-desktop"}
        ref={videoRef}
        className={cn(
          "z-[1]",
          // Mobile: intrinsic height (no fixed box) so object-contain doesn’t leave a yellow band under the frames
          "relative shrink-0 w-full px-2 pt-12 h-auto max-h-[min(58vh,620px)] object-contain md:pt-0",
          "md:absolute md:inset-0 md:h-full md:w-full md:max-h-none md:max-w-none md:shrink md:px-0 md:pt-0 md:object-cover md:object-center"
        )}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        src={isMobileView ? STATEMENT_VIDEO_MOBILE : STATEMENT_VIDEO_DESKTOP}
      />

      {/* Desktop only: yellow overlay with text cutouts (mask works on desktop). */}
      <div
        className="hidden md:block absolute inset-0 z-[2] bg-walls-yellow statement-yellow-mask-desktop"
        style={{
          maskSize: "cover",
          WebkitMaskSize: "cover",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
        aria-hidden
      />
      <style jsx>{`
        .statement-yellow-mask-desktop {
          mask-image: url(#yellow-cutout-mask-desktop);
          -webkit-mask-image: url(#yellow-cutout-mask-desktop);
        }
      `}</style>

      {/* Content: mobile = stacked under video with minimal gap; desktop = right side, vertically centered */}
      <div className="relative z-10 -mt-3 flex flex-none flex-col justify-start px-4 pb-8 pt-0 pointer-events-none md:absolute md:inset-0 md:mt-0 md:flex-none md:justify-normal md:px-0 md:pb-0 md:pt-0">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 pointer-events-auto md:absolute md:mx-0 md:w-auto md:max-w-xl md:items-end md:left-auto md:right-10 md:top-1/2 md:-translate-y-1/2 lg:right-12">
          <p
            ref={statementRef}
            className="w-full text-center md:text-right text-3xl leading-tight md:text-4xl lg:text-5xl md:leading-snug font-light text-neutral-900/90"
          >
            Turning{" "}
            <motion.span style={{ color: colorProgress }}>talent</motion.span> into{" "}
            <motion.span style={{ color: colorProgress }}>brands</motion.span>,
            <br />
            and <motion.span style={{ color: colorProgress }}>stories</motion.span>{" "}
            into <motion.span style={{ color: colorProgress }}>legacies</motion.span>
            .
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-3 md:gap-3 px-8 py-4 md:px-8 md:py-2.5 min-h-[3.75rem] md:min-h-0 text-2xl md:text-3xl rounded-full text-neutral-900/90 font-light uppercase tracking-wider md:tracking-wide border-2 md:border border-neutral-900/90 hover:bg-neutral-900 hover:text-walls-yellow transition-colors duration-300 self-center md:self-end"
          >
            The WALLS Way
            <ArrowRight className="w-7 h-7 md:w-6 md:h-6 shrink-0" />
          </Link>
        </div>
      </div>
    </section>

      {/* Auto-scroll strip – same as careers, "Our story" */}
      <Link
        href="/about"
        className="group relative block w-full cursor-pointer bg-walls-yellow py-8 md:py-7 overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          className="flex w-[max-content] whitespace-nowrap items-center"
          style={{ x: stripX }}
        >
          {[...Array(24)].map((_, i) => (
            <span key={i} className="flex items-center shrink-0">
              <span className="text-neutral-900 uppercase tracking-widest md:tracking-wider text-2xl md:text-xl font-light px-10 md:px-12">
                <span className="relative inline-block">
                  Our story
                  <motion.span
                    className="absolute bottom-0 left-0 h-1 md:h-0.5 bg-neutral-900 origin-left"
                    initial={false}
                    animate={{ scaleX: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    style={{ width: "100%" }}
                  />
                </span>
              </span>
              <ChevronRight className="w-8 h-8 md:w-5 md:h-5 text-neutral-900 shrink-0" />
            </span>
          ))}
        </motion.div>
      </Link>
    </>
  );
}
