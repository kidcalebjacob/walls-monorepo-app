"use client";

import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  cubicBezier,
} from "framer-motion";
import Image from "next/image";
import { useMemo, useRef } from "react";
import { ABOUT_BRAND_PARTNERS, type BrandPartner } from "./brand-partners";

const easeIntoFocus = cubicBezier(0.22, 1, 0.36, 1);
const easeOutOfFocus = cubicBezier(0, 0, 0.58, 1);
const focusEase: [typeof easeIntoFocus, typeof easeOutOfFocus] = [
  easeIntoFocus,
  easeOutOfFocus,
];

/** Tile animates only while crossing the center of the viewport. */
const TILE_SCROLL_OFFSET = ["start 0.82", "end 0.18"] as const;

type Side = "L" | "R";

type TileConfig = {
  perspective: number;
  maxTilt: number;
};

function BrandTile({
  brand,
  side,
  config,
}: {
  brand: BrandPartner;
  side: Side;
  config: TileConfig;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({
    target: ref,
    offset: [...TILE_SCROLL_OFFSET],
  });

  const reduce = useReducedMotion();
  const sign = side === "L" ? -1 : 1;
  const { perspective, maxTilt } = config;

  const opacity = useTransform(p, [0, 0.5, 1], [0.25, 1, 0.25], {
    ease: focusEase,
  });

  const ty = useTransform(p, [0, 0.5, 1], ["80%", "0%", "-80%"], {
    ease: focusEase,
  });
  const tz = useTransform(p, [0, 0.5, 1], [240, 0, 240], { ease: focusEase });
  const rx = useTransform(p, [0, 0.5, 1], [maxTilt, 0, -maxTilt], {
    ease: focusEase,
  });
  const tx = useTransform(
    p,
    [0, 0.5, 1],
    [`${sign * 18}%`, "0%", `${sign * 18}%`],
    { ease: focusEase },
  );
  const rot = useTransform(p, [0, 0.5, 1], [-sign * 5, 0, sign * 5], {
    ease: focusEase,
  });
  const sk = useTransform(p, [0, 0.5, 1], [sign * 8, 0, -sign * 8], {
    ease: focusEase,
  });
  const innerSY = useTransform(p, [0, 0.5, 1], [1.45, 1, 1.45], {
    ease: focusEase,
  });

  const logo = (
    <motion.div
      className="relative flex h-[min(28vw,200px)] w-full max-w-[min(42vw,340px)] items-center justify-center will-change-transform sm:h-[min(22vw,260px)] sm:max-w-[min(38vw,420px)] md:h-[200px] md:max-w-[480px] lg:h-[240px] lg:max-w-[560px]"
      style={{
        opacity: reduce ? 1 : opacity,
        x: reduce ? undefined : tx,
        y: reduce ? undefined : ty,
        z: reduce ? undefined : tz,
        rotate: reduce ? undefined : rot,
        rotateX: reduce ? undefined : rx,
        skewX: reduce ? undefined : sk,
      }}
    >
      <motion.div
        className="relative h-full w-full will-change-transform"
        style={{ scaleY: reduce ? undefined : innerSY }}
      >
        <Image
          src={brand.image}
          alt={`${brand.name} logo`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 45vw, 480px"
        />
      </motion.div>
    </motion.div>
  );

  if (reduce) {
    return (
      <figure
        ref={ref}
        className="relative z-10 m-0 flex min-h-[100svh] items-center justify-center overflow-hidden px-4"
      >
        {logo}
      </figure>
    );
  }

  return (
    <motion.figure
      ref={ref}
      className="relative z-10 m-0 flex min-h-[100svh] items-center justify-center overflow-hidden px-4 sm:px-8"
      style={{ perspective, willChange: "transform" }}
    >
      {logo}
    </motion.figure>
  );
}

function ScrollTiltedBrandGrid({
  brands,
}: {
  brands: readonly BrandPartner[];
}) {
  const config = useMemo<TileConfig>(
    () => ({
      perspective: 900,
      maxTilt: 52,
    }),
    [],
  );

  return (
    <motion.div
      className="mx-auto grid w-full max-w-6xl grid-cols-2 overflow-x-hidden"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {brands.map((brand, i) => (
        <BrandTile
          key={brand.name}
          brand={brand}
          side={i % 2 === 0 ? "L" : "R"}
          config={config}
        />
      ))}
    </motion.div>
  );
}

export function AboutBrandsSection() {
  return (
    <section className="relative w-full overflow-x-hidden bg-gray-50">
      <ScrollTiltedBrandGrid brands={ABOUT_BRAND_PARTNERS} />
    </section>
  );
}
