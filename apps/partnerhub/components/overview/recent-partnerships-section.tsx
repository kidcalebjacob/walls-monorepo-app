"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { AVATAR_FALLBACK_URL, fallbackIconUrl } from "@/lib/asset-urls";
import { cn } from "@/lib/utils";

interface RecentPartnership {
  id: string;
  talentName: string;
  talentAvatar?: string;
  companyName: string;
  companyLogo?: string;
  partnershipUrl: string | null;
}

const DISPLAY_LIMIT = 20;

function PartnershipAvatar({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string;
  alt: string;
  fallback: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageSrc = !failed && src ? src : fallback;

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={cn(
        "rounded-full object-cover border-2 border-white bg-neutral-100 shadow-sm",
        className
      )}
      onError={() => setFailed(true)}
    />
  );
}

function PartnershipDuo({ partnership }: { partnership: RecentPartnership }) {
  const href =
    partnership.partnershipUrl || "/deal-board";
  const isExternal = href.startsWith("http");

  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      title={`${partnership.talentName} × ${partnership.companyName}`}
      className="group shrink-0 rounded-full border border-neutral-200 bg-neutral-50/80 p-2 transition-all duration-200 hover:border-neutral-300 hover:bg-white hover:shadow-sm"
    >
      <div className="relative flex items-center">
        <PartnershipAvatar
          src={partnership.talentAvatar}
          alt={partnership.talentName}
          fallback={AVATAR_FALLBACK_URL}
          className="relative z-10 h-16 w-16"
        />
        <PartnershipAvatar
          src={partnership.companyLogo}
          alt={partnership.companyName}
          fallback={fallbackIconUrl(64)}
          className="-ml-6 h-16 w-16 object-contain p-2"
        />
      </div>
    </a>
  );
}

function PartnershipDuoSkeleton() {
  return (
    <div className="flex shrink-0 rounded-full border border-neutral-200 bg-neutral-50 p-2">
      <div className="flex items-center">
        <div className="h-16 w-16 rounded-full bg-neutral-200 animate-pulse" />
        <div className="-ml-6 h-16 w-16 rounded-full bg-neutral-200 animate-pulse" />
      </div>
    </div>
  );
}

export function RecentPartnershipsSection() {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<RecentPartnership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPartnerships = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("partnerships")
        .select(
          `
          id,
          talent_name,
          company_name,
          video_url,
          company:companies!partnerships_company_id_fkey(name, logo_url),
          profile:profiles!partnerships_talent_profile_id_fkey(avatar_url),
          partnership_content:partnership_content(content_url, posted_at)
        `
        )
        .order("last_post_at", { ascending: false, nullsFirst: false })
        .limit(DISPLAY_LIMIT);

      if (error) throw error;

      const parsed: RecentPartnership[] = (data || []).map((row: Record<string, unknown>) => {
        const company = row.company as { name?: string; logo_url?: string | null } | null;
        const profile = row.profile as { avatar_url?: string | null } | null;
        const content = (row.partnership_content as Array<{ content_url?: string; posted_at?: string }> | null) ?? [];
        const sortedContent = [...content].sort(
          (a, b) =>
            new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime()
        );

        return {
          id: row.id as string,
          talentName: (row.talent_name as string) || "Creator",
          talentAvatar: profile?.avatar_url || undefined,
          companyName: company?.name || (row.company_name as string) || "Brand",
          companyLogo: company?.logo_url || undefined,
          partnershipUrl:
            (row.video_url as string | null) ||
            sortedContent[0]?.content_url ||
            null,
        };
      });

      setPartnerships(parsed);
    } catch (err) {
      console.error("Recent partnerships fetch error:", err);
      setPartnerships([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchPartnerships();
  }, [user, fetchPartnerships]);

  if (!loading && partnerships.length === 0) {
    return null;
  }

  return (
    <div className="mb-10 pr-2">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
          Recent partnerships
        </p>
        {!loading && (
          <Link
            href="/deal-board"
            className="text-xs font-light text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider"
          >
            View all →
          </Link>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
        {loading
          ? [...Array(8)].map((_, i) => <PartnershipDuoSkeleton key={i} />)
          : partnerships.map((partnership) => (
              <PartnershipDuo key={partnership.id} partnership={partnership} />
            ))}
      </div>
    </div>
  );
}
