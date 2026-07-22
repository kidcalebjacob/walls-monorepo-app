"use client";

import { useState, useRef, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lead } from "@/components/agentCRM/agentPeople/index/types";
import { wallsToast } from "@/components/ui/walls-toast";

/** Same as agentPeople: fresh/moderate/stale from last_enriched, or none */
export function getEnrichmentStatus(lastEnriched?: string | null): "fresh" | "moderate" | "stale" | "none" {
  if (!lastEnriched) return "none";
  const enrichedDate = new Date(lastEnriched);
  if (isNaN(enrichedDate.getTime())) return "none";
  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - enrichedDate.getFullYear()) * 12 +
    now.getMonth() -
    enrichedDate.getMonth();
  if (monthsDiff <= 4) return "fresh";
  if (monthsDiff <= 12) return "moderate";
  return "stale";
}

const SYNC_ENDPOINT = "/api/apollo/custom/apollo-person-id-supabase-sync";

interface RecipientEnrichmentProps {
  status: "fresh" | "moderate" | "stale" | "none";
  website: string;
  userId?: string;
  person: Lead;
  companyId?: string;
  apolloAccountId?: string;
}

/** Enrichment icon for email recipients. Uses apollo-person-id-supabase-sync (same as create-person) so it can receive email or personId. */
export function RecipientEnrichment({
  status,
  person,
}: RecipientEnrichmentProps) {
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

    const email = person.email?.trim();
    const personId = person.apolloPersonId?.trim();

    if (!personId && !email) {
      wallsToast.error("Enrichment failed", person.leadName);
      return;
    }

    setIsLoading(true);
    try {
      const body = personId
        ? JSON.stringify({ personId })
        : JSON.stringify({ email });
      const response = await fetch(SYNC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const responseText = await response.text();
      let data: { success?: boolean; error?: string; details?: string; personName?: string; message?: string };
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        console.error("[RecipientEnrichment] Response was not JSON", {
          status: response.status,
          bodyPreview: responseText.slice(0, 200),
        });
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to sync from Apollo");
      }

      setIsLoading(false);
      setIsSuccess(true);
      const personName = data.personName ?? person.leadName;
      wallsToast.success("Person enriched", personName);
    } catch (error) {
      console.error("[RecipientEnrichment] Error:", error);
      setIsLoading(false);
      wallsToast.error("Enrichment failed", person.leadName);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={handleEnrich}
            className={`flex flex-col items-center justify-center gap-[2px] w-5 h-7 rounded-full hover:bg-gray-500/30 transition-all duration-200 cursor-pointer group ${isLoading ? "animate-pulse" : ""}`}
          >
            {status === "none" && !isSuccess ? (
              <>
                <div className="w-5 h-[2.5px] rounded-sm bg-gray-300 opacity-30 glow-bar-1" />
                <div className="w-4 h-[2.5px] rounded-sm bg-gray-300 opacity-30 glow-bar-2" />
                <div className="w-3 h-[2.5px] rounded-sm bg-gray-300 opacity-30 glow-bar-3" />
              </>
            ) : (
              <>
                <div
                  className={`w-5 h-[2.5px] rounded-sm transition-all duration-300 ${
                    isSuccess
                      ? "bg-kenoo-sky/60"
                      : isLoading
                        ? "bg-blue-500"
                        : status === "fresh"
                          ? "bg-kenoo-sky/60"
                          : "bg-gray-300"
                  }`}
                />
                <div
                  className={`w-4 h-[2.5px] rounded-sm transition-all duration-300 ${
                    isSuccess
                      ? "bg-kenoo-sky/60"
                      : isLoading
                        ? "bg-blue-400 delay-100"
                        : status === "fresh"
                          ? "bg-kenoo-sky/60"
                          : status === "moderate"
                            ? "bg-yellow-500"
                            : "bg-gray-300"
                  }`}
                />
                <div
                  className={`w-3 h-[2.5px] rounded-sm transition-all duration-300 ${
                    isSuccess
                      ? "bg-kenoo-sky/60"
                      : isLoading
                        ? "bg-blue-300 delay-200"
                        : status === "fresh"
                          ? "bg-kenoo-sky/60"
                          : status === "moderate"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                  }`}
                />
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="font-light" side="top" sideOffset={5}>
          {isLoading
            ? "Enriching..."
            : isSuccess
              ? "Enriched!"
              : status === "none"
                ? "Add to database"
                : "Enrich"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
