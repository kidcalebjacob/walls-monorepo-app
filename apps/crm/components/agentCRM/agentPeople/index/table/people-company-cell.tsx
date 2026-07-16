"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { animate, motion, useMotionValue } from "framer-motion";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { CompanySearch } from "@/components/ui/searches/companySearch/company-search";
import { cn } from "@/lib/utils";
import { Lead, ImageStates } from "../types";

const HOLD_DURATION_S = 1.2;

interface PeopleCompanyCellProps {
  lead: Lead;
  imageStates: ImageStates;
  companySelectOpen: boolean;
  isUpdating: boolean;
  onCompanySelectOpenChange: (open: boolean) => void;
  onCompanyClick: (companyId: string, e: React.MouseEvent) => void;
  onCompanyUpdate: (company: { id: string; name: string; logo_url?: string | null }) => void;
  onImageError: (leadId: string, type: "profile" | "company") => void;
}

export function PeopleCompanyCell({
  lead,
  imageStates,
  companySelectOpen,
  isUpdating,
  onCompanySelectOpenChange,
  onCompanyClick,
  onCompanyUpdate,
  onImageError,
}: PeopleCompanyCellProps) {
  const holdFill = useMotionValue(0);
  const holdFillPlaybackRef = useRef<ReturnType<typeof animate> | null>(null);
  const holdTriggeredRef = useRef(false);
  const [isPressed, setIsPressed] = useState(false);

  const stopHoldFill = () => {
    holdFillPlaybackRef.current?.stop();
    holdFillPlaybackRef.current = null;
    holdFill.set(0);
  };

  useEffect(() => {
    return () => {
      holdFillPlaybackRef.current?.stop();
    };
  }, [holdFill]);

  const startHold = () => {
    if (isUpdating) return;
    setIsPressed(true);
    holdTriggeredRef.current = false;
    stopHoldFill();

    holdFillPlaybackRef.current = animate(holdFill, 1, {
      duration: HOLD_DURATION_S,
      ease: "linear",
      onComplete: () => {
        holdTriggeredRef.current = true;
        holdFill.set(0);
        setIsPressed(false);
        holdFillPlaybackRef.current = null;
        onCompanySelectOpenChange(true);
      },
    });
  };

  const cancelHold = () => {
    stopHoldFill();
    setIsPressed(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }

    if (lead.companyId) {
      onCompanyClick(lead.companyId, e);
    }
  };

  const companyFailed = imageStates[lead.id]?.companyFailed;

  const companyLogo =
    lead.companyLogo && !companyFailed ? (
      <Image
        src={lead.companyLogo}
        alt={`${lead.company} logo`}
        width={24}
        height={24}
        className="rounded-full object-contain flex-shrink-0"
        onError={() => onImageError(lead.id, "company")}
      />
    ) : lead.companyId ? null : (
      <div className="w-6 h-6 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center flex-shrink-0">
        <Plus className="w-3 h-3 text-gray-400" />
      </div>
    );

  return (
    <Popover open={companySelectOpen} onOpenChange={onCompanySelectOpenChange}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={handleClick}
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          disabled={isUpdating}
          title={
            lead.companyId
              ? "Click to view company · hold to change"
              : "Hold to link company"
          }
          className={cn(
            "relative flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 border border-transparent transition-all duration-300 ease-in-out cursor-pointer w-fit max-w-full min-w-0 overflow-hidden text-sm font-light text-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isPressed
              ? "scale-[0.98] shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]"
              : "hover:scale-[0.98] hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]"
          )}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 rounded-md bg-kenoo-yellow"
            style={{ scaleY: holdFill, transformOrigin: "50% 100%" }}
          />
          <div className="relative z-10 flex items-center gap-2 min-w-0">
            {companyLogo}
            <span className="whitespace-nowrap truncate">
              {lead.company || "—"}
            </span>
          </div>
        </button>
      </PopoverAnchor>
      <PopoverContent
        className="w-72 border-0 bg-transparent p-0 shadow-none"
        align="start"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;
          if (
            target.closest("[data-radix-select-content]") ||
            target.closest("[data-radix-popper-content-wrapper]")
          ) {
            e.preventDefault();
          }
        }}
      >
        <CompanySearch
          value=""
          onChange={() => {}}
          autoOpen
          hideTrigger
          stayOpenOnSelect={false}
          onSelectCompany={(selected) => onCompanyUpdate(selected)}
          onClose={() => onCompanySelectOpenChange(false)}
          contentWidth="match-trigger"
          triggerIcon="none"
          placeholder="Search companies..."
        />
      </PopoverContent>
    </Popover>
  );
}
