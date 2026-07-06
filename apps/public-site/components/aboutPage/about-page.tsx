"use client";

import { useInView } from "react-intersection-observer";
import { PublicHeader } from "@/components/public-header";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import FooterContainer from "@/components/footer-container";
import Image from "next/image";
import { AboutBrandsSection } from "@/components/aboutPage/about-brands-section";
import { AboutRepresentedTalentIntroSection } from "@/components/aboutPage/about-represented-talent-intro-section";
import { AboutRepresentedTalentStackSection } from "@/components/aboutPage/about-represented-talent-stack-section";
import { AboutStoryPeopleCloseSection } from "@/components/aboutPage/about-story-people-close-section";
import { AboutStorySection } from "@/components/aboutPage/about-story-section";

export default function AboutPage() {
  const { ref, inView } = useInView({
    threshold: 0,
    initialInView: true,
  });

  const containerRef = useRef(null);
  const visionScrollRunwayRef = useRef<HTMLElement>(null);
  const visionPanelRef = useRef<HTMLDivElement>(null);
  const [pillIntroActive, setPillIntroActive] = useState(false);

  const { ref: visionInViewRef, inView: visionSectionInView } = useInView({
    threshold: 0.4,
    triggerOnce: true,
  });

  const setVisionPanelRef = (node: HTMLDivElement | null) => {
    visionPanelRef.current = node;
    visionInViewRef(node);
  };

  useEffect(() => {
    if (visionSectionInView) setPillIntroActive(true);
  }, [visionSectionInView]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.8]);

  const { scrollYProgress: visionScrollProgress } = useScroll({
    target: visionScrollRunwayRef,
    offset: ["start start", "end end"],
  });

  const { scrollYProgress: visionCurveProgress } = useScroll({
    target: visionPanelRef,
    offset: ["start start", "end start"],
  });

  const visionBorderRadius = useTransform(visionCurveProgress, [0, 1], [0, 500]);
  const logoRotate = useTransform(visionScrollProgress, [0, 1], [0, -90]);

  return (
    <motion.div
      ref={containerRef}
      className="relative min-h-screen w-full bg-gray-50"
    >
      <motion.div ref={ref} className="absolute top-0 h-1 w-full" />
      <PublicHeader inView={inView} />

      {/* Hero Section */}
      <motion.div
        style={{ opacity, scale }}
        className="pointer-events-none fixed top-0 left-0 z-10 flex h-screen w-full items-center justify-center"
      >
        <motion.div className="space-y-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="font-gloock text-8xl font-bold text-white sm:text-9xl md:text-[10rem] lg:text-[14rem]"
          >
            WALLS
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="relative h-px w-96 bg-white/20"
          >
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.7 }}
              className="absolute top-0 left-0 h-full bg-white"
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <motion.div className="relative z-20 bg-gray-50">
        {/* Vision — 200vh runway keeps yellow sticky until logo rotation completes */}
        <section
          ref={visionScrollRunwayRef}
          className="relative h-[200vh] bg-gray-50"
        >
          <motion.section
            ref={setVisionPanelRef}
            className="sticky top-0 z-20 flex min-h-screen flex-col items-center justify-center overflow-hidden bg-walls-yellow pt-36 pb-24 sm:pt-32 md:pt-36"
            style={{
              borderBottomLeftRadius: visionBorderRadius,
              borderBottomRightRadius: visionBorderRadius,
            }}
          >
            <motion.div className="mx-auto flex w-full max-w-7xl flex-col items-center space-y-6 px-4 text-center sm:space-y-8">
              <h2 className="flex w-full max-w-full flex-col items-center px-3 text-center text-6xl font-black uppercase tracking-tighter text-black [text-shadow:_-1px_1px_2px_rgb(0_0_0_/_10%)] sm:px-4 sm:text-7xl md:text-8xl lg:text-9xl xl:text-[12rem]">
                <motion.div className="relative inline-flex items-center justify-center px-5 sm:px-8 md:px-12">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={
                      pillIntroActive ? { scaleX: [0, 1.015, 1] } : { scaleX: 0 }
                    }
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    style={{ transformOrigin: "center" }}
                    className="absolute inset-0 rounded-[150px] bg-black"
                  />
                  <motion.div
                    initial={{
                      left: "50%",
                      x: "-50%",
                      y: 0,
                      scale: 0.9,
                      opacity: 0,
                    }}
                    animate={
                      pillIntroActive
                        ? {
                            left: "1.15rem",
                            x: 0,
                            y: 0,
                            scale: [0.9, 1.02, 1],
                            opacity: 1,
                          }
                        : {
                            left: "50%",
                            x: "-50%",
                            y: 0,
                            scale: 0.9,
                            opacity: 0,
                          }
                    }
                    transition={{
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                      delay: pillIntroActive ? 0.3 : 0,
                    }}
                    className="absolute top-2 bottom-2 z-10 flex aspect-square items-center justify-center overflow-hidden rounded-full bg-walls-yellow sm:top-3 sm:bottom-3 md:top-4 md:bottom-4"
                  >
                    <motion.div
                      style={{ rotate: logoRotate }}
                      className="flex h-[58%] w-[58%] items-center justify-center"
                    >
                      <Image
                        src="/images/WBlack.svg"
                        alt="WALLS Logo"
                        width={48}
                        height={48}
                        className="h-full w-full object-contain"
                      />
                    </motion.div>
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={
                      pillIntroActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }
                    }
                    transition={{
                      duration: 0.35,
                      ease: "easeOut",
                      delay: pillIntroActive ? 0.45 : 0,
                    }}
                    className="relative z-10 whitespace-nowrap py-2 pr-10 pl-[1.35em] font-black leading-none text-walls-yellow sm:py-3 sm:pr-14 sm:pl-[1.4em] md:py-4 md:pr-16 lg:pr-20"
                  >
                    PUSH ALL
                  </motion.span>
                </motion.div>
                <motion.span
                  initial={{ opacity: 0, y: 14 }}
                  animate={
                    pillIntroActive
                      ? {
                          opacity: 1,
                          y: 0,
                        }
                      : { opacity: 0, y: 14 }
                  }
                  transition={{
                    delay: pillIntroActive ? 0.92 : 0,
                    duration: 1.08,
                    ease: [0.19, 1, 0.22, 1],
                  }}
                  className="mt-6 block tracking-tighter will-change-[opacity,transform] sm:mt-4"
                >
                  BOUNDARIES
                </motion.span>
              </h2>
            </motion.div>
          </motion.section>

          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[100svh] bg-gray-50"
          />
        </section>

        <AboutStorySection />

        <div className="overflow-x-hidden">
          <AboutBrandsSection />
          <AboutRepresentedTalentIntroSection />
          <AboutRepresentedTalentStackSection />
          <AboutStoryPeopleCloseSection />
        </div>
      </motion.div>

      <div className="relative z-50">
        <FooterContainer />
      </div>
    </motion.div>
  );
}
