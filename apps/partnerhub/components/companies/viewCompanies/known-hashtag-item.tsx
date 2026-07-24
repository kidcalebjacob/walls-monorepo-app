"use client";

import { PartnershipHashtagLabel } from "@/components/partnerships/table/partnership-hashtag-label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AudienceKnownHashtag } from "./audience-analysis.types";

export function KnownHashtagItem({
  detail,
  companyId,
}: {
  detail: AudienceKnownHashtag;
  companyId: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-block align-baseline",
        detail.isLikelyCampaign && "pl-[18px]",
      )}
    >
      {detail.isLikelyCampaign && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="absolute left-0 top-1/2 inline-flex -translate-y-1/2 items-center justify-center"
                aria-label="Likely campaign tag"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-walls-sky ring-2 ring-walls-sky/25" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-light">
              Likely campaign tag
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <PartnershipHashtagLabel
        tag={detail.tag}
        companyId={companyId}
        platforms={detail.platforms}
        postedAts={detail.postedAts}
      />
    </span>
  );
}
