"use client";

import React, { useState } from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { Plus } from "lucide-react";
import { CardCRM as Card, CardContentCRM as CardContent } from "@/components/agentCRM/agentPeople/custom-ui/card-crm";
import { formatDealTypeLabel } from "@/components/ui/searches/deals-type-search";
import { Deal, ImageStates } from "../types";

// Same fallback as agent people table when no image is available
const FALLBACK_IMAGE_URL = FALLBACK_ICON_URL;

function licdnHostNeedsUnoptimized(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === "media.licdn.com" || host === "static.licdn.com" || host.endsWith(".licdn.com");
  } catch {
    return false;
  }
}

/**
 * next/image: Do not set `img.src` in onError — the prop `src` still points at the broken URL,
 * so every parent re-render re-requests `/_next/image` and floods the console. Track failure in state
 * and swap `src` to the fallback. LinkedIn often returns 404 or non-raster bodies; skip the optimizer
 * for those hosts so Sharp does not loop on "isn't a valid image".
 */
function StableRemoteImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const effective = !src || failed ? FALLBACK_IMAGE_URL : src;
  const unoptimized = !failed && !!src && licdnHostNeedsUnoptimized(src);
  return (
    <Image
      src={effective}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized={unoptimized}
      onError={() => setFailed(true)}
    />
  );
}

type ColumnWidths = {
  name: number;
  company: number;
  talent: number;
  dealOwner: number;
  creator: number;
  amount: number;
  stage: number;
  recurrence: number;
  created: number;
};

interface DealsTableRowProps {
  deal: Deal;
  index: number;
  imageStates: ImageStates;
  scrollableRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onImageError: (dealId: string) => void;
  onCompanyClick: (companyId: string, e: React.MouseEvent) => void;
  onDealClick: (dealId: string, e: React.MouseEvent) => void;
  formatDate: (dateString: string | null) => string;
  formatAmount: (amount: number) => string;
  columnWidths: ColumnWidths;
}

export const DealsTableRow = ({
  deal,
  index,
  imageStates,
  scrollableRefs,
  onImageError,
  onCompanyClick,
  onDealClick,
  formatDate,
  formatAmount,
  columnWidths,
}: DealsTableRowProps) => {
  const isPartnership =
    (deal.pipeline ?? "").trim().toLowerCase() === "partnership";

  return (
    <div 
      key={deal.id} 
      className="block relative w-full"
    >
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.name}px` }}
      ></div>
      <Card className="w-full rounded-none bg-kenoo-white backdrop-blur-md border-b border-r border-l-0 border-t-0 border-neutral-300 transition-all duration-300 group relative overflow-visible box-border">
        <CardContent className="py-3 relative z-10">
          <div className="flex items-stretch">
            {/* Sticky Left Section - Deal Name */}
            <div
              className="flex items-center gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 self-stretch overflow-visible bg-kenoo-white"
              style={{ width: `${columnWidths.name}px` }}
            >
              <div
                onClick={(e) => onDealClick(deal.id, e)}
                className="flex items-center gap-4 flex-1 cursor-pointer transition-all duration-200 -my-3 py-3 pl-6 relative bg-kenoo-white hover:bg-gray-200/60 max-w-full min-h-full"
              >
                <div
                  className={
                    isPartnership
                      ? "relative w-[70px] h-[50px] flex items-center flex-shrink-0"
                      : "relative w-[40px] h-[40px] flex items-center justify-center flex-shrink-0"
                  }
                >
                  <StableRemoteImage
                    src={deal.companyLogo}
                    alt={`${deal.company} Logo`}
                    width={40}
                    height={40}
                    className={
                      isPartnership
                        ? "absolute left-0 top-0 w-[40px] h-[40px] rounded-full z-10 bg-neutral-100 object-cover"
                        : "w-[40px] h-[40px] rounded-full z-10 bg-neutral-100 object-cover"
                    }
                  />
                  {isPartnership && (
                    <StableRemoteImage
                      src={(deal.talent?.[0]?.avatar_url) || deal.dealOwnerProfilePicture}
                      alt={deal.talent?.[0]?.name || deal.dealOwner || "Profile"}
                      width={40}
                      height={40}
                      className="absolute left-5 top-0 w-[40px] h-[40px] rounded-full transition-all duration-300 ease-in-out group-hover:left-8 object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {deal.dealName}
                  </p>
                  <p className="text-sm text-muted-foreground font-light truncate">
                    {formatDealTypeLabel(deal.pipeline ?? '')}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Right Section - Additional Information */}
            <div 
              ref={(el) => {
                if (el) {
                  scrollableRefs.current[index] = el;
                }
              }}
              className="flex-1 overflow-x-hidden pr-0 flex items-center"
            >
              <div className="flex items-center min-w-max pl-0" style={{ gap: '0.5rem' }}>
                {/* Company */}
                <div className="flex items-center gap-2 flex-shrink-0 pl-6 overflow-hidden" style={{ width: `${columnWidths.company}px` }}>
                  {deal.companyId ? (
                    <button
                      onClick={(e) => onCompanyClick(deal.companyId!, e)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-300/50 transition-colors cursor-pointer w-fit"
                    >
                      {deal.companyLogo && !imageStates[deal.id]?.companyFailed && (
                        <Image
                          src={deal.companyLogo}
                          alt={`${deal.company} logo`}
                          width={24}
                          height={24}
                          className="rounded-full object-contain flex-shrink-0"
                          onError={() => {
                            onImageError(deal.id);
                          }}
                        />
                      )}
                      <span className="text-sm font-light text-foreground whitespace-nowrap">
                        {deal.company || '—'}
                      </span>
                    </button>
                  ) : (
                    <button
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-300/50 transition-colors cursor-pointer"
                      disabled
                    >
                      <Plus className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                      <span className="text-sm font-light text-foreground whitespace-nowrap">
                        {deal.company || '—'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Talent - linked talent from deal_talent */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.talent}px` }}>
                  {deal.talent && deal.talent.length > 0 ? (
                    <>
                      {deal.talent[0].avatar_url ? (
                        <StableRemoteImage
                          src={deal.talent[0].avatar_url}
                          alt={deal.talent[0].name}
                          width={24}
                          height={24}
                          className="rounded-full object-cover aspect-square w-6 h-6 flex-shrink-0"
                        />
                      ) : (
                        <Image
                          src={FALLBACK_IMAGE_URL}
                          alt=""
                          width={24}
                          height={24}
                          className="rounded-full object-cover aspect-square w-6 h-6 flex-shrink-0"
                        />
                      )}
                      <span className="text-sm font-light text-foreground truncate">
                        {deal.talent.map((t) => t.name).join(', ')}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-light text-muted-foreground truncate">—</span>
                  )}
                </div>

                {/* Contacts - from deal_contacts (people) only */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.creator}px` }}>
                  {deal.contacts && deal.contacts.length > 0 ? (
                    deal.contacts.length === 1 ? (
                      <>
                        {deal.contacts[0].avatar_url ? (
                          <StableRemoteImage
                            src={deal.contacts[0].avatar_url}
                            alt={deal.contacts[0].name}
                            width={24}
                            height={24}
                            className="rounded-full object-cover aspect-square w-6 h-6 flex-shrink-0"
                          />
                        ) : (
                          <Image
                            src={FALLBACK_IMAGE_URL}
                            alt=""
                            width={24}
                            height={24}
                            className="rounded-full object-cover aspect-square w-6 h-6 flex-shrink-0"
                          />
                        )}
                        <span className="text-sm font-light text-foreground truncate">
                          {deal.contacts[0].name}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center -space-x-2 flex-shrink-0">
                          {deal.contacts.slice(0, 4).map((c, i) => (
                            <div
                              key={c.id}
                              className="relative rounded-full overflow-hidden flex-shrink-0"
                              style={{ zIndex: 4 - i }}
                            >
                              <StableRemoteImage
                                src={c.avatar_url}
                                alt={c.name}
                                width={24}
                                height={24}
                                className="rounded-full object-cover aspect-square w-6 h-6"
                              />
                            </div>
                          ))}
                        </div>
                        <span className="text-sm font-light text-foreground truncate">
                          {deal.contacts.map((c) => c.first_name || c.name.split(' ')[0] || '—').join(', ')}
                        </span>
                      </>
                    )
                  ) : (
                    <span className="text-sm font-light text-muted-foreground truncate">—</span>
                  )}
                </div>

                {/* Value (sum of deal deliverables; currency-aware; MRR/ARR/WRR/BWRR/QRR when recurring with no count) */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.amount}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {deal.amountDisplay ?? (deal.mrrAmount != null && deal.valueAmount != null
                      ? `${formatAmount(deal.mrrAmount)} MRR + ${formatAmount(deal.valueAmount)}`
                      : `${formatAmount(deal.amount)}${deal.valueLabel ?? ''}`)}
                  </p>
                </div>

                {/* Stage */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.stage}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {deal.stage || '—'}
                  </p>
                </div>

                {/* Recurrence */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.recurrence}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {deal.recurrence || '—'}
                  </p>
                </div>

                {/* Deal owner */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.dealOwner}px` }}>
                  {deal.dealOwnerProfilePicture ? (
                    <StableRemoteImage
                      src={deal.dealOwnerProfilePicture}
                      alt={deal.dealOwner}
                      width={24}
                      height={24}
                      className="rounded-full object-cover aspect-square w-6 h-6 flex-shrink-0"
                    />
                  ) : (
                    <Image
                      src={FALLBACK_IMAGE_URL}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full object-cover aspect-square w-6 h-6 flex-shrink-0"
                    />
                  )}
                  <span className="text-sm font-light text-foreground truncate">
                    {deal.dealOwner || '—'}
                  </span>
                </div>

                {/* Created Date */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.created}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {deal.createdAt ? (() => {
                      try {
                        let dateStr = '';
                        if (typeof deal.createdAt === 'string') {
                          dateStr = deal.createdAt;
                        } else if (deal.createdAt instanceof Date) {
                          dateStr = deal.createdAt.toISOString();
                        } else if (typeof deal.createdAt === 'number') {
                          dateStr = new Date(deal.createdAt).toISOString();
                        } else if (deal.createdAt && typeof deal.createdAt === 'object' && 'seconds' in deal.createdAt) {
                          dateStr = new Date((deal.createdAt as any).seconds * 1000).toISOString();
                        }
                        return dateStr ? formatDate(dateStr) : '—';
                      } catch {
                        return '—';
                      }
                    })() : '—'}
                  </p>
                </div>
                {/* Spacer for proper scroll boundary */}
                <div style={{ width: '1.5rem' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

