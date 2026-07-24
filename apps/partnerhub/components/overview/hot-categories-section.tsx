"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { cn } from "@/lib/utils";
import {
  cardSurfaceClass,
  CategoryTile,
  LogoPreview,
  mapJoinToPreview,
  pickPreviewLogos,
} from "@/components/companies/shared";

interface HotCategory {
  id: string;
  name: string;
  slug: string;
  companyCount: number;
  previewLogos: LogoPreview[];
}

const HOT_CATEGORY_LIMIT = 6;

export function HotCategoriesSection() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<HotCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHotCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("companies_categories")
        .select(
          `
          id, name, slug,
          companies_subcategories(
            companies_subcategories_join(
              company:companies(id, name, logo_url, website)
            )
          )
        `
        )
        .eq("is_active", true);

      if (error) throw error;

      const parsed: HotCategory[] = (data || [])
        .map((cat: Record<string, unknown>) => {
          const previews: LogoPreview[] = [];
          const companyIds = new Set<string>();

          ((cat.companies_subcategories as Array<Record<string, unknown>>) || []).forEach(
            (sub) => {
              ((sub.companies_subcategories_join as Array<Record<string, unknown>>) || []).forEach(
                (join) => {
                  const preview = mapJoinToPreview(
                    join as {
                      company?: {
                        id: string;
                        name: string;
                        logo_url: string | null;
                        website: string | null;
                      } | null;
                    }
                  );
                  if (preview) {
                    companyIds.add(preview.id);
                    previews.push(preview);
                  }
                }
              );
            }
          );

          return {
            id: cat.id as string,
            name: cat.name as string,
            slug: cat.slug as string,
            companyCount: companyIds.size,
            previewLogos: pickPreviewLogos(previews),
          };
        })
        .filter((cat) => cat.companyCount > 0)
        .sort((a, b) => b.companyCount - a.companyCount)
        .slice(0, HOT_CATEGORY_LIMIT);

      setCategories(parsed);
    } catch (err) {
      console.error("Hot categories fetch error:", err);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchHotCategories();
  }, [user, fetchHotCategories]);

  if (!loading && categories.length === 0) {
    return null;
  }

  return (
    <div className="mb-12 pr-2">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-orange-500" />
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Hot categories
          </p>
        </div>
        {!loading && (
          <Link
            href="/companies"
            className="text-xs font-light uppercase tracking-wider text-neutral-400 transition-colors hover:text-neutral-900"
          >
            View all →
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(HOT_CATEGORY_LIMIT)].map((_, i) => (
            <div
              key={i}
              className={cn(cardSurfaceClass, "h-48 animate-pulse bg-neutral-100/80")}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryTile
              key={category.id}
              count={category.companyCount}
              label={category.name}
              previewLogos={category.previewLogos}
              href={`/companies/${category.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
