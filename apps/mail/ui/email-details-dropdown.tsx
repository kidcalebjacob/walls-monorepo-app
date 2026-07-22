"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { FullEmail } from "@/types/email.types";
import { extractEmailAddresses } from "@/utils/format-utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { RecipientEnrichment, getEnrichmentStatus } from "./recipient-enrichment";
import { Lead } from "@/components/agentCRM/agentPeople/index/types";

const INTERNAL_EMAIL_DOMAINS = ["@wallsentertainment.com", "@walls.agency"];

/** Normalize "Name <email>" or plain email to lowercase canonical email for lookup */
function getCanonicalEmail(addr: string): string {
  const emails = extractEmailAddresses(addr);
  return (emails[0] || addr.trim()).toLowerCase();
}

/** True if the canonical (lowercase) email is from an internal domain; no enrichment icon shown. */
function isInternalEmail(canonicalEmail: string): boolean {
  return INTERNAL_EMAIL_DOMAINS.some((d) => canonicalEmail.endsWith(d));
}

/** Person row from people table (subset we need for enrichment display) */
interface PersonRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  last_enriched: string | null;
  company_id: string | null;
  company_website: string | null;
  apollo_person_id: string | null;
  linkedin_url: string | null;
  user_id: string | null;
}

function personToLead(row: PersonRow | null, displayEmail: string, canonicalEmail: string): Lead {
  if (!row) {
    return {
      id: "",
      firstName: "",
      lastName: "",
      leadName: displayEmail || canonicalEmail,
      email: canonicalEmail,
      phone: "",
      company: "",
      companyWebsite: "",
      source: "",
      status: "",
      region: "",
      operatingCountries: [],
      title: "",
      department: "",
      reportingTo: "",
      estimatedValue: 0,
      createdAt: null,
      createdBy: "",
      lastEnriched: null,
      apolloPersonId: null,
    };
  }
  const leadName = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || displayEmail;
  return {
    id: row.id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    leadName,
    email: row.email ?? canonicalEmail,
    phone: "",
    company: "",
    companyWebsite: row.company_website ?? "",
    companyId: row.company_id ?? undefined,
    source: "",
    status: "",
    region: "",
    operatingCountries: [],
    title: "",
    department: "",
    reportingTo: "",
    estimatedValue: 0,
    createdAt: null,
    createdBy: "",
    linkedin: row.linkedin_url ?? undefined,
    lastEnriched: row.last_enriched ?? null,
    apolloPersonId: row.apollo_person_id ?? null,
  };
}

interface EmailDetailsDropdownProps {
  message: FullEmail;
  userId?: string;
}

export function EmailDetailsDropdown({ message, userId }: EmailDetailsDropdownProps) {
  const [peopleByEmail, setPeopleByEmail] = useState<Map<string, PersonRow>>(new Map());

  const isUndisclosedAddress = (addr: string) =>
    addr.toLowerCase().includes("undisclosed-recipients");

  const emailsToFetch = useMemo(() => {
    const from = getCanonicalEmail(message.from);
    const toList = Array.isArray(message.to) ? message.to : [message.to];
    const ccList = message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : [];
    const bccList = message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]) : [];
    const all = [from, ...toList.map(getCanonicalEmail), ...ccList.map(getCanonicalEmail), ...bccList.map(getCanonicalEmail)].filter(Boolean);
    return Array.from(new Set(all));
  }, [message.from, message.to, message.cc, message.bcc]);

  useEffect(() => {
    if (emailsToFetch.length === 0) return;
    const supabase = getSupabaseClient();
    supabase
      .from("people")
      .select("id, first_name, last_name, email, last_enriched, company_id, company_website, apollo_person_id, linkedin_url, user_id")
      .in("email", emailsToFetch)
      .then(({ data, error }) => {
        if (error) {
          console.error("[email-details-dropdown] fetch people by email:", error);
          return;
        }
        const map = new Map<string, PersonRow>();
        (data ?? []).forEach((row: PersonRow) => {
          const key = (row.email ?? "").toLowerCase();
          if (key) map.set(key, row);
        });
        setPeopleByEmail(map);
      });
  }, [emailsToFetch.join(",")]);

  const fromCanonical = getCanonicalEmail(message.from);
  const toAddresses = (Array.isArray(message.to) ? message.to : [message.to]).filter(addr => addr && !isUndisclosedAddress(addr));
  const ccAddresses = message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : [];
  const bccAddresses = message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]) : [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-transparent shadow-none group">
          <span className="flex items-center justify-center p-1 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
            <ChevronDown className="h-4 w-4 text-neutral-500" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[400px] p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl">
        <div className="text-sm grid grid-cols-[2.2rem_1fr_auto] gap-x-0 items-center">
          {/* from */}
          <span className="text-xs font-light text-neutral-300">from:</span>
          <span className="min-w-0 truncate text-xs font-light text-neutral-500">{message.from}</span>
          <div className="flex items-center justify-end flex-shrink-0">
            <RecipientEnrichment
              status={isInternalEmail(fromCanonical) ? "fresh" : getEnrichmentStatus(peopleByEmail.get(fromCanonical)?.last_enriched ?? null)}
              website={peopleByEmail.get(fromCanonical)?.company_website ?? ""}
              userId={userId}
              person={personToLead(peopleByEmail.get(fromCanonical) ?? null, message.from, fromCanonical)}
              companyId={peopleByEmail.get(fromCanonical)?.company_id ?? undefined}
            />
          </div>
          {/* to: title aligned with first to recipient; show placeholder if all were undisclosed */}
          {toAddresses.length === 0 && ccAddresses.length === 0 && bccAddresses.length === 0 && (
            <React.Fragment>
              <span className="text-xs font-light text-neutral-300">to:</span>
              <span className="min-w-0 truncate text-xs font-light text-neutral-500 italic">undisclosed recipients</span>
              <div />
            </React.Fragment>
          )}
          {toAddresses.map((addr, i) => {
            const canonical = getCanonicalEmail(addr);
            const person = peopleByEmail.get(canonical) ?? null;
            return (
              <React.Fragment key={canonical}>
                <span className={i === 0 ? "text-xs font-light text-neutral-300" : ""}>{i === 0 ? "to:" : ""}</span>
                <span className="min-w-0 truncate text-xs font-light text-neutral-500">{addr}</span>
                <div className="flex items-center justify-end flex-shrink-0">
                  <RecipientEnrichment
                    status={isInternalEmail(canonical) ? "fresh" : getEnrichmentStatus(person?.last_enriched ?? null)}
                    website={person?.company_website ?? ""}
                    userId={userId}
                    person={personToLead(person, addr, canonical)}
                    companyId={person?.company_id ?? undefined}
                  />
                </div>
              </React.Fragment>
            );
          })}
          {/* cc: title aligned with first cc recipient */}
          {ccAddresses.map((addr, i) => {
            const canonical = getCanonicalEmail(addr);
            const person = peopleByEmail.get(canonical) ?? null;
            return (
              <React.Fragment key={canonical}>
                <span className={i === 0 ? "text-xs font-light text-neutral-300" : ""}>{i === 0 ? "cc:" : ""}</span>
                <span className="min-w-0 truncate text-xs font-light text-neutral-500">{addr}</span>
                <div className="flex items-center justify-end flex-shrink-0">
                  <RecipientEnrichment
                    status={isInternalEmail(canonical) ? "fresh" : getEnrichmentStatus(person?.last_enriched ?? null)}
                    website={person?.company_website ?? ""}
                    userId={userId}
                    person={personToLead(person, addr, canonical)}
                    companyId={person?.company_id ?? undefined}
                  />
                </div>
              </React.Fragment>
            );
          })}
          {/* bcc: title aligned with first bcc recipient */}
          {bccAddresses.map((addr, i) => {
            const canonical = getCanonicalEmail(addr);
            const person = peopleByEmail.get(canonical) ?? null;
            return (
              <React.Fragment key={`bcc-${canonical}`}>
                <span className={i === 0 ? "text-xs font-light text-neutral-300" : ""}>{i === 0 ? "bcc:" : ""}</span>
                <span className="min-w-0 truncate text-xs font-light text-neutral-500">{addr}</span>
                <div className="flex items-center justify-end flex-shrink-0">
                  <RecipientEnrichment
                    status={isInternalEmail(canonical) ? "fresh" : getEnrichmentStatus(person?.last_enriched ?? null)}
                    website={person?.company_website ?? ""}
                    userId={userId}
                    person={personToLead(person, addr, canonical)}
                    companyId={person?.company_id ?? undefined}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
