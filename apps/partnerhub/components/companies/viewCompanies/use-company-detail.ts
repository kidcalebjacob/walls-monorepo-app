"use client";

import { wallsToast } from "@/components/ui/walls-toast";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { fetchCompanySocialUrls } from "@/lib/company-social";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanyDbRow, CompanyDetail, FundingEvent, Suborganization, Technology } from "./types";
import { unwrapRelation } from "./utils";

interface CompanyDetailCacheEntry {
  company: CompanyDetail | null;
  categoryName: string | null;
  subcategoryName: string | null;
}

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
const inMemoryCompanyDetailCache = new Map<string, CompanyDetailCacheEntry>();

type SubcategoryQueryRow = {
  id: string;
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
  companies_subcategories_join: Array<{
    company_id: string;
    company: CompanyDbRow | CompanyDbRow[] | null;
  }> | null;
};

function toCompanyDetail(
  row: CompanyDbRow,
  extras: {
    linkedin: string;
    twitter: string;
    facebook: string;
    departmentalHeadCount: Record<string, number>;
    technologies: Technology[];
    suborganizations: Suborganization[];
    fundingEvents: FundingEvent[];
  }
): CompanyDetail {
  return {
    id: row.id,
    name: row.name || "",
    logoUrl: row.logo_url || null,
    website: row.website || null,
    domain: row.domain || null,
    industry: row.industry || null,
    employeeCount: row.employee_count ?? null,
    annualRevenuePrinted: row.annual_revenue_printed || null,
    totalFundingPrinted: row.total_funding_printed || null,
    overview: row.overview || null,
    foundingYear: row.founding_year ?? null,
    country: row.country || null,
    city: row.city || null,
    phone: row.phone || null,
    ...extras,
  };
}

export function useCompanyDetail({
  categorySlug,
  subcategorySlug,
  companyId,
}: {
  categorySlug: string;
  subcategorySlug: string;
  companyId: string;
}) {
  const { user } = useAuth();
  const cacheKey = `${categorySlug}/${subcategorySlug}/${companyId}`;
  const cached = inMemoryCompanyDetailCache.get(cacheKey);

  const [loading, setLoading] = useState(() => !cached);
  const [categoryName, setCategoryName] = useState<string | null>(() => cached?.categoryName ?? null);
  const [subcategoryName, setSubcategoryName] = useState<string | null>(() => cached?.subcategoryName ?? null);
  const [company, setCompany] = useState<CompanyDetail | null>(() => cached?.company ?? null);
  const fetchedKeyRef = useRef<string | null>(cached ? cacheKey : null);

  const fetchCompany = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const supabase = getSupabaseClient();

      const { data: subcategoryData, error: subcategoryError } = await supabase
        .from("companies_subcategories")
        .select(`
          id, name, slug,
          category:companies_categories!inner(id, name, slug),
          companies_subcategories_join(
            company_id,
            company:companies(*)
          )
        `)
        .eq("slug", subcategorySlug)
        .eq("category.slug", categorySlug)
        .single();

      if (subcategoryError || !subcategoryData) {
        setCompany(null);
        setCategoryName(null);
        setSubcategoryName(null);
        inMemoryCompanyDetailCache.set(cacheKey, { company: null, categoryName: null, subcategoryName: null });
        return;
      }

      const row = subcategoryData as SubcategoryQueryRow;
      const category = unwrapRelation(row.category);
      setCategoryName(category?.name ?? null);
      setSubcategoryName(row.name);

      const companyRow = (row.companies_subcategories_join ?? [])
        .map((join) => unwrapRelation(join.company))
        .find((c): c is CompanyDbRow => c?.id === companyId);

      if (!companyRow) {
        setCompany(null);
        inMemoryCompanyDetailCache.set(cacheKey, {
          company: null,
          categoryName: category?.name ?? null,
          subcategoryName: row.name,
        });
        return;
      }

      let linkedin = "";
      let twitter = "";
      let facebook = "";

      try {
        const socialUrls = await fetchCompanySocialUrls(supabase, companyId);
        linkedin = socialUrls.linkedin;
        twitter = socialUrls.twitter;
        facebook = socialUrls.facebook;
      } catch (socialError) {
        console.error("Error fetching social accounts:", socialError);
      }

      let departmentalHeadCount: Record<string, number> = {};
      try {
        const { data: headcountData } = await supabase
          .from("companies_headcount")
          .select("department, headcount")
          .eq("company_id", companyId);

        if (headcountData) {
          headcountData.forEach((item) => {
            departmentalHeadCount[item.department] = item.headcount;
          });
        }
      } catch (headcountError) {
        console.error("Error fetching headcount:", headcountError);
      }

      let technologies: Technology[] = [];
      try {
        const { data: technologiesData } = await supabase
          .from("companies_technologies_join")
          .select(`companies_technologies (name, category)`)
          .eq("company_id", companyId);

        if (technologiesData) {
          technologies = technologiesData
            .map((item) =>
              unwrapRelation(
                (item as { companies_technologies: Technology | Technology[] | null })
                  .companies_technologies
              )
            )
            .filter((tech): tech is Technology => tech != null && Boolean(tech.name));
        }
      } catch (technologiesError) {
        console.error("Error fetching technologies:", technologiesError);
      }

      let suborganizations: Suborganization[] = [];
      try {
        const { data: suborgs } = await supabase
          .from("companies_suborganizations")
          .select("id, name, website")
          .eq("company_id", companyId)
          .order("name", { ascending: true });

        if (suborgs) {
          suborganizations = suborgs.map((suborg) => ({
            id: suborg.id,
            name: suborg.name,
            website: suborg.website,
          }));
        }
      } catch (suborgError) {
        console.error("Error fetching suborganizations:", suborgError);
      }

      let fundingEvents: FundingEvent[] = [];
      try {
        const { data: fundingData } = await supabase
          .from("companies_funding_events")
          .select("id, type, amount, currency, date, investors, news_url")
          .eq("company_id", companyId)
          .order("date", { ascending: false });

        if (fundingData) {
          fundingEvents = fundingData.map((event) => ({
            id: event.id,
            type: event.type,
            amount: event.amount,
            currency: event.currency,
            date: event.date,
            investors: event.investors,
            newsUrl: event.news_url,
          }));
        }
      } catch (fundingError) {
        console.error("Error fetching funding events:", fundingError);
      }

      const detail = toCompanyDetail(companyRow, {
        linkedin,
        twitter,
        facebook,
        departmentalHeadCount,
        technologies,
        suborganizations,
        fundingEvents,
      });
      setCompany(detail);
      inMemoryCompanyDetailCache.set(cacheKey, {
        company: detail,
        categoryName: category?.name ?? null,
        subcategoryName: row.name,
      });
    } catch (err) {
      console.error("PartnerHub company detail error:", err);
      wallsToast.error("Error", "Failed to load company");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [user, categorySlug, subcategorySlug, companyId, cacheKey]);

  // Initial load only — skip if cached data was hydrated synchronously on mount,
  // and don't refetch when navigating back to a previously viewed company
  useEffect(() => {
    if (!user) return;
    if (fetchedKeyRef.current === cacheKey) return;

    const cachedEntry = inMemoryCompanyDetailCache.get(cacheKey);
    if (cachedEntry) {
      setCompany(cachedEntry.company);
      setCategoryName(cachedEntry.categoryName);
      setSubcategoryName(cachedEntry.subcategoryName);
      setLoading(false);
      fetchedKeyRef.current = cacheKey;
      return;
    }

    fetchedKeyRef.current = cacheKey;
    setLoading(true);
    fetchCompany();
  }, [user, cacheKey, fetchCompany]);

  return { loading, company, categoryName, subcategoryName };
}
