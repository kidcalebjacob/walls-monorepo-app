"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AnimatedUnderlineLink, cardSurfaceClass } from "../shared";
import type { CompanyPartnership } from "./types";
import { formatPartnershipDate } from "./utils";

function TalentAvatar({
  name,
  photoUrl,
  size = 80,
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (photoUrl && !failed) {
    return (
      <div
        className="relative flex-shrink-0 overflow-hidden rounded-full bg-white"
        style={{ width: size, height: size }}
      >
        <Image
          src={photoUrl}
          alt={name}
          fill
          className="object-cover"
          onError={() => setFailed(true)}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200/80"
      style={{ width: size, height: size }}
    >
      <span
        className={cn("font-semibold text-neutral-500", size >= 64 ? "text-base" : "text-[11px]")}
      >
        {initials || "?"}
      </span>
    </div>
  );
}

export function PartnershipCardItem({ partnership }: { partnership: CompanyPartnership }) {
  const hasStats = partnership.platform || partnership.lastPostedAt;
  const footerHref = partnership.contentUrl;
  const lastPostedLabel = formatPartnershipDate(partnership.lastPostedAt);

  return (
    <div className={cn(cardSurfaceClass, "group relative flex flex-col overflow-hidden")}>
      <div className="flex flex-col items-center px-5 pb-5 pt-7">
        <div className="mb-4 flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-white shadow-lg">
          <TalentAvatar name={partnership.talentName} photoUrl={partnership.talentAvatar} size={80} />
        </div>
        <p className="w-full truncate text-center text-base font-semibold text-foreground">
          {partnership.talentName}
        </p>
        {(partnership.talentCategory || partnership.talentCountry) && (
          <p className="mt-1 w-full truncate text-center text-[10px] font-light uppercase tracking-[0.14em] text-neutral-400">
            {[partnership.talentCategory, partnership.talentCountry].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {hasStats && (
        <div className="flex border-t border-neutral-200/60 bg-white/40">
          {partnership.platform && (
            <div
              className={cn(
                "flex-1 px-3 py-3.5 text-center",
                lastPostedLabel && "border-r border-neutral-200/60"
              )}
            >
              <p className="truncate text-sm font-semibold text-neutral-900">
                {partnership.platform}
              </p>
              <p className="mt-1 text-[9px] font-light uppercase tracking-[0.12em] text-neutral-400">
                Platform
              </p>
            </div>
          )}
          {lastPostedLabel && (
            <div className="flex-1 px-3 py-3.5 text-center">
              <p className="truncate text-sm font-semibold text-neutral-900">{lastPostedLabel}</p>
              <p className="mt-1 text-[9px] font-light uppercase tracking-[0.12em] text-neutral-400">
                Last post
              </p>
            </div>
          )}
        </div>
      )}

      {footerHref && (
        <AnimatedUnderlineLink
          href={footerHref}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 flex w-full items-center justify-center border-t border-neutral-200/60 px-4 py-3 text-[11px] font-light text-neutral-500"
        >
          View content
        </AnimatedUnderlineLink>
      )}
    </div>
  );
}
