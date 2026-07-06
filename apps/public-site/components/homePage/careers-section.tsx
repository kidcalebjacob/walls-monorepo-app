"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  useScroll,
} from "framer-motion";

interface CareersSectionProps {
  isMobileView: boolean;
}

export function CareersSection({ isMobileView }: CareersSectionProps) {
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const stripXVal = useMotionValue(0);
  const stripX = useTransform(stripXVal, (v) => `${v}%`);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 0.5, 1], ["-18%", "0%", "22%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1.04, 1]);

  useAnimationFrame((_time, delta) => {
    const baseSpeed = 0.6;
    const deltaSeconds = delta / 1000;
    const increment = baseSpeed * deltaSeconds;
    let x = stripXVal.get() - increment;
    while (x < -50) x += 50;
    stripXVal.set(x);
  });

  return (
    <>
      <section ref={sectionRef} className="relative min-h-screen w-full overflow-hidden bg-[#2c51ff]">
        <div className="relative flex w-full min-h-screen flex-col items-center justify-center overflow-hidden">
          {/* Square image: starts off-screen top, very large; moves down and scales down on scroll */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="relative w-[min(70vw,20rem)] aspect-square md:w-[min(60vw,24rem)] lg:w-[min(50vw,28rem)]"
              style={{ y: imageY, scale: imageScale }}
            >
              <Image
                src="https://assets.wallsentertainment.com/careers-design.png"
                alt=""
                fill
                className="object-contain"
                sizes="(max-width: 768px) 90vw, (max-width: 1024px) 85vw, 80vw"
              />
            </motion.div>
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 md:px-10 py-12 md:py-16">
            <h2 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-walls-yellow uppercase tracking-tight leading-[0.95]">
              Entertainment
              <br />
              Careers
            </h2>
            <p className="mt-4 md:mt-6 text-xl md:text-xl lg:text-2xl text-walls-yellow font-light tracking-tight">
              That make an impact.
            </p>
          </div>
        </div>
      </section>

      {/* Auto-scroll strip – clickable, Framer Motion underline on hover */}
      <Link
        href="/careers"
        className="group relative block w-full cursor-pointer bg-[#2c51ff] py-8 md:py-7 overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          className="flex w-[max-content] whitespace-nowrap items-center"
          style={{ x: stripX }}
        >
          {[...Array(24)].map((_, i) => (
            <span key={i} className="flex items-center shrink-0">
              <span className="text-walls-yellow uppercase tracking-widest md:tracking-wider text-2xl md:text-xl font-light px-10 md:px-12">
                <span className="relative inline-block">
                  Entertainment Careers
                  <motion.span
                    className="absolute bottom-0 left-0 h-1 md:h-0.5 bg-walls-yellow origin-left"
                    initial={false}
                    animate={{ scaleX: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    style={{ width: "100%" }}
                  />
                </span>
              </span>
              <ChevronRight className="w-8 h-8 md:w-5 md:h-5 text-walls-yellow shrink-0" />
            </span>
          ))}
        </motion.div>
      </Link>
    </>
  );
}
