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
  CategoryTile,
  CompaniesPageShell,
  CompaniesSearchBar,
  companyDetailPath,
  CompanyCardItem,
  CompanyCategory,
  CompanyItem,
  CompanySubcategory,
  LogoPreview,
  mapCompanyRow,
  mapJoinToPreview,
  pickPreviewLogos,
} from "./shared";
import { unwrapRelation } from "./viewCompanies/utils";

type CompanyWithRoute = CompanyItem & { subcategorySlug: string };

interface CategoryCacheEntry {
  category: CompanyCategory | null;
  companies: CompanyWithRoute[];
}

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
const inMemoryCategoryCache = new Map<string, CategoryCacheEntry>();

export default function PartnerHubCompaniesCategory({
  categorySlug,
}: {
  categorySlug: string;
}) {
  const { user } = useAuth();
  const cached = inMemoryCategoryCache.get(categorySlug);

  const [loading, setLoading] = useState(() => !cached);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [category, setCategory] = useState<CompanyCategory | null>(() => cached?.category ?? null);
  const [companies, setCompanies] = useState<CompanyWithRoute[]>(() => cached?.companies ?? []);
  const [searchTerm, setSearchTerm] = useState("");
  const fetchedKeyRef = useRef<string | null>(cached ? categorySlug : null);

  const fetchCategory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("companies_categories")
        .select(`
          id, name, slug, description,
          companies_subcategories(
            id, name, slug, description,
            companies_subcategories_join(
              company_id,
              company:companies(id, name, logo_url, website)
            )
          )
        `)
        .eq("is_active", true)
        .eq("slug", categorySlug)
        .single();

      if (error) throw error;
      if (!data) {
        setCategory(null);
        inMemoryCategoryCache.set(categorySlug, { category: null, companies: [] });
        return;
      }

      const categoryPreviews: LogoPreview[] = [];
      const subs: CompanySubcategory[] = (data.companies_subcategories || [])
        .map((sub: any) => {
          const subPreviews = pickPreviewLogos(
            (sub.companies_subcategories_join || [])
              .map(mapJoinToPreview)
              .filter((p: LogoPreview | null): p is LogoPreview => p !== null)
          );

          categoryPreviews.push(...subPreviews);

          return {
            id: sub.id,
            name: sub.name,
            slug: sub.slug,
            description: sub.description || null,
            companyCount: (sub.companies_subcategories_join || []).length,
            previewLogos: subPreviews,
          };
        })
        .sort((a: CompanySubcategory, b: CompanySubcategory) => b.companyCount - a.companyCount);

      const companyIdSet = new Set<string>(
        (data.companies_subcategories || []).flatMap((sub: any) =>
          (sub.companies_subcategories_join || []).map((j: any) => j.company_id as string)
        )
      );

      const nextCategory: CompanyCategory = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        subcategories: subs,
        totalCompanies: companyIdSet.size,
        previewLogos: pickPreviewLogos(categoryPreviews),
      };

      setCategory(nextCategory);
      const companiesList = await fetchCategoryCompanies(subs.map((s) => s.id));
      inMemoryCategoryCache.set(categorySlug, { category: nextCategory, companies: companiesList });
    } catch (err) {
      console.error("PartnerHub category error:", err);
      wallsToast.error("Error", "Failed to load category");
      setCategory(null);
    } finally {
      setLoading(false);
    }
  }, [user, categorySlug]);

  const fetchCategoryCompanies = async (subcategoryIds: string[]): Promise<CompanyWithRoute[]> => {
    if (subcategoryIds.length === 0) {
      setCompanies([]);
      return [];
    }
    setLoadingCompanies(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("companies_subcategories_join")
        .select(`
          company_id,
          subcategory:companies_subcategories(slug),
          company:companies(
            id, name, logo_url, website, industry,
            employee_count, annual_revenue_printed, total_funding_printed, overview
          )
        `)
        .in("subcategory_id", subcategoryIds);

      if (error) throw error;

      const seen = new Set<string>();
      const list: CompanyWithRoute[] = (data || [])
        .map((row) => {
          const company = unwrapRelation(row.company);
          const subcategory = unwrapRelation(row.subcategory);
          if (!company?.id || !subcategory?.slug) return null;
          if (seen.has(company.id)) return null;
          seen.add(company.id);
          return {
            ...mapCompanyRow(company),
            subcategorySlug: subcategory.slug,
          };
        })
        .filter((item): item is CompanyWithRoute => item !== null)
        .sort((a: CompanyWithRoute, b: CompanyWithRoute) => a.name.localeCompare(b.name));

      setCompanies(list);
      return list;
    } catch (err) {
      console.error("PartnerHub category companies fetch error:", err);
      wallsToast.error("Error", "Failed to load companies");
      return [];
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Initial load only — skip if cached data was hydrated synchronously on mount,
  // and don't refetch when navigating back to a previously viewed category
  useEffect(() => {
    if (!user) return;
    if (fetchedKeyRef.current === categorySlug) return;

    const cachedEntry = inMemoryCategoryCache.get(categorySlug);
    if (cachedEntry) {
      setCategory(cachedEntry.category);
      setCompanies(cachedEntry.companies);
      setLoading(false);
      fetchedKeyRef.current = categorySlug;
      return;
    }

    fetchedKeyRef.current = categorySlug;
    setLoading(true);
    fetchCategory();
  }, [user, categorySlug, fetchCategory]);

  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) return companies;
    const term = searchTerm.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(term));
  }, [companies, searchTerm]);

  return (
    <CompaniesPageShell>
      <div className="pt-6 pb-6">
        <Link
          href="/companies"
          className="flex items-center gap-1.5 text-xs font-light text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-3 w-3" />
          All categories
        </Link>
      </div>

      <div className="mb-12 pr-2">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={cn(cardSurfaceClass, "h-48 animate-pulse bg-neutral-100/80")} />
            ))}
          </div>
        ) : !category ? (
          <p className="text-sm text-neutral-400 font-light">Category not found.</p>
        ) : category.subcategories.length === 0 ? (
          <p className="text-sm text-neutral-400 font-light">No subcategories yet.</p>
        ) : (
          <>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-6">
              {category.name} · {category.subcategories.length} subcategories
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {category.subcategories.map((sub) => (
                <CategoryTile
                  key={sub.id}
                  count={sub.companyCount}
                  label={sub.name}
                  previewLogos={sub.previewLogos}
                  href={`/companies/${category.slug}/${sub.slug}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && category && (
        <div className="mb-12 pr-2">
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
              All brands · {filteredCompanies.length.toLocaleString()}
            </p>
          </div>

          <div className="mb-8">
            <CompaniesSearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>

          {loadingCompanies ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={cn(cardSurfaceClass, "h-56 animate-pulse bg-neutral-100/80")} />
              ))}
            </div>
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
                  href={companyDetailPath(categorySlug, company.subcategorySlug, company.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </CompaniesPageShell>
  );
}
