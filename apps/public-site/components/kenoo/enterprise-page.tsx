"use client";

import { FormEvent, useState } from "react";

import { SiteShell } from "@/components/kenoo/site-shell";

const COMPANY_SIZES = [
  "1–50",
  "51–200",
  "201–1,000",
  "1,001–5,000",
  "5,000+",
] as const;

const SEAT_RANGES = [
  "10–25",
  "26–50",
  "51–100",
  "101–250",
  "250+",
] as const;

const TIMELINES = [
  "Immediately",
  "Within 30 days",
  "1–3 months",
  "3–6 months",
  "Just exploring",
] as const;

const INDUSTRIES = [
  "Agency / Creative",
  "Media & Entertainment",
  "Technology",
  "Professional services",
  "Retail & CPG",
  "Finance",
  "Healthcare",
  "Other",
] as const;

const USE_CASES = [
  { id: "business", label: "Business" },
  { id: "finance", label: "Finance" },
  { id: "health", label: "Health" },
  { id: "crm", label: "CRM & pipeline" },
  { id: "advertising", label: "Advertising" },
  { id: "ai", label: "AI assist" },
] as const;

const SECURITY_NEEDS = [
  { id: "sso", label: "SSO / SAML" },
  { id: "roles", label: "Advanced roles & permissions" },
  { id: "soc2", label: "SOC 2 / compliance review" },
  { id: "msa", label: "Custom MSA / DPA" },
  { id: "integrations", label: "Custom integrations" },
  { id: "dedicated", label: "Dedicated success / SLA" },
] as const;

const fieldClassName =
  "mt-2 w-full rounded-xl border border-kenoo-border bg-kenoo-canvas px-3.5 py-2.5 text-sm outline-none transition focus:border-kenoo-accent focus:ring-2 focus:ring-kenoo-accent/20";

const selectClassName = `${fieldClassName} appearance-none bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat pr-10`;

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b6b6b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

const ENTERPRISE_POINTS = [
  {
    title: "Security & access",
    body: "SSO, advanced roles, and compliance reviews for teams that need controlled rollout.",
  },
  {
    title: "Scale without the clutter",
    body: "Unlimited seats, full suite access, and integrations that fit how your organization already works.",
  },
  {
    title: "Dedicated partnership",
    body: "Onboarding, success support, and SLAs so larger teams get a clear path from pilot to production.",
  },
] as const;

export default function EnterprisePage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      fullName: String(data.get("fullName") ?? ""),
      workEmail: String(data.get("workEmail") ?? ""),
      jobTitle: String(data.get("jobTitle") ?? ""),
      phone: String(data.get("phone") ?? ""),
      companyName: String(data.get("companyName") ?? ""),
      companyWebsite: String(data.get("companyWebsite") ?? ""),
      industry: String(data.get("industry") ?? ""),
      companySize: String(data.get("companySize") ?? ""),
      estimatedSeats: String(data.get("estimatedSeats") ?? ""),
      timeline: String(data.get("timeline") ?? ""),
      currentTools: String(data.get("currentTools") ?? ""),
      useCases: USE_CASES.filter((item) => data.get(`useCase_${item.id}`) === "on").map(
        (item) => item.id,
      ),
      securityNeeds: SECURITY_NEEDS.filter(
        (item) => data.get(`security_${item.id}`) === "on",
      ).map((item) => item.id),
      notes: String(data.get("notes") ?? ""),
    };

    // Ready for a future API route — keep submission client-side for now.
    console.info("[enterprise-inquiry]", payload);
    setSubmitted(true);
  }

  return (
    <SiteShell>
      <section className="relative overflow-hidden border-b border-kenoo-border pt-16 md:pt-[4.25rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 20% -10%, rgba(11,110,255,0.08), transparent 55%), radial-gradient(ellipse 45% 35% at 95% 15%, rgba(17,17,17,0.03), transparent 50%), linear-gradient(180deg, #fcfcfc 0%, #ffffff 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
            Enterprise
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.045em] text-kenoo-ink md:text-5xl">
            Kenoo for organizations that need more.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-kenoo-muted md:text-lg">
            Tell us about your team, security requirements, and rollout plans.
            We’ll follow up with a tailored enterprise proposal.
          </p>
          <a
            href="#enterprise-inquiry"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-kenoo-accent px-5 text-sm font-medium text-white transition-colors hover:bg-kenoo-accent-hover"
          >
            Start enterprise inquiry
          </a>
        </div>
      </section>

      <section className="border-b border-kenoo-border bg-kenoo-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3 md:gap-12 md:px-8 md:py-20">
          {ENTERPRISE_POINTS.map((point) => (
            <div key={point.title}>
              <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-kenoo-ink">
                {point.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-kenoo-muted md:text-[15px]">
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="enterprise-inquiry"
        className="scroll-mt-24 bg-kenoo-canvas"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-muted">
              Inquiry
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-kenoo-ink md:text-4xl">
              Submit your enterprise details.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-kenoo-muted">
              Share the essentials below. Prefer email? Reach us at{" "}
              <a
                href="mailto:enterprise@kenoo.io"
                className="font-medium text-kenoo-ink underline decoration-kenoo-border underline-offset-4 transition-colors hover:decoration-kenoo-ink"
              >
                enterprise@kenoo.io
              </a>
              .
            </p>

            <div className="mt-10 rounded-2xl border border-kenoo-border bg-kenoo-surface p-6 md:p-8">
              {submitted ? (
                <div className="flex min-h-[320px] flex-col justify-center">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-kenoo-accent">
                    Submitted
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em] text-kenoo-ink md:text-3xl">
                    Inquiry received.
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-kenoo-muted md:text-base">
                    Thanks — our team will review your details and follow up
                    shortly with next steps for enterprise onboarding.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-10">
                  <div className="space-y-5">
                    <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-kenoo-ink">
                      Contact
                    </h3>
                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">Full name</span>
                        <input
                          required
                          name="fullName"
                          autoComplete="name"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">Work email</span>
                        <input
                          required
                          type="email"
                          name="workEmail"
                          autoComplete="email"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">Job title</span>
                        <input
                          required
                          name="jobTitle"
                          autoComplete="organization-title"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">
                          Phone{" "}
                          <span className="text-kenoo-muted">(optional)</span>
                        </span>
                        <input
                          type="tel"
                          name="phone"
                          autoComplete="tel"
                          className={fieldClassName}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-5 border-t border-kenoo-border pt-10">
                    <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-kenoo-ink">
                      Company
                    </h3>
                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="text-sm text-kenoo-ink">
                          Company name
                        </span>
                        <input
                          required
                          name="companyName"
                          autoComplete="organization"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">
                          Company website
                        </span>
                        <input
                          required
                          type="url"
                          name="companyWebsite"
                          placeholder="https://"
                          autoComplete="url"
                          className={fieldClassName}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">Industry</span>
                        <select
                          required
                          name="industry"
                          defaultValue=""
                          className={selectClassName}
                          style={{ backgroundImage: selectChevron }}
                        >
                          <option value="" disabled>
                            Select industry
                          </option>
                          {INDUSTRIES.map((industry) => (
                            <option key={industry} value={industry}>
                              {industry}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">
                          Company size
                        </span>
                        <select
                          required
                          name="companySize"
                          defaultValue=""
                          className={selectClassName}
                          style={{ backgroundImage: selectChevron }}
                        >
                          <option value="" disabled>
                            Employees
                          </option>
                          {COMPANY_SIZES.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm text-kenoo-ink">
                          Estimated seats
                        </span>
                        <select
                          required
                          name="estimatedSeats"
                          defaultValue=""
                          className={selectClassName}
                          style={{ backgroundImage: selectChevron }}
                        >
                          <option value="" disabled>
                            Team size on Kenoo
                          </option>
                          {SEAT_RANGES.map((range) => (
                            <option key={range} value={range}>
                              {range}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-5 border-t border-kenoo-border pt-10">
                    <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-kenoo-ink">
                      Requirements
                    </h3>

                    <label className="block">
                      <span className="text-sm text-kenoo-ink">Timeline</span>
                      <select
                        required
                        name="timeline"
                        defaultValue=""
                        className={selectClassName}
                        style={{ backgroundImage: selectChevron }}
                      >
                        <option value="" disabled>
                          When do you want to start?
                        </option>
                        {TIMELINES.map((timeline) => (
                          <option key={timeline} value={timeline}>
                            {timeline}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <p className="text-sm text-kenoo-ink">
                        Primary use cases
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {USE_CASES.map((item) => (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-center gap-3 text-sm text-kenoo-ink"
                          >
                            <input
                              type="checkbox"
                              name={`useCase_${item.id}`}
                              className="size-4 rounded border-kenoo-border text-kenoo-accent accent-kenoo-accent"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-kenoo-ink">
                        Security & enterprise needs
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {SECURITY_NEEDS.map((item) => (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-center gap-3 text-sm text-kenoo-ink"
                          >
                            <input
                              type="checkbox"
                              name={`security_${item.id}`}
                              className="size-4 rounded border-kenoo-border text-kenoo-accent accent-kenoo-accent"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-sm text-kenoo-ink">
                        Current tools{" "}
                        <span className="text-kenoo-muted">(optional)</span>
                      </span>
                      <input
                        name="currentTools"
                        placeholder="e.g. Salesforce, Notion, Slack"
                        className={fieldClassName}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-kenoo-ink">
                        Additional notes{" "}
                        <span className="text-kenoo-muted">(optional)</span>
                      </span>
                      <textarea
                        name="notes"
                        rows={4}
                        placeholder="Anything else we should know about rollout, integrations, or constraints."
                        className={`${fieldClassName} resize-none`}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-kenoo-accent text-sm font-medium text-white transition-colors hover:bg-kenoo-accent-hover"
                  >
                    Submit enterprise inquiry
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
