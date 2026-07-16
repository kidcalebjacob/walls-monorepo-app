"use client";

import { motion } from "framer-motion";

import { ChromeFrame } from "@/components/kenoo/chrome-frame";

const nav = ["CRM", "Projects", "Calendar", "Finance", "AI"];

const pipeline = [
  { name: "Northline Studio", stage: "Proposal", value: "$48k" },
  { name: "Harbor Collective", stage: "Negotiation", value: "$22k" },
  { name: "Veld Digital", stage: "Won", value: "$61k" },
];

const tasks = [
  { title: "Send revised SOW", meta: "Today · Maya" },
  { title: "Invoice #1042", meta: "Tomorrow · Finance" },
  { title: "Kickoff: Veld", meta: "Thu · Projects" },
];

export function ProductMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full border-t border-kenoo-border bg-kenoo-surface"
    >
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <ChromeFrame className="flex w-full rounded-2xl shadow-[0_24px_80px_-40px_rgba(17,17,17,0.35)]">
          <div className="overflow-hidden rounded-[14.5px] bg-kenoo-white">
            <div className="flex items-center gap-2 border-b border-kenoo-border bg-kenoo-surface px-4 py-3">
              <span className="size-2.5 rounded-full bg-kenoo-subtle" />
              <span className="size-2.5 rounded-full bg-kenoo-subtle" />
              <span className="size-2.5 rounded-full bg-kenoo-subtle" />
              <span className="ml-3 font-mono text-[11px] tracking-wide text-kenoo-muted">
                kenoo.io / workspace
              </span>
            </div>

            <div className="grid min-h-[280px] md:min-h-[360px] md:grid-cols-[200px_1fr]">
              <aside className="hidden border-r border-kenoo-border bg-kenoo-surface p-4 md:block">
                <p className="font-display text-sm font-semibold tracking-[-0.03em]">
                  Kenoo
                </p>
                <ul className="mt-6 space-y-1">
                  {nav.map((item, i) => (
                    <li
                      key={item}
                      className={
                        i === 0
                          ? "rounded-lg bg-kenoo-subtle px-3 py-2 text-sm font-medium text-kenoo-ink"
                          : "rounded-lg px-3 py-2 text-sm text-kenoo-muted"
                      }
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </aside>

              <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-6">
                <section className="rounded-xl border border-kenoo-border bg-kenoo-surface p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-kenoo-ink">
                      Pipeline
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-kenoo-accent">
                      Live
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {pipeline.map((row) => (
                      <li
                        key={row.name}
                        className="flex items-center justify-between gap-3 border-b border-kenoo-border/70 pb-3 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm text-kenoo-ink">{row.name}</p>
                          <p className="text-xs text-kenoo-muted">{row.stage}</p>
                        </div>
                        <p className="font-mono text-xs text-kenoo-ink">
                          {row.value}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-xl border border-kenoo-border bg-kenoo-surface p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-kenoo-ink">Today</h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-kenoo-muted">
                      AI sorted
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {tasks.map((task) => (
                      <li
                        key={task.title}
                        className="rounded-lg bg-kenoo-white px-3 py-3"
                      >
                        <p className="text-sm text-kenoo-ink">{task.title}</p>
                        <p className="mt-1 text-xs text-kenoo-muted">
                          {task.meta}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </ChromeFrame>
      </div>
    </motion.div>
  );
}
