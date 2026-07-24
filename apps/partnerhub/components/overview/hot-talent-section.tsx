"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { AVATAR_FALLBACK_URL } from "@/lib/asset-urls";
import { cn } from "@/lib/utils";
import { cardSurfaceClass } from "@/components/companies/shared";

interface HotTalent {
  id: string;
  name: string;
  avatarUrl?: string;
  category?: string;
  dealCount: number;
}

const HOT_TALENT_LIMIT = 8;

function TalentAvatar({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = !failed && src ? src : AVATAR_FALLBACK_URL;

  return (
    <img
      src={imageSrc}
      alt={alt}
      className="h-20 w-20 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function TalentCard({ talent }: { talent: HotTalent }) {
  return (
    <Link
      href="/deal-board"
      title={talent.name}
      className={cn(
        cardSurfaceClass,
        "group flex w-40 shrink-0 flex-col items-center px-4 py-6 text-center transition-all duration-300 hover:scale-[0.99]"
      )}
    >
      <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/60">
        <TalentAvatar src={talent.avatarUrl} alt={talent.name} />
      </div>
      <p className="w-full truncate text-base font-semibold text-neutral-900">{talent.name}</p>
      <p className="mt-1.5 text-[11px] font-light uppercase tracking-[0.14em] text-neutral-400">
        {talent.dealCount} {talent.dealCount === 1 ? "deal" : "deals"}
      </p>
      {talent.category && (
        <p className="mt-1 w-full truncate text-[11px] font-light text-neutral-300">
          {talent.category}
        </p>
      )}
    </Link>
  );
}

function TalentCardSkeleton() {
  return (
    <div
      className={cn(
        cardSurfaceClass,
        "flex w-40 shrink-0 flex-col items-center px-4 py-6"
      )}
    >
      <div className="mb-4 h-24 w-24 rounded-full bg-neutral-200 animate-pulse" />
      <div className="h-4 w-20 rounded bg-neutral-200 animate-pulse" />
      <div className="mt-2 h-3 w-12 rounded bg-neutral-200 animate-pulse" />
    </div>
  );
}

export function HotTalentSection() {
  const { user } = useAuth();
  const [talent, setTalent] = useState<HotTalent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHotTalent = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("partnerships")
        .select(
          `
          talent_name,
          talent_profile_id,
          profile:profiles!partnerships_talent_profile_id_fkey(
            avatar_url,
            profile_categories(name)
          )
        `
        )
        .not("talent_name", "is", null)
        .order("last_post_at", { ascending: false, nullsFirst: false })
        .limit(3000);

      if (error) throw error;

      const aggregated = new Map<string, HotTalent>();

      (data || []).forEach((row: Record<string, unknown>) => {
        const name = (row.talent_name as string)?.trim();
        if (!name) return;

        const profileId = row.talent_profile_id as string | null;
        const key = profileId || name;
        const profile = row.profile as {
          avatar_url?: string | null;
          profile_categories?: { name?: string } | null;
        } | null;

        const existing = aggregated.get(key);
        if (existing) {
          existing.dealCount += 1;
          return;
        }

        aggregated.set(key, {
          id: key,
          name,
          avatarUrl: profile?.avatar_url || undefined,
          category: profile?.profile_categories?.name || undefined,
          dealCount: 1,
        });
      });

      const parsed = Array.from(aggregated.values())
        .sort((a, b) => b.dealCount - a.dealCount)
        .slice(0, HOT_TALENT_LIMIT);

      setTalent(parsed);
    } catch (err) {
      console.error("Hot talent fetch error:", err);
      setTalent([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchHotTalent();
  }, [user, fetchHotTalent]);

  if (!loading && talent.length === 0) {
    return null;
  }

  return (
    <div className="mb-10 pr-2">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-orange-500" />
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Hot talent
          </p>
        </div>
        {!loading && (
          <Link
            href="/deal-board"
            className="text-xs font-light uppercase tracking-wider text-neutral-400 transition-colors hover:text-neutral-900"
          >
            View all →
          </Link>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
        {loading
          ? [...Array(HOT_TALENT_LIMIT)].map((_, i) => <TalentCardSkeleton key={i} />)
          : talent.map((item) => <TalentCard key={item.id} talent={item} />)}
      </div>
    </div>
  );
}
