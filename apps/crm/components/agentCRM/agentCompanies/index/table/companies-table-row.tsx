"use client";

import React from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { Link2 } from "lucide-react";
import { CardCRM as Card, CardContentCRM as CardContent } from "@/components/agentCRM/agentPeople/custom-ui/card-crm";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/types/country.types";
import { Company, ImageStates } from "../types";
import { EnrichmentStatus, getEnrichmentStatus } from "../ui/enrichment-status";

type ColumnWidths = {
  name: number;
  industry: number;
  website: number;
  phone: number;
  employees: number;
  revenue: number;
  country: number;
  city: number;
  founded: number;
  created: number;
  enrichment: number;
};

interface CompaniesTableRowProps {
  company: Company;
  index: number;
  imageStates: ImageStates;
  scrollableRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onImageError: (companyId: string) => void;
  onCompanyClick: (companyId: string, e: React.MouseEvent) => void;
  formatDate: (dateString: string | null) => string;
  formatCurrency: (amount: number | null) => string;
  formatNumber: (count: number | null) => string;
  ensureHttps: (url: string) => string;
  columnWidths: ColumnWidths;
  userId?: string;
  onEnrichSuccess?: (companyId: string) => void;
}

export const CompaniesTableRow = ({
  company,
  index,
  imageStates,
  scrollableRefs,
  onImageError,
  onCompanyClick,
  formatDate,
  formatCurrency,
  formatNumber,
  ensureHttps,
  columnWidths,
  userId,
  onEnrichSuccess,
}: CompaniesTableRowProps) => {
  return (
    <div 
      key={company.id} 
      className="block relative w-full"
    >
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.name}px` }}
      ></div>
      <Card className="w-full rounded-none bg-kenoo-white backdrop-blur-md border-b border-r border-l-0 border-t-0 border-neutral-300 transition-all duration-300 group relative overflow-visible box-border">
        <CardContent className="py-3 relative z-10">
          <div className="flex items-stretch">
            {/* Sticky Left Section - Company Name */}
            <div
              className="flex items-stretch gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 self-stretch overflow-visible bg-kenoo-white"
              style={{ width: `${columnWidths.name}px` }}
            >
              <div
                onClick={(e) => onCompanyClick(company.id, e)}
                className="flex items-center gap-4 flex-1 cursor-pointer transition-all duration-200 -my-3 py-3 pl-6 relative bg-kenoo-white hover:bg-gray-200/60 max-w-full min-h-full"
              >
                <Image
                  src={
                    !imageStates[company.id]?.logoFailed && company.logoUrl
                      ? company.logoUrl
                      : FALLBACK_ICON_URL
                  }
                  alt={`${company.name} logo`}
                  width={40}
                  height={40}
                  className={
                    imageStates[company.id]?.logoFailed || !company.logoUrl
                      ? "rounded-full object-cover aspect-square border border-neutral-200 w-[40px] h-[40px]"
                      : "rounded-full object-contain aspect-square w-[40px] h-[40px]"
                  }
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallbackUrl = FALLBACK_ICON_URL;
                    if (!imageStates[company.id]?.logoFailed && company.logoUrl) {
                      onImageError(company.id);
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
                    {company.name}
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
                {/* Industry */}
                <div className="flex items-center flex-shrink-0 pl-6 overflow-hidden" style={{ width: `${columnWidths.industry}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {company.industry || '—'}
                  </p>
                </div>

                {/* Website */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.website}px` }}>
                  {company.website ? (
                    <a
                      href={ensureHttps(company.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(ensureHttps(company.website), '_blank');
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-[0.5px] border-solid border-neutral-300 bg-kenoo-white shadow-none transition-all duration-300 hover:border-neutral-200/80 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)] hover:scale-[0.98] cursor-pointer flex-shrink-0 max-w-full"
                    >
                      <Link2 className="w-4 h-4 flex-shrink-0 text-neutral-700 stroke-neutral-700" />
                      <span className="text-sm font-light text-neutral-700 whitespace-nowrap">Visit Site</span>
                    </a>
                  ) : (
                    <span className="text-sm font-light text-muted-foreground">—</span>
                  )}
                </div>

                {/* Phone */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.phone}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {company.phone || '—'}
                  </p>
                </div>

                {/* Employees */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.employees}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {formatNumber(company.employeeCount)}
                  </p>
                </div>

                {/* Revenue */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.revenue}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {formatCurrency(company.annualRevenue)}
                  </p>
                </div>

                {/* Country */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.country}px` }}>
                  {(() => {
                    const countryName = company.country || null;
                    const countryCode = countryName && countryName !== '—' ? getCountryCode(countryName) : null;
                    
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
                          {company.country || '—'}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {/* City */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.city}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {company.city || '—'}
                  </p>
                </div>

                {/* Founded */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.founded}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {company.foundingYear ? company.foundingYear.toString() : '—'}
                  </p>
                </div>

                {/* Created Date */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.created}px` }}>
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {company.createdAt ? formatDate(company.createdAt) : '—'}
                  </p>
                </div>

                {/* Enrichment */}
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: `${columnWidths.enrichment}px` }}>
                  <EnrichmentStatus
                    status={getEnrichmentStatus(company.lastEnriched)}
                    userId={userId}
                    company={company}
                    onEnrichSuccess={onEnrichSuccess}
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

