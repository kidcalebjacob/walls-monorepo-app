"use client";

import { wallsToast } from "@/components/ui/walls-toast";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
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

type SubcategoryWithCompanies = CompanySubcategory & { companies: CompanyItem[] };
type CategoryWithCompanies = Omit<CompanyCategory, "subcategories"> & {
  subcategories: SubcategoryWithCompanies[];
};

type SearchResult =
  | { type: "category"; category: CategoryWithCompanies }
  | { type: "subcategory"; category: CategoryWithCompanies; subcategory: SubcategoryWithCompanies }
  | {
      type: "company";
      category: CategoryWithCompanies;
      subcategory: SubcategoryWithCompanies;
      company: CompanyItem;
    };

// Module-level in-memory cache — persists across tab navigation, cleared on page refresh
let inMemoryCategoriesCache: CategoryWithCompanies[] | null = null;

export default function PartnerHubCompaniesIndex() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(() => inMemoryCategoriesCache === null);
  const [categories, setCategories] = useState<CategoryWithCompanies[]>(() => inMemoryCategoriesCache ?? []);
  const [searchTerm, setSearchTerm] = useState("");
  const hasFetchedRef = useRef(inMemoryCategoriesCache !== null);

  const fetchCategories = useCallback(async () => {
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
              company:companies(
                id, name, logo_url, website, industry,
                employee_count, annual_revenue_printed, total_funding_printed, overview
              )
            )
          )
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const cats: CategoryWithCompanies[] = (data || []).map((cat: any) => {
        const categoryPreviews: LogoPreview[] = [];

        const subs: SubcategoryWithCompanies[] = (cat.companies_subcategories || [])
          .map((sub: any) => {
            const joins = sub.companies_subcategories_join || [];
            const subPreviews = pickPreviewLogos(
              joins
                .map(mapJoinToPreview)
                .filter((p: LogoPreview | null): p is LogoPreview => p !== null)
            );

            categoryPreviews.push(...subPreviews);

            const companies: CompanyItem[] = joins
              .map((row: { company?: unknown }) => row.company)
              .filter(Boolean)
              .map((company: Parameters<typeof mapCompanyRow>[0]) => mapCompanyRow(company))
              .sort((a: CompanyItem, b: CompanyItem) => a.name.localeCompare(b.name));

            return {
              id: sub.id,
              name: sub.name,
              slug: sub.slug,
              description: sub.description || null,
              companyCount: joins.length,
              previewLogos: subPreviews,
              companies,
            };
          })
          .sort(
            (a: SubcategoryWithCompanies, b: SubcategoryWithCompanies) =>
              b.companyCount - a.companyCount
          );

        const companyIdSet = new Set<string>(
          (cat.companies_subcategories || []).flatMap((sub: any) =>
            (sub.companies_subcategories_join || []).map((j: any) => j.company_id as string)
          )
        );

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || null,
          subcategories: subs,
          totalCompanies: companyIdSet.size,
          previewLogos: pickPreviewLogos(categoryPreviews),
        };
      }).sort(
        (a: CategoryWithCompanies, b: CategoryWithCompanies) => b.totalCompanies - a.totalCompanies
      );

      setCategories(cats);
      inMemoryCategoriesCache = cats;
    } catch (err) {
      console.error("PartnerHub categories error:", err);
      wallsToast.error("Error", "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load only — skip if cached data was hydrated synchronously on mount,
  // and don't refetch when navigating back to this page
  useEffect(() => {
    if (!user) return;
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchCategories();
  }, [user, fetchCategories]);

  const searchResults = useMemo((): SearchResult[] => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return categories.map((category) => ({ type: "category", category }));
    }

    const results: SearchResult[] = [];
    const seenCompanyIds = new Set<string>();

    for (const category of categories) {
      const categoryMatches = category.name.toLowerCase().includes(term);

      if (categoryMatches) {
        results.push({ type: "category", category });
        continue;
      }

      for (const subcategory of category.subcategories) {
        const subcategoryMatches = subcategory.name.toLowerCase().includes(term);

        if (subcategoryMatches) {
          results.push({ type: "subcategory", category, subcategory });
          continue;
        }

        for (const company of subcategory.companies) {
          if (company.name.toLowerCase().includes(term) && !seenCompanyIds.has(company.id)) {
            seenCompanyIds.add(company.id);
            results.push({ type: "company", category, subcategory, company });
          }
        }
      }
    }

    return results;
  }, [categories, searchTerm]);

  return (
    <CompaniesPageShell>
      <div className="pt-6 mb-8 pr-2">
        <CompaniesSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search categories, subcategories, and brands…"
        />
      </div>

      <div className="mb-12 pr-2">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={cn(cardSurfaceClass, "h-48 animate-pulse bg-neutral-100/80")} />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-neutral-400 font-light">No categories yet.</p>
        ) : searchResults.length === 0 ? (
          <p className="text-sm text-neutral-400 font-light">
            No categories, subcategories, or brands match your search.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((result) => {
              if (result.type === "category") {
                return (
                  <CategoryTile
                    key={`category-${result.category.id}`}
                    count={result.category.totalCompanies}
                    label={result.category.name}
                    previewLogos={result.category.previewLogos}
                    href={`/companies/${result.category.slug}`}
                  />
                );
              }

              if (result.type === "subcategory") {
                return (
                  <CategoryTile
                    key={`subcategory-${result.subcategory.id}`}
                    count={result.subcategory.companyCount}
                    label={result.subcategory.name}
                    previewLogos={result.subcategory.previewLogos}
                    href={`/companies/${result.category.slug}/${result.subcategory.slug}`}
                    sublabel={result.category.name}
                  />
                );
              }

              return (
                <div key={`company-${result.company.id}-${result.subcategory.id}`}>
                  <p className="mb-2 truncate px-1 text-[10px] font-light uppercase tracking-[0.12em] text-neutral-300">
                    {result.category.name} · {result.subcategory.name}
                  </p>
                  <CompanyCardItem
                    company={result.company}
                    href={companyDetailPath(
                      result.category.slug,
                      result.subcategory.slug,
                      result.company.id
                    )}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CompaniesPageShell>
  );
}
