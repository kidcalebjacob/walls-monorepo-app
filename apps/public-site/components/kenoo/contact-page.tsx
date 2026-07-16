"use client";

import { FormEvent, useState } from "react";

import { SiteShell } from "@/components/kenoo/site-shell";
import { KENOO_PORTAL_URL } from "@/lib/urls";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <SiteShell>
      <section className="pt-16 md:pt-[4.25rem]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
              Contact
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.045em] text-kenoo-ink md:text-5xl">
              Get in touch.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-kenoo-muted md:text-lg">
              Questions about sales, partnerships, or a product walkthrough?
              Send a note, or open a workspace when you’re ready.
            </p>
            <a
              href={KENOO_PORTAL_URL}
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-kenoo-ink px-5 text-sm font-medium text-white transition-colors hover:bg-kenoo-ink/90"
            >
              Open Kenoo
            </a>
          </div>

          <div className="rounded-2xl border border-kenoo-border bg-kenoo-surface p-6 md:p-8">
            {submitted ? (
              <div className="flex min-h-[280px] flex-col justify-center">
                <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
                  Message received.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-kenoo-muted">
                  Thanks. We’ll get back to you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="text-sm text-kenoo-ink">Name</span>
                  <input
                    required
                    name="name"
                    className="mt-2 w-full rounded-xl border border-kenoo-border bg-kenoo-canvas px-3.5 py-2.5 text-sm outline-none transition focus:border-kenoo-accent focus:ring-2 focus:ring-kenoo-accent/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-kenoo-ink">Email</span>
                  <input
                    required
                    type="email"
                    name="email"
                    className="mt-2 w-full rounded-xl border border-kenoo-border bg-kenoo-canvas px-3.5 py-2.5 text-sm outline-none transition focus:border-kenoo-accent focus:ring-2 focus:ring-kenoo-accent/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-kenoo-ink">Company</span>
                  <input
                    name="company"
                    className="mt-2 w-full rounded-xl border border-kenoo-border bg-kenoo-canvas px-3.5 py-2.5 text-sm outline-none transition focus:border-kenoo-accent focus:ring-2 focus:ring-kenoo-accent/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-kenoo-ink">Message</span>
                  <textarea
                    required
                    name="message"
                    rows={4}
                    className="mt-2 w-full resize-none rounded-xl border border-kenoo-border bg-kenoo-canvas px-3.5 py-2.5 text-sm outline-none transition focus:border-kenoo-accent focus:ring-2 focus:ring-kenoo-accent/20"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-kenoo-accent text-sm font-medium text-white transition-colors hover:bg-kenoo-accent-hover"
                >
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
