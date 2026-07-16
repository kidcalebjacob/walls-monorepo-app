"use client";

import { useState, useRef, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lead } from "../types";
import { wallsToast } from "@/components/ui/walls-toast";

// Function to determine enrichment status
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
  website: string;
  userId?: string;
  person: Lead;
  companyId?: string;
  apolloAccountId?: string;
}

export const EnrichmentStatus = ({ 
  status, 
  website, 
  userId, 
  person, 
  companyId, 
  apolloAccountId 
}: EnrichmentStatusProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const loadingTimer = useRef<NodeJS.Timeout>();

  const showFailureToast = (personName?: string, message?: string) => {
    wallsToast.error("Enrichment failed", message ?? personName);
  };

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
      // Use smart enrichment for people
      let enrichPayload: any = {
        userId: userId,
        companyId: companyId,
        apolloAccountId: apolloAccountId
      };

      // Use apollo_person_id if available, otherwise use email
      if (person.apolloPersonId) {
        enrichPayload.id = person.apolloPersonId;
      } else if (person.email) {
        enrichPayload.email = person.email;
      } else {
        wallsToast.error("Enrichment failed", person.leadName);
        setIsLoading(false);
        return;
      }
      
      enrichPayload.firstName = person.firstName;
      enrichPayload.lastName = person.lastName;
      if (person.linkedin) {
        enrichPayload.linkedin = person.linkedin;
      }

      const response = await fetch('/api/apollo/custom/people-smart-enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrichPayload)
      });

      const result = await response.json();
      if (!response.ok) {
        const error: any = new Error(result.error || 'Failed to enrich person');
        error.code = result.code;
        throw error;
      }

      setIsLoading(false);
      setIsSuccess(true);
      
      wallsToast.success("Person enriched", person.leadName);

    } catch (error) {
      console.error('Error enriching:', error);
      setIsLoading(false);

      if ((error as any)?.code === 'APOLLO_PERSON_NOT_USABLE') {
        showFailureToast(
          person.leadName,
          "Person does not exist on Apollo."
        );
      } else if (error instanceof Error &&
          (error.message === 'No organization data found' ||
           error.message.includes('404'))) {
        showFailureToast(person.leadName, "Person does not exist on Apollo.");
      } else {
        showFailureToast(person.leadName);
      }
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={handleEnrich}
            className={`flex flex-col items-center gap-[2px] w-6 p-4 rounded-full hover:bg-gray-500/30 transition-all duration-200 cursor-pointer group ${isLoading ? 'animate-pulse' : ''}`}
          >
            {status === 'none' ? (
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
                    status === 'fresh' ? 'bg-kenoo-sky/60' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-4 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-400 delay-100' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' :
                    status === 'moderate' ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-3 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-300 delay-200' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' :
                    status === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
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
          {isLoading ? 'Enriching...' : isSuccess ? 'Enriched!' : status === 'none' ? 'Add to database' : 'Enrich'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

