"use client";

import { useState, useRef, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Company } from "../types";
import { wallsToast } from "@/components/ui/walls-toast";
import { parseNonApolloDomain } from "../../lib/apollo-company-sync";

export const getEnrichmentStatus = (lastEnriched?: string | null): 'fresh' | 'moderate' | 'stale' | 'none' => {
  if (!lastEnriched) return 'none';

  const enrichedDate = new Date(lastEnriched);
  if (isNaN(enrichedDate.getTime())) return 'none';

  const now = new Date();
  const monthsDiff = (now.getFullYear() - enrichedDate.getFullYear()) * 12 + now.getMonth() - enrichedDate.getMonth();

  if (monthsDiff <= 4) return 'fresh';
  if (monthsDiff <= 12) return 'moderate';
  return 'stale';
};

interface EnrichmentStatusProps {
  status: 'fresh' | 'moderate' | 'stale' | 'none';
  userId?: string;
  company: Company;
  onEnrichSuccess?: (companyId: string) => void;
}

export const EnrichmentStatus = ({
  status,
  userId,
  company,
  onEnrichSuccess,
}: EnrichmentStatusProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const loadingTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    };
  }, []);

  const handleEnrich = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    setIsLoading(true);
    try {
      const domain = company.domain?.trim() || parseNonApolloDomain(company.website || '');
      if (!domain) {
        wallsToast.error("Enrichment failed", company.name);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/apollo/custom/apollo-domain-supabase-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          companyId: company.id,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to enrich company');
      }

      setIsLoading(false);
      setIsSuccess(true);
      wallsToast.success("Company enriched", company.name);
      onEnrichSuccess?.(company.id);
    } catch (error) {
      console.error('Error enriching:', error);
      setIsLoading(false);

      if (error instanceof Error &&
          (error.message === 'No organization data found' ||
           error.message.includes('404'))) {
        wallsToast.error("Enrichment failed", "No public data available");
      } else {
        wallsToast.error("Enrichment failed", company.name);
      }
    }
  };

  const effectiveStatus = isSuccess ? 'fresh' : status;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={handleEnrich}
            className={`flex flex-col items-center gap-[2px] w-6 p-4 rounded-full hover:bg-gray-500/30 transition-all duration-200 cursor-pointer group ${isLoading ? 'animate-pulse' : ''}`}
          >
            {effectiveStatus === 'none' ? (
              <>
                <div className="w-5 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-1" />
                <div className="w-4 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-2" />
                <div className="w-3 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-3" />
              </>
            ) : (
              <>
                <div
                  className={`w-5 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-500' :
                    effectiveStatus === 'fresh' ? 'bg-kenoo-sky/60' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-4 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-400 delay-100' :
                    effectiveStatus === 'fresh' ? 'bg-kenoo-sky/60' :
                    effectiveStatus === 'moderate' ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-3 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-300 delay-200' :
                    effectiveStatus === 'fresh' ? 'bg-kenoo-sky/60' :
                    effectiveStatus === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          className="font-light"
          side="top"
          sideOffset={5}
        >
          {isLoading ? 'Enriching...' : isSuccess ? 'Enriched!' : 'Enrich'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
