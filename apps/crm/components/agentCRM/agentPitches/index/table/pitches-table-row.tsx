"use client";

import React from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { CardCRM as Card, CardContentCRM as CardContent } from "@/components/agentCRM/agentPeople/custom-ui/card-crm";
import { Pitch, ImageStates, ColumnWidths } from "../types";

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  walls: 'Walls',
  tiktok: 'TikTok',
  twitter: 'Twitter',
  other: 'Other',
};

interface PitchesTableRowProps {
  pitch: Pitch;
  index: number;
  imageStates: ImageStates;
  scrollableRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onImageError: (pitchId: string) => void;
  onPitchClick: (pitchId: string, e: React.MouseEvent) => void;
  formatDate: (dateString: string | null) => string;
  columnWidths: ColumnWidths;
}

export const PitchesTableRow = ({
  pitch,
  index,
  imageStates,
  scrollableRefs,
  onImageError,
  onPitchClick,
  formatDate,
  columnWidths,
}: PitchesTableRowProps) => {
  const creatorsLabel =
    pitch.creatorsCount === 1 && pitch.creatorProfileNames.length > 0
      ? pitch.creatorProfileNames[0]
      : pitch.creatorsCount === 1 && pitch.creatorNames.length > 0
      ? pitch.creatorNames[0]
      : pitch.creatorsCount > 0
      ? `${pitch.creatorsCount} creators`
      : '—';

  return (
    <div className="block relative w-full">
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.company}px` }}
      ></div>
      <Card className="w-full rounded-none bg-kenoo-white backdrop-blur-md border-b border-r border-l-0 border-t-0 border-neutral-300 transition-all duration-300 group relative overflow-visible box-border">
        <CardContent className="py-3 relative z-10">
          <div className="flex items-stretch">
            {/* Sticky Left Section - Company */}
            <div
              className="flex items-center gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 self-stretch overflow-visible bg-kenoo-white"
              style={{ width: `${columnWidths.company}px` }}
            >
              <div
                onClick={(e) => onPitchClick(pitch.id, e)}
                className="flex items-center gap-4 flex-1 cursor-pointer transition-all duration-200 -my-3 py-3 pl-6 relative bg-kenoo-white hover:bg-gray-200/60 max-w-full min-h-full"
              >
                <Image
                  src={
                    !imageStates[pitch.id]?.logoFailed && pitch.companyLogoUrl
                      ? pitch.companyLogoUrl
                      : FALLBACK_ICON_URL
                  }
                  alt={`${pitch.companyName || 'Company'} logo`}
                  width={40}
                  height={40}
                  className={
                    imageStates[pitch.id]?.logoFailed || !pitch.companyLogoUrl
                      ? "rounded-full object-cover aspect-square border border-neutral-200 w-[40px] h-[40px]"
                      : "rounded-full object-contain aspect-square w-[40px] h-[40px]"
                  }
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallbackUrl = FALLBACK_ICON_URL;
                    if (!imageStates[pitch.id]?.logoFailed && pitch.companyLogoUrl) {
                      onImageError(pitch.id);
                      if (target.src !== fallbackUrl) target.src = fallbackUrl;
                    } else if (target.src !== fallbackUrl) {
                      target.src = fallbackUrl;
                    }
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {pitch.companyName || pitch.companyWebsite || '—'}
                  </p>
                  {pitch.companyWebsite && pitch.companyName && (
                    <p className="text-xs text-muted-foreground font-light truncate">
                      {pitch.companyWebsite}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Right Section */}
            <div
              ref={(el) => {
                if (el) scrollableRefs.current[index] = el;
              }}
              className="flex-1 overflow-x-hidden pr-0 flex items-center"
            >
              <div className="flex items-center min-w-max pl-0" style={{ gap: '0.5rem' }}>
                {/* Pitched To */}
                <div className="flex items-center flex-shrink-0 pl-6 overflow-hidden" style={{ width: `${columnWidths.pitchedTo}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {pitch.pitchedTo || '—'}
                  </p>
                </div>

                {/* Sent By */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.sentBy}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {pitch.sentBy || '—'}
                  </p>
                </div>

                {/* Channel */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.channel}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {pitch.channel ? (CHANNEL_LABELS[pitch.channel] ?? pitch.channel) : '—'}
                  </p>
                </div>

                {/* Creators */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.creators}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {creatorsLabel}
                  </p>
                </div>

                {/* Date Pitched */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.date}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {pitch.timestamp ? formatDate(pitch.timestamp) : '—'}
                  </p>
                </div>

                {/* Created At */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.created}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {pitch.createdAt ? formatDate(pitch.createdAt) : '—'}
                  </p>
                </div>

                {/* Spacer */}
                <div style={{ width: '1.5rem' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
