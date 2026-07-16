"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

export function Philosophy() {
  const { ref, inView } = useInView({ threshold: 0.35, triggerOnce: true });

  return (
    <section ref={ref} className="border-t border-kenoo-border bg-kenoo-surface">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
            Philosophy
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-kenoo-ink md:text-4xl">
            Keep the depth.
            <br />
            Remove the friction.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-kenoo-muted md:text-lg">
            Modern teams need real capability from their software. Kenoo gives
            you a full suite for day-to-day operations, designed to stay clear
            and easy to use.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
