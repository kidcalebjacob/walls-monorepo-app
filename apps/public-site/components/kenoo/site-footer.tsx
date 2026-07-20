import { KenooWordmark } from "@walls/ui/kenoo-wordmark";
import Link from "next/link";

import { KENOO_PORTAL_URL } from "@/lib/urls";

const footerLinks = [
  { href: "/solutions", label: "Solutions" },
  { href: "/resources", label: "Resources" },
  { href: "/enterprise", label: "Enterprise" },
];

export function SiteFooter() {
  return (
    <footer className="bg-kenoo-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="max-w-sm">
          <Link href="/" className="inline-flex items-center" aria-label="Kenoo home">
            <KenooWordmark className="h-6 md:h-7" />
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-kenoo-muted">
            A modern business OS for business, finance, health, and the angles
            that come next.
          </p>
          <a
            href="mailto:hello@kenoo.io"
            className="mt-4 inline-block text-sm text-kenoo-muted transition-colors hover:text-kenoo-ink"
          >
            hello@kenoo.io
          </a>
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
