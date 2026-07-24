"use client";

import React from 'react';
import { AVATAR_FALLBACK_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { Play } from "lucide-react";
import { CardPartnerHub as Card, CardContentPartnerHub as CardContent } from "@/components/ui/card-partnerhub";
import { Partnership, ImageStates } from "../types";
import ReactCountryFlag from "react-country-flag";
import { getCountryCodeForDisplay, getCountryDisplayName } from "@/types/country.types";
import { PartnershipHashtagLabel } from "./partnership-hashtag-label";
import { PartnershipCompanyCell } from "./partnership-company-cell";

type ColumnWidths = {
  name: number;
  talentHq: number;
  talentCategory: number;
  company: number;
  platform: number;
  postedAt: number;
  createdAt: number;
  hashtags: number;
  partnershipUrl: number;
};

interface PartnershipsTableRowProps {
  partnership: Partnership;
  index: number;
  imageStates: ImageStates;
  scrollableRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onImageError: (partnershipId: string, type: 'profile' | 'company') => void;
  onTalentClick: (partnership: Partnership, e: React.MouseEvent) => void;
  onCompanyClick: (companyId: string, e: React.MouseEvent) => void;
  companySelectOpen: boolean;
  onCompanySelectOpenChange: (open: boolean) => void;
  onPartnershipCompanyUpdate: (
    company: { id: string; name: string; logo_url?: string | null }
  ) => void;
  isUpdatingCompany: boolean;
  formatDate: (dateString: string | null) => string;
  formatPlatform: (platform: string | null | undefined) => string;
  getPlatformIcon: (platform: string | null | undefined) => React.ReactNode;
  ensureHttps: (url: string) => string;
  columnWidths: ColumnWidths;
}

export const PartnershipsTableRow = ({
  partnership,
  index,
  imageStates,
  scrollableRefs,
  onImageError,
  onTalentClick,
  onCompanyClick,
  companySelectOpen,
  onCompanySelectOpenChange,
  onPartnershipCompanyUpdate,
  isUpdatingCompany,
  formatDate,
  formatPlatform,
  getPlatformIcon,
  ensureHttps,
  columnWidths,
}: PartnershipsTableRowProps) => {
  const uniquePlatforms = partnership.contentItems.reduce<string[]>((acc, content) => {
    const key = content.platform?.toLowerCase();
    if (!key || acc.some((p) => p.toLowerCase() === key)) return acc;
    acc.push(content.platform);
    return acc;
  }, []);

  return (
    <div 
      key={partnership.id} 
      className="block relative w-full"
    >
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.name}px` }}
      ></div>
      <Card className="w-full rounded-none bg-gray-50 backdrop-blur-md border-b border-r border-l-0 border-t-0 border-neutral-300 transition-all duration-300 group relative overflow-visible box-border">
        <CardContent className="py-3 relative z-10">
          <div className="flex items-stretch">
            {/* Sticky Left Section - Talent Name */}
            <div
              className="flex items-center gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 self-stretch overflow-visible bg-gray-50"
              style={{ width: `${columnWidths.name}px` }}
            >
              <div
                className="flex items-center gap-4 flex-1 cursor-pointer transition-all duration-200 -my-3 py-3 pl-6 relative bg-gray-50 hover:bg-gray-200/60 max-w-full min-h-full"
                onClick={(e) => onTalentClick(partnership, e)}
              >
                <Image
                  src={
                    !imageStates[partnership.id]?.profileFailed && partnership.talentAvatar
                      ? partnership.talentAvatar
                      : AVATAR_FALLBACK_URL
                  }
                  alt={`${partnership.talentName} profile`}
                  width={40}
                  height={40}
                  className={
                    imageStates[partnership.id]?.profileFailed || !partnership.talentAvatar
                      ? "rounded-full object-cover aspect-square border border-neutral-200 w-[40px] h-[40px]"
                      : "rounded-full object-cover aspect-square w-[40px] h-[40px]"
                  }
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallbackUrl = AVATAR_FALLBACK_URL;
                    if (!imageStates[partnership.id]?.profileFailed && partnership.talentAvatar) {
                      onImageError(partnership.id, 'profile');
                      if (target.src !== fallbackUrl) {
                        target.src = fallbackUrl;
                      }
                    } else if (target.src !== fallbackUrl) {
                      target.src = fallbackUrl;
                    }
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {partnership.talentName}
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
                  <PartnershipCompanyCell
                    partnership={partnership}
                    companyFailed={Boolean(imageStates[partnership.id]?.companyFailed)}
                    companySelectOpen={companySelectOpen}
                    isUpdating={isUpdatingCompany}
                    onCompanySelectOpenChange={onCompanySelectOpenChange}
                    onCompanyClick={onCompanyClick}
                    onCompanyUpdate={onPartnershipCompanyUpdate}
                    onImageError={() => onImageError(partnership.id, "company")}
                    ensureHttps={ensureHttps}
                  />
                </div>

                {/* Platforms */}
                <div className="flex items-center gap-1.5 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.platform}px` }}>
                  {uniquePlatforms.length > 0 ? (
                    uniquePlatforms.map((platform) => (
                      <div key={platform.toLowerCase()}>
                        {getPlatformIcon(platform)}
                      </div>
                    ))
                  ) : (
                    <span className="text-sm font-light text-muted-foreground">—</span>
                  )}
                </div>

                {/* Talent HQ */}
                <div
                  className="flex items-center gap-2 flex-shrink-0 overflow-hidden"
                  style={{ width: `${columnWidths.talentHq}px` }}
                >
                  {(() => {
                    const rawCountry = partnership.talentHq || "";
                    const countryDisplayName = getCountryDisplayName(rawCountry);
                    const countryCode = rawCountry ? getCountryCodeForDisplay(rawCountry) : null;
                    const showFlag = countryCode && countryCode !== "UN";
                    return (
                      <>
                        {showFlag && (
                          <div className="relative w-4 h-4 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center">
                            <ReactCountryFlag
                              countryCode={countryCode}
                              svg
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              title={countryDisplayName ? `${countryDisplayName} flag` : "Country flag"}
                            />
                          </div>
                        )}
                        <p className="text-sm font-light text-foreground truncate">
                          {countryDisplayName || "—"}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* Partnership URL */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.partnershipUrl}px` }}>
                  {partnership.partnershipUrl ? (
                    <a
                      href={ensureHttps(partnership.partnershipUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(ensureHttps(partnership.partnershipUrl!), '_blank');
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-[0.5px] border-solid border-neutral-300 bg-gray-50 shadow-none transition-all duration-300 hover:border-neutral-200/80 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)] hover:scale-[0.98] cursor-pointer flex-shrink-0 max-w-full"
                    >
                      <Play className="w-4 h-4 flex-shrink-0 text-neutral-700" />
                      <span className="text-sm font-light text-neutral-700 whitespace-nowrap">View Post</span>
                    </a>
                  ) : (
                    <span className="text-sm font-light text-muted-foreground">—</span>
                  )}
                </div>

                {/* Category */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.talentCategory}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {partnership.talentCategory || "—"}
                  </p>
                </div>

                {/* Hashtags */}
                <div
                  className="flex items-center flex-shrink-0 overflow-hidden min-w-0"
                  style={{ width: `${columnWidths.hashtags}px` }}
                >
                  {(partnership.hashtags ?? []).length > 0 ? (
                    <div className="truncate w-full">
                      <span className="inline-flex flex-nowrap items-baseline gap-x-3 min-w-0 whitespace-nowrap">
                        {(
                          partnership.hashtagDetails ??
                          (partnership.hashtags ?? []).map((tag) => ({
                            tag,
                            platforms: [] as string[],
                            postedAts: [] as string[],
                          }))
                        ).map((detail, index, details) => (
                          <PartnershipHashtagLabel
                            key={`${detail.tag}-${index}`}
                            tag={detail.tag}
                            companyId={partnership.companyId}
                            platforms={detail.platforms}
                            postedAts={detail.postedAts}
                            showComma={index < details.length - 1}
                          />
                        ))}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-light text-muted-foreground">—</span>
                  )}
                </div>

                {/* Created At */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.createdAt}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {partnership.createdAt ? formatDate(partnership.createdAt) : "—"}
                  </p>
                </div>

                {/* Last Post */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.postedAt}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {partnership.postedAt ? formatDate(partnership.postedAt) : "—"}
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

