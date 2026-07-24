"use client";

import { wallsToast } from "@/components/ui/walls-toast";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  cardSurfaceClass,
  CompaniesPageShell,
  CompaniesSearchBar,
  companyDetailPath,
  CompanyCardItem,
  CompanyItem,
  mapCompanyRow,
} from "./shared";
import { unwrapRelation } from "./viewCompanies/utils";

interface SubcategoryCacheEntry {
  subcategoryName: string | null;
  categoryName: string | null;
  companies: CompanyItem[];
}

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
const inMemorySubcategoryCache = new Map<string, SubcategoryCacheEntry>();

export default function PartnerHubCompaniesSubcategory({
  categorySlug,
  subcategorySlug,
}: {
  categorySlug: string;
  subcategorySlug: string;
}) {
  const { user } = useAuth();
  const cacheKey = `${categorySlug}/${subcategorySlug}`;
  const cached = inMemorySubcategoryCache.get(cacheKey);

  const [loading, setLoading] = useState(() => !cached);
  const [subcategoryName, setSubcategoryName] = useState<string | null>(() => cached?.subcategoryName ?? null);
  const [categoryName, setCategoryName] = useState<string | null>(() => cached?.categoryName ?? null);
  const [companies, setCompanies] = useState<CompanyItem[]>(() => cached?.companies ?? []);
  const [searchTerm, setSearchTerm] = useState("");
  const fetchedKeyRef = useRef<string | null>(cached ? cacheKey : null);

  const fetchSubcategory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("companies_subcategories")
        .select(`
          id, name, slug,
          category:companies_categories!inner(id, name, slug),
          companies_subcategories_join(
            company:companies(
              id, name, logo_url, website, industry,
              employee_count, annual_revenue_printed, total_funding_printed, overview
            )
          )
        `)
        .eq("slug", subcategorySlug)
        .eq("category.slug", categorySlug)
        .single();

      if (error) throw error;
      if (!data) {
        setSubcategoryName(null);
        setCategoryName(null);
        setCompanies([]);
        inMemorySubcategoryCache.set(cacheKey, { subcategoryName: null, categoryName: null, companies: [] });
        return;
      }

      const nextSubcategoryName = data.name;
      const nextCategoryName = unwrapRelation(data.category)?.name ?? null;

      const list: CompanyItem[] = (data.companies_subcategories_join || [])
        .map((row) => unwrapRelation(row.company))
        .filter((company): company is Parameters<typeof mapCompanyRow>[0] => Boolean(company?.id))
        .map(mapCompanyRow)
        .sort((a: CompanyItem, b: CompanyItem) => a.name.localeCompare(b.name));

      setSubcategoryName(nextSubcategoryName);
      setCategoryName(nextCategoryName);
      setCompanies(list);
      inMemorySubcategoryCache.set(cacheKey, {
        subcategoryName: nextSubcategoryName,
        categoryName: nextCategoryName,
        companies: list,
      });
    } catch (err) {
      console.error("PartnerHub subcategory error:", err);
      wallsToast.error("Error", "Failed to load subcategory");
      setSubcategoryName(null);
      setCategoryName(null);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [user, categorySlug, subcategorySlug, cacheKey]);

  // Initial load only — skip if cached data was hydrated synchronously on mount,
  // and don't refetch when navigating back to a previously viewed subcategory
  useEffect(() => {
    if (!user) return;
    if (fetchedKeyRef.current === cacheKey) return;

    const cachedEntry = inMemorySubcategoryCache.get(cacheKey);
    if (cachedEntry) {
      setSubcategoryName(cachedEntry.subcategoryName);
      setCategoryName(cachedEntry.categoryName);
      setCompanies(cachedEntry.companies);
      setLoading(false);
      fetchedKeyRef.current = cacheKey;
      return;
    }

    fetchedKeyRef.current = cacheKey;
    setLoading(true);
    fetchSubcategory();
  }, [user, cacheKey, fetchSubcategory]);

  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) return companies;
    const term = searchTerm.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(term));
  }, [companies, searchTerm]);

  return (
    <CompaniesPageShell>
      <div className="pt-6 pb-6">
        <Link
          href={`/companies/${categorySlug}`}
          className="flex items-center gap-1.5 text-xs font-light text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-3 w-3" />
          {categoryName || "Category"}
        </Link>
      </div>

      <div className="mb-12 pr-2">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
            {subcategoryName
              ? `${subcategoryName} · ${filteredCompanies.length.toLocaleString()} brand${filteredCompanies.length !== 1 ? "s" : ""}`
              : "Companies"}
          </p>
        </div>

        <div className="mb-8">
          <CompaniesSearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={cn(cardSurfaceClass, "h-56 animate-pulse bg-neutral-100/80")} />
            ))}
          </div>
        ) : !subcategoryName ? (
          <p className="text-sm text-neutral-400 font-light">Subcategory not found.</p>
        ) : filteredCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Building2 className="h-7 w-7 text-neutral-200" />
            <p className="text-xs font-light text-neutral-400 uppercase tracking-wider">
              {searchTerm ? "No matches" : "No brands found"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCompanies.map((company) => (
              <CompanyCardItem
                key={company.id}
                company={company}
                href={companyDetailPath(categorySlug, subcategorySlug, company.id)}
              />
            ))}
          </div>
        )}
      </div>
    </CompaniesPageShell>
  );
}
