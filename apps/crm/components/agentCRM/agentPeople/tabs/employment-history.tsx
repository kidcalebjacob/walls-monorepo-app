"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Info, Plus, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FaGlobe } from "react-icons/fa";
import { CompanySearch } from "@/components/ui/searches/companySearch/company-search";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface EmploymentHistoryProps {
  personId: string;
}

interface CurrentEmployer {
  id: string;
  name: string | null;
  logo_url: string | null;
  website: string | null;
}

interface EmploymentHistoryItem {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  current: boolean | null;
  organization_name: string | null;
  organization_id: string | null;
  created_at: string;
}

export default function EmploymentHistory({ personId }: EmploymentHistoryProps) {
  const [currentEmployer, setCurrentEmployer] = useState<CurrentEmployer | null>(null);
  const [employmentHistory, setEmploymentHistory] = useState<EmploymentHistoryItem[]>([]);
  const [showEmploymentHistory, setShowEmploymentHistory] = useState(false);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [companySearchValue, setCompanySearchValue] = useState("");
  const [isLinkingCompany, setIsLinkingCompany] = useState(false);

  const fetchCurrentEmployer = useCallback(async () => {
    if (!personId) return;
    try {
      const { data: person, error: personError } = await supabase
        .from('people')
        .select('company_id')
        .eq('id', personId)
        .single();

      if (personError || !person?.company_id) {
        setCurrentEmployer(null);
        return;
      }

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, logo_url, website')
        .eq('id', person.company_id)
        .single();

      if (companyError || !company) {
        setCurrentEmployer(null);
        return;
      }

      setCurrentEmployer({
        id: company.id,
        name: company.name ?? null,
        logo_url: company.logo_url ?? null,
        website: company.website ?? null,
      });
    } catch {
      setCurrentEmployer(null);
    }
  }, [personId]);

  useEffect(() => {
    fetchCurrentEmployer();
  }, [fetchCurrentEmployer]);

  const handleSelectCompany = useCallback(async (company: { id: string; name: string; logo_url?: string | null }) => {
    if (!personId) return;
    try {
      setIsLinkingCompany(true);
      const { error } = await supabase
        .from('people')
        .update({
          company_id: company.id,
          company_name: company.name,
        })
        .eq('id', personId);

      if (error) {
        console.error("Error linking company to person:", error);
        return;
      }

      await fetchCurrentEmployer();
      setShowCompanySearch(false);
    } catch (err) {
      console.error("Error linking company to person:", err);
    } finally {
      setIsLinkingCompany(false);
    }
  }, [personId, fetchCurrentEmployer]);

  useEffect(() => {
    const fetchEmploymentHistory = async () => {
      if (!personId) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('people_employment_history')
          .select('*')
          .eq('person_id', personId)
          .order('start_date', { ascending: false, nullsFirst: false });

        if (error) {
          console.error("Error fetching employment history:", error);
          setEmploymentHistory([]);
        } else {
          setEmploymentHistory(data || []);
        }
      } catch (error) {
        console.error("Error fetching employment history:", error);
        setEmploymentHistory([]);
      }
    };

    fetchEmploymentHistory();
  }, [personId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatDateRange = (startDate: string | null, endDate: string | null, current: boolean | null) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    
    if (start && end) {
      return `${start} - ${end}`;
    } else if (start) {
      return start;
    } else if (end) {
      return end;
    }
    return "—";
  };

  const totalPositions = employmentHistory.length;

  return (
    <div className="space-y-6">
      {/* Current Employer */}
      <div className="bg-gray-50 rounded-[30px] p-6">
        <div className="flex items-center">
          <div className="flex items-center flex-1 min-w-0">
            <h2 className="text-black font-black text-4xl">CURRENT</h2>
            <div className="flex-1 border-t border-black h-[1px] mx-4" />
          </div>
          {currentEmployer ? (
            <div className="flex items-center gap-3 min-w-0">
              {currentEmployer.logo_url && (
                <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200">
                  <img
                    src={currentEmployer.logo_url}
                    alt={currentEmployer.name ?? "Company logo"}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div className="min-w-0 flex flex-col items-start">
                <p className="text-sm font-semibold text-black truncate max-w-[180px]">
                  {currentEmployer.name ?? "—"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {currentEmployer.website && (
                    <a
                      href={currentEmployer.website.startsWith("http") ? currentEmployer.website : `https://${currentEmployer.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Visit company website"
                      className="text-black hover:opacity-80 transition-opacity relative group flex-shrink-0"
                    >
                      <div className="absolute inset-0 -m-1 rounded-[20px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                      <FaGlobe className="relative z-10 w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCompanySearchValue(currentEmployer.name ?? "");
                      setShowCompanySearch(true);
                    }}
                    aria-label="Change company"
                    className="text-black hover:opacity-80 transition-opacity relative group flex-shrink-0"
                  >
                    <div className="absolute inset-0 -m-1 rounded-[20px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <Pencil className="relative z-10 w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCompanySearch((prev) => !prev)}
              disabled={isLinkingCompany}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-200 border border-neutral-300/50 hover:bg-kenoo-yellow hover:border-transparent transition-colors cursor-pointer text-xs font-light text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{showCompanySearch ? "Hide company search" : "Search company"}</span>
            </button>
          )}
        </div>
        {showCompanySearch && (
          <div className="mt-4">
            <CompanySearch
              value={companySearchValue}
              onChange={setCompanySearchValue}
              onSelectCompany={handleSelectCompany}
              autoOpen
            />
          </div>
        )}
      </div>

      {/* Employment History */}
      <div className="bg-gray-50 rounded-[30px] p-6">
      <div className="flex items-center">
        <h2 className="text-black font-black text-4xl">EMPLOYMENT HISTORY</h2>
        <div className="flex-1 border-t border-black h-[1px] mx-4" />
        <div className="flex items-center gap-3">
          <p className="text-black font-black text-4xl">{totalPositions}</p>
          {employmentHistory.length > 0 && (
            <button
              onClick={() => setShowEmploymentHistory(!showEmploymentHistory)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap self-end"
            >
              <span className="text-xs font-light text-foreground">See more</span>
              {showEmploymentHistory ? (
                <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
              ) : (
                <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
              )}
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {showEmploymentHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {employmentHistory.length === 0 ? (
              <div className="text-center py-8 pt-6">
                <p className="text-sm font-light text-muted-foreground">No employment history found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 pt-6">
                {employmentHistory.map((item, index) => (
                  <div key={item.id || index} className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">
                      {item.title || "—"}
                    </h3>
                    <div className="flex-1 border-t border-black h-[1px]" />
                    <div className="flex-shrink-0 flex items-center gap-3">
                      {item.organization_name && (
                        <div className="flex items-center gap-1">
                          <p className="text-sm text-muted-foreground">
                            {item.organization_name}
                          </p>
                          <TooltipProvider delayDuration={500}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  {formatDate(item.start_date) && (
                                    <p className="text-xs">Start: {formatDate(item.start_date)}</p>
                                  )}
                                  {formatDate(item.end_date) && (
                                    <p className="text-xs">End: {formatDate(item.end_date)}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
