"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const cardSurfaceClass =
  "rounded-3xl bg-gray-50/90 backdrop-blur-sm border border-neutral-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_22px_-8px_rgba(0,0,0,0.1)]";

export const cardSurfaceInteractiveClass = cn(
  cardSurfaceClass,
  "transition-all duration-300 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99] hover:border-neutral-300/70"
);

export const categoryTileSurfaceClass =
  "rounded-3xl bg-gray-50/90 backdrop-blur-sm border border-neutral-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_22px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:border-neutral-300/70";

export interface LogoPreview {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
}

export interface CompanySubcategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  companyCount: number;
  previewLogos: LogoPreview[];
}

export interface CompanyCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  subcategories: CompanySubcategory[];
  totalCompanies: number;
  previewLogos: LogoPreview[];
}

export interface CompanyItem {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  annualRevenuePrinted: string | null;
  totalFundingPrinted: string | null;
  overview: string | null;
}

export function extractDomain(website: string): string {
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function resolveLogoUrl(preview: LogoPreview): string | null {
  if (preview.logoUrl) return preview.logoUrl;
  if (preview.website) return `https://logo.clearbit.com/${extractDomain(preview.website)}`;
  return null;
}

export function mapJoinToPreview(join: {
  company?: { id: string; name: string; logo_url: string | null; website: string | null } | null;
}): LogoPreview | null {
  const company = join.company;
  if (!company?.id) return null;
  return {
    id: company.id,
    name: company.name || "",
    logoUrl: company.logo_url || null,
    website: company.website || null,
  };
}

export function pickPreviewLogos(sources: LogoPreview[], limit = 3): LogoPreview[] {
  const seen = new Set<string>();
  const withVisual: LogoPreview[] = [];
  const fallback: LogoPreview[] = [];

  for (const source of sources) {
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    if (source.logoUrl || source.website) withVisual.push(source);
    else fallback.push(source);
  }

  return [...withVisual, ...fallback].slice(0, limit);
}

export function companyDetailPath(
  categorySlug: string,
  subcategorySlug: string,
  companyId: string
) {
  return `/companies/${categorySlug}/${subcategorySlug}/${companyId}`;
}

export function mapCompanyRow(c: {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue_printed: string | null;
  total_funding_printed: string | null;
  overview: string | null;
}): CompanyItem {
  return {
    id: c.id,
    name: c.name || "",
    logoUrl: c.logo_url || null,
    website: c.website || null,
    industry: c.industry || null,
    employeeCount: c.employee_count || null,
    annualRevenuePrinted: c.annual_revenue_printed || null,
    totalFundingPrinted: c.total_funding_printed || null,
    overview: c.overview || null,
  };
}

function MosaicLogoCell({ preview }: { preview: LogoPreview | null }) {
  const [failed, setFailed] = useState(false);
  const logoSrc = preview ? resolveLogoUrl(preview) : null;
  const initials = preview?.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (!preview || !logoSrc || failed) {
    return (
      <div className="relative h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200/80">
        {preview && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-wide text-neutral-400">
            {initials || "?"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-white isolate">
      <div className="absolute inset-0 origin-center scale-[1.04] transition-transform duration-500 ease-out group-hover:scale-[1.08] will-change-transform">
        <Image
          src={logoSrc}
          alt={preview.name}
          fill
          className="object-cover"
          onError={() => setFailed(true)}
          unoptimized
        />
      </div>
    </div>
  );
}

function CategoryLogoMosaic({ previews }: { previews: LogoPreview[] }) {
  const slots = Array.from({ length: 3 }, (_, i) => previews[i] ?? null);

  return (
    <div className="relative h-[4.75rem] w-full shrink-0 overflow-hidden border-b border-neutral-200/50">
      <div className="grid h-full grid-cols-3">
        {slots.map((preview, i) => (
          <MosaicLogoCell key={preview?.id ?? `slot-${i}`} preview={preview} />
        ))}
      </div>
    </div>
  );
}

export function CompaniesSearchBar({
  value,
  onChange,
  placeholder = "Search brands by name…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
          value ? "border-b-[var(--walls-sky)]" : "border-neutral-200",
          "focus:border-b-[var(--walls-sky)]"
        )}
      />
    </div>
  );
}

export function CategoryTile({
  count,
  label,
  previewLogos,
  href,
  sublabel,
}: {
  count: number;
  label: string;
  previewLogos: LogoPreview[];
  href: string;
  sublabel?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        categoryTileSurfaceClass,
        "group flex flex-col overflow-hidden p-0 text-left"
      )}
    >
      <CategoryLogoMosaic previews={previewLogos} />
      <div className="relative flex min-h-[7.5rem] flex-col justify-end gap-2.5 px-5 pb-6 pt-6">
        <ArrowRight className="absolute right-5 top-6 h-3.5 w-3.5 text-neutral-300 opacity-0 -translate-x-1 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
        <span className="text-4xl font-black tabular-nums leading-none text-neutral-900">
          {count.toLocaleString()}
        </span>
        <div className="min-w-0">
          <span className="block truncate text-sm font-light uppercase tracking-[0.14em] text-neutral-400">
            {label}
          </span>
          {sublabel && (
            <span className="mt-1 block truncate text-[10px] font-light uppercase tracking-[0.12em] text-neutral-300">
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CompanyLogo({
  name,
  logoUrl,
  size = 44,
  fallbackImageUrl,
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
  fallbackImageUrl?: string | null;
}) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const imageSrc =
    logoUrl && !primaryFailed
      ? logoUrl
      : fallbackImageUrl && !fallbackFailed
        ? fallbackImageUrl
        : null;

  if (imageSrc) {
    const isFallbackOnly = !logoUrl || primaryFailed;
    return (
      <div
        className="relative flex-shrink-0 overflow-hidden rounded-full bg-white"
        style={{ width: size, height: size }}
      >
        <Image
          src={imageSrc}
          alt={name}
          fill
          className={cn(isFallbackOnly ? "object-cover" : "object-contain p-1.5")}
          onError={() => {
            if (logoUrl && !primaryFailed) setPrimaryFailed(true);
            else setFallbackFailed(true);
          }}
          unoptimized
        />
      </div>
    );
  }

  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200/80"
      style={{ width: size, height: size }}
    >
      <span
        className={cn(
          "font-semibold text-neutral-500",
          size >= 64 ? "text-base" : "text-[11px]"
        )}
      >
        {initials || "?"}
      </span>
    </div>
  );
}

export function AnimatedUnderlineLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn("relative inline-block", className)}
    >
      <span className="relative inline-block max-w-full truncate pb-0.5">
        {children}
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-[2px] origin-center bg-[var(--walls-sky)]"
          initial={false}
          animate={{
            scaleX: isHovered ? 1 : 0,
            opacity: isHovered ? 1 : 0,
          }}
          transition={{
            scaleX: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.2, ease: "easeOut" },
          }}
        />
      </span>
    </a>
  );
}

function CompanyWebsiteLink({
  href,
  displayUrl,
}: {
  href: string;
  displayUrl: string;
}) {
  return (
    <AnimatedUnderlineLink
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="relative z-10 flex w-full items-center justify-center border-t border-neutral-200/60 px-4 py-3 text-[11px] font-light text-neutral-500"
    >
      {displayUrl}
    </AnimatedUnderlineLink>
  );
}

export function CompanyCardItem({
  company,
  href,
  onClick,
  afterContent,
  logoLayoutId,
}: {
  company: CompanyItem;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  afterContent?: React.ReactNode;
  logoLayoutId?: string;
}) {
  const displayUrl = company.website
    ? company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;
  const websiteHref = company.website
    ? company.website.startsWith("http")
      ? company.website
      : `https://${company.website}`
    : null;
  const hasStats =
    company.employeeCount || company.annualRevenuePrinted || company.totalFundingPrinted;

  const cardContent = (
    <>
      <div className="flex flex-col items-center px-5 pb-5 pt-7">
        <div className="mb-4 flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-white shadow-lg">
          {logoLayoutId ? (
            <motion.div layoutId={logoLayoutId} className="rounded-full">
              <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={80} />
            </motion.div>
          ) : (
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={80} />
          )}
        </div>
        <p className="w-full truncate text-center text-base font-semibold text-foreground">
          {company.name}
        </p>
        {company.industry && (
          <p className="mt-1 w-full truncate text-center text-[10px] font-light uppercase tracking-[0.14em] text-neutral-400">
            {company.industry}
          </p>
        )}
        {company.overview && (
          <p className="mt-3 line-clamp-2 text-center text-[11px] font-light leading-relaxed text-neutral-500">
            {company.overview}
          </p>
        )}
      </div>

      {hasStats && (
        <div className="flex border-t border-neutral-200/60 bg-white/40">
          {company.employeeCount != null && (
            <div
              className={cn(
                "flex-1 px-3 py-3.5 text-center",
                (company.annualRevenuePrinted || company.totalFundingPrinted) &&
                  "border-r border-neutral-200/60"
              )}
            >
              <p className="text-lg font-black tabular-nums leading-none text-neutral-900">
                {company.employeeCount.toLocaleString()}
              </p>
              <p className="mt-1 text-[9px] font-light uppercase tracking-[0.12em] text-neutral-400">
                Employees
              </p>
            </div>
          )}
          {company.annualRevenuePrinted && (
            <div
              className={cn(
                "flex-1 px-3 py-3.5 text-center",
                company.totalFundingPrinted && "border-r border-neutral-200/60"
              )}
            >
              <p className="truncate text-lg font-black tabular-nums leading-none text-neutral-900">
                {company.annualRevenuePrinted}
              </p>
              <p className="mt-1 text-[9px] font-light uppercase tracking-[0.12em] text-neutral-400">
                Revenue
              </p>
            </div>
          )}
          {company.totalFundingPrinted && (
            <div className="flex-1 px-3 py-3.5 text-center">
              <p className="truncate text-lg font-black tabular-nums leading-none text-neutral-900">
                {company.totalFundingPrinted}
              </p>
              <p className="mt-1 text-[9px] font-light uppercase tracking-[0.12em] text-neutral-400">
                Funding
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );

  const isInteractive = Boolean(href || onClick);

  return (
    <div
      className={cn(
        isInteractive ? cardSurfaceInteractiveClass : cardSurfaceClass,
        "group relative flex flex-col overflow-hidden",
        isInteractive && "cursor-pointer"
      )}
    >
      {href ? (
        <Link href={href} className="block">
          {cardContent}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {cardContent}
        </button>
      ) : (
        cardContent
      )}

      {afterContent}

      {displayUrl && websiteHref && (
        <CompanyWebsiteLink href={websiteHref} displayUrl={displayUrl} />
      )}
    </div>
  );
}

export function CompaniesPageShell({ children }: { children: React.ReactNode }) {
  return <div className="w-full min-w-0 pl-8 pr-4 md:pr-6">{children}</div>;
}
