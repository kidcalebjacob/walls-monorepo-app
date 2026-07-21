"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { AVATAR_FALLBACK_URL } from "@/lib/asset-urls";
import { Mail, SendHorizontal } from "lucide-react";
import { MdVerified } from "react-icons/md";
import { FaLinkedin } from "react-icons/fa";
import { CardCRM as Card, CardContentCRM as CardContent } from "@/components/agentCRM/agentPeople/custom-ui/card-crm";
import { DynamicTooltip } from "../ui/dynamic-tooltip";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/types/country.types";
import { Lead, ImageStates } from "../types";
import { EnrichmentStatus, getEnrichmentStatus } from "../ui/enrichment-status";
import { PeopleCompanyCell } from "./people-company-cell";

type ColumnWidths = {
  name: number;
  company: number;
  actions: number;
  location: number;
  title: number;
  phone: number;
  department: number;
  source: number;
  status: number;
  created: number;
  lastContacted: number;
  enrichment: number;
};

interface PeopleTableRowProps {
  lead: Lead;
  index: number;
  imageStates: ImageStates;
  scrollableRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onImageError: (leadId: string, type: 'profile' | 'company') => void;
  onPersonClick: (personId: string, e: React.MouseEvent) => void;
  onCompanyClick: (companyId: string, e: React.MouseEvent) => void;
  onCompanyUpdate: (leadId: string, company: { id: string; name: string; logo_url?: string | null }) => void;
  onEmailClick: (email: string, personId: string, e: React.MouseEvent) => void;
  onAddToSequence: (personId: string, e: React.MouseEvent) => void;
  formatDate: (dateString: string | null) => string;
  userId?: string;
  columnWidths: ColumnWidths;
}

const APOLLO_LINKEDIN_DEFAULT_PHOTO_FRAGMENT =
  "static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2";

function isApolloLinkedInDefaultPhoto(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  return Boolean(trimmed && trimmed.includes(APOLLO_LINKEDIN_DEFAULT_PHOTO_FRAGMENT));
}

function personDisplayName(lead: Lead): string {
  const fromParts = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  return lead.leadName?.trim() || fromParts || lead.email?.trim() || "Unknown";
}

function resolvePersonPhotoUrl(lead: Lead): string | null {
  for (const url of [lead.photo, lead.photoURL]) {
    const trimmed = url?.trim();
    if (trimmed && !isApolloLinkedInDefaultPhoto(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function PersonRowAvatar({
  lead,
  profileFailed,
  onProfileError,
}: {
  lead: Lead;
  profileFailed?: boolean;
  onProfileError: () => void;
}) {
  const photoUrl = resolvePersonPhotoUrl(lead);
  const useFallback = profileFailed || !photoUrl;

  return (
    <Image
      src={!useFallback ? photoUrl! : AVATAR_FALLBACK_URL}
      alt={`${personDisplayName(lead)} profile`}
      width={40}
      height={40}
      className={
        useFallback
          ? "rounded-full object-cover aspect-square border border-neutral-200 w-[40px] h-[40px]"
          : "rounded-full object-cover aspect-square w-[40px] h-[40px]"
      }
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        const fallbackUrl = AVATAR_FALLBACK_URL;
        if (!profileFailed && photoUrl) {
          onProfileError();
          if (target.src !== fallbackUrl) {
            target.src = fallbackUrl;
          }
        } else if (target.src !== fallbackUrl) {
          target.src = fallbackUrl;
        }
      }}
    />
  );
}

export const PeopleTableRow = ({
  lead,
  index,
  imageStates,
  scrollableRefs,
  onImageError,
  onPersonClick,
  onCompanyClick,
  onCompanyUpdate,
  onEmailClick,
  onAddToSequence,
  formatDate,
  userId,
  columnWidths,
}: PeopleTableRowProps) => {
  const [companySelectOpen, setCompanySelectOpen] = useState(false);
  const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);

  return (
    <div 
      key={lead.id} 
      className="block relative w-full"
    >
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.name}px` }}
      ></div>
      <Card className="w-full rounded-none bg-kenoo-white backdrop-blur-md border-b border-r border-l-0 border-t-0 border-neutral-300 transition-all duration-300 group relative overflow-visible box-border">
        <CardContent className="py-3 relative z-10">
          <div className="flex items-stretch">
            {/* Sticky Left Section - Name & Company */}
            <div
              className="flex items-stretch gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 self-stretch overflow-visible bg-kenoo-white"
              style={{ width: `${columnWidths.name}px` }}
            >
              <div
                onClick={(e) => onPersonClick(lead.id, e)}
                className="flex items-center gap-4 flex-1 cursor-pointer transition-all duration-200 -my-3 py-3 pl-6 relative bg-kenoo-white hover:bg-gray-200/60 max-w-full min-h-full"
              >
                <PersonRowAvatar
                  lead={lead}
                  profileFailed={imageStates[lead.id]?.profileFailed}
                  onProfileError={() => onImageError(lead.id, "profile")}
                />
                <div className="min-w-0 flex items-center gap-1.5">
                  <p className="text-sm font-light text-foreground truncate min-w-0 flex-1">
                    {lead.leadName}
                  </p>
                  {lead.isVerified && (
                    <DynamicTooltip content="Verified">
                      <MdVerified className="h-4 w-4 text-kenoo-sky flex-shrink-0" />
                    </DynamicTooltip>
                  )}
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
                  <PeopleCompanyCell
                    lead={lead}
                    imageStates={imageStates}
                    companySelectOpen={companySelectOpen}
                    isUpdating={isUpdatingCompany}
                    onCompanySelectOpenChange={setCompanySelectOpen}
                    onCompanyClick={onCompanyClick}
                    onCompanyUpdate={(company) => {
                      setCompanySelectOpen(false);
                      setIsUpdatingCompany(true);
                      onCompanyUpdate(lead.id, company);
                      setIsUpdatingCompany(false);
                    }}
                    onImageError={onImageError}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.actions}px` }}>
                  {lead.email || lead.linkedin ? (
                    <div className="flex items-center gap-2">
                      {lead.email && (
                        <DynamicTooltip content="Send email">
                          <button
                            onClick={(e) => onEmailClick(lead.email, lead.id, e)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border-[0.5px] border-solid border-neutral-300 bg-kenoo-white shadow-none transition-all duration-300 hover:border-neutral-200/80 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)] hover:scale-[0.98] cursor-pointer"
                          >
                            <Mail className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                          </button>
                        </DynamicTooltip>
                      )}
                      {lead.email && (
                        <DynamicTooltip content="Add to Sequence">
                          <button
                            onClick={(e) => onAddToSequence(lead.id, e)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border-[0.5px] border-solid border-neutral-300 bg-kenoo-white shadow-none transition-all duration-300 hover:border-neutral-200/80 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)] hover:scale-[0.98] cursor-pointer"
                          >
                            <SendHorizontal className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                          </button>
                        </DynamicTooltip>
                      )}
                      {lead.linkedin && (
                        <DynamicTooltip content="View LinkedIn">
                          <a
                            href={lead.linkedin.startsWith("http") ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border-[0.5px] border-solid border-neutral-300 bg-kenoo-white shadow-none transition-all duration-300 hover:border-neutral-200/80 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)] hover:scale-[0.98] cursor-pointer"
                          >
                            <FaLinkedin className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                          </a>
                        </DynamicTooltip>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm font-light text-muted-foreground">—</span>
                  )}
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.location}px` }}>
                  {(() => {
                    const countryName = lead.operatingCountries && lead.operatingCountries.length > 0
                      ? lead.operatingCountries[0]
                      : lead.region || null;
                    const countryCode = countryName ? getCountryCode(countryName) : null;
                    
                    return (
                      <>
                        {countryCode && countryCode !== 'UN' && (
                          <div className="relative w-4 h-4 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center">
                            <ReactCountryFlag
                              countryCode={countryCode}
                              svg
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              title={`${countryName} flag`}
                            />
                          </div>
                        )}
                        <p className="text-sm font-light text-foreground truncate">
                          {lead.operatingCountries && lead.operatingCountries.length > 0
                            ? `${lead.operatingCountries[0]}${lead.operatingCountries.length > 1 ? ' +' : ''}`
                            : lead.region || '—'}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* Title */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.title}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {lead.title || '—'}
                  </p>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.phone}px` }}>
                  <span className="text-sm text-muted-foreground font-light truncate w-full">
                    {lead.phone || '—'}
                  </span>
                </div>

                {/* Department */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.department}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {lead.department || '—'}
                  </p>
                </div>

                {/* Source */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.source}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {lead.source || '—'}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.status}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {lead.status || '—'}
                  </p>
                </div>

                {/* Created Date */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.created}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {lead.createdAt ? formatDate(lead.createdAt) : '—'}
                  </p>
                </div>

                {/* Last Contacted */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.lastContacted}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {lead.lastContacted ? formatDate(lead.lastContacted) : '—'}
                  </p>
                </div>

                {/* Enrichment */}
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: `${columnWidths.enrichment}px` }}>
                  <EnrichmentStatus
                    status={getEnrichmentStatus(lead.lastEnriched)}
                    website={lead.companyWebsite || ''}
                    userId={userId}
                    person={lead}
                    companyId={lead.companyId}
                    apolloAccountId={lead.apolloAccountId}
                  />
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

