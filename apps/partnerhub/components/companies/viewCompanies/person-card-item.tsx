"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AnimatedUnderlineLink, cardSurfaceClass } from "../shared";
import { VIEW_COMPANIES_PROFILE_FALLBACK } from "./constants";
import type { CompanyPerson } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function TruncatedTooltipText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className={cn("w-full min-w-0 truncate text-center", className)}>{text}</p>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          avoidCollisions
          collisionPadding={{ top: 8, bottom: 8, left: 16, right: 16 }}
          className="max-w-sm text-center"
        >
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PersonAvatar({
  name,
  photoUrl,
  size = 80,
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
}) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const imageSrc =
    photoUrl && !primaryFailed
      ? photoUrl
      : !fallbackFailed
        ? VIEW_COMPANIES_PROFILE_FALLBACK
        : null;

  if (imageSrc) {
    return (
      <div
        className="relative flex-shrink-0 overflow-hidden rounded-full bg-white"
        style={{ width: size, height: size }}
      >
        <Image
          src={imageSrc}
          alt={name}
          fill
          className="object-cover"
          onError={() => {
            if (photoUrl && !primaryFailed) setPrimaryFailed(true);
            else setFallbackFailed(true);
          }}
          unoptimized
        />
      </div>
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

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

export function PersonCardItem({ person }: { person: CompanyPerson }) {
  const hasStats = person.department || person.country;
  const footerHref = person.email ? `mailto:${person.email}` : person.linkedinUrl;
  const footerLabel = person.email || (person.linkedinUrl ? "LinkedIn" : null);

  return (
    <div className={cn(cardSurfaceClass, "group relative flex flex-col overflow-hidden")}>
      <div className="flex flex-col items-center px-5 pb-5 pt-7">
        <div className="mb-4 flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-white shadow-lg">
          <PersonAvatar name={person.name} photoUrl={person.photoUrl} size={80} />
        </div>
        <p className="w-full truncate text-center text-base font-semibold text-foreground">
          {person.name}
        </p>
        {person.title && (
          <TruncatedTooltipText
            text={person.title}
            className="mt-1 text-[10px] font-light uppercase tracking-[0.14em] text-neutral-400"
          />
        )}
      </div>

      {hasStats && (
        <div className="flex border-t border-neutral-200/60 bg-white/40">
          {person.department && (
            <div
              className={cn(
                "flex-1 px-3 py-3.5 text-center",
                person.country && "border-r border-neutral-200/60"
              )}
            >
              <p className="truncate text-sm font-semibold text-neutral-900">{person.department}</p>
              <p className="mt-1 text-[9px] font-light uppercase tracking-[0.12em] text-neutral-400">
                Department
              </p>
            </div>
          )}
          {person.country && (
            <div className="flex-1 px-3 py-3.5 text-center">
              <p className="truncate text-sm font-semibold text-neutral-900">{person.country}</p>
              <p className="mt-1 text-[9px] font-light uppercase tracking-[0.12em] text-neutral-400">
                Country
              </p>
            </div>
          )}
        </div>
      )}

      {footerHref && footerLabel && (
        <AnimatedUnderlineLink
          href={footerHref}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 flex w-full items-center justify-center border-t border-neutral-200/60 px-4 py-3 text-[11px] font-light text-neutral-500"
        >
          {footerLabel}
        </AnimatedUnderlineLink>
      )}
    </div>
  );
}
