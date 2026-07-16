import Link from "next/link";

import { KENOO_PORTAL_URL } from "@/lib/urls";

const footerLinks = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-kenoo-border bg-kenoo-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="max-w-sm">
          <p className="font-display text-xl font-semibold tracking-[-0.04em] text-kenoo-ink">
            Kenoo
          </p>
          <p className="mt-3 text-sm leading-relaxed text-kenoo-muted">
            A modern business OS for CRM, projects, calendar, finance, workflows,
            and AI.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-kenoo-muted transition-colors hover:text-kenoo-ink"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={KENOO_PORTAL_URL}
            className="text-kenoo-muted transition-colors hover:text-kenoo-ink"
          >
            Sign in
          </a>
        </div>
      </div>

      <div className="border-t border-kenoo-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-kenoo-muted md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} Kenoo. All rights reserved.</p>
          <div className="flex gap-5">
            <span className="cursor-default">Privacy</span>
            <span className="cursor-default">Terms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
