"use client";

import { useCallback, useEffect, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";

import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import {
  buildDealsQuery,
  mapRawDealsToDeals,
} from "@/components/agentCRM/agentDeals/index/deals-data";

import type {
  CalendarEventMarker,
  CrmDashboardData,
  DashboardDealCard,
  FeaturedContact,
  StageFunnelRow,
} from "./types";

const EMPTY_DATA: CrmDashboardData = {
  kpis: {
    wonAmountThisMonth: 0,
    wonDealsThisMonth: 0,
    wonWeekDeltaPct: null,
    newContactsThisWeek: 0,
    newContactsToday: 0,
    tasksThisWeek: 0,
    tasksToday: 0,
    pipelineTotal: 0,
    pipelineWeighted: 0,
  },
  recentDeals: [],
  funnel: [],
  calendarEvents: [],
  featuredContact: null,
};

function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= start.getTime() && t <= end.getTime();
}

function toDealCard(deal: Awaited<ReturnType<typeof mapRawDealsToDeals>>[number], index: number): DashboardDealCard {
  const avatars = [
    ...(deal.talent || []).map((t) => ({
      id: t.id,
      name: t.name,
      avatarUrl: t.avatar_url,
    })),
    ...(deal.contacts || []).map((c) => ({
      id: c.id,
      name: c.name,
      avatarUrl: c.avatar_url,
    })),
  ];

  if (avatars.length === 0 && deal.dealOwner) {
    avatars.push({
      id: `owner-${deal.id}`,
      name: deal.dealOwner,
      avatarUrl: deal.dealOwnerProfilePicture,
    });
  }

  const createdAt =
    deal.createdAt instanceof Date
      ? deal.createdAt.toISOString()
      : typeof deal.createdAt === "string"
        ? deal.createdAt
        : typeof deal.createdAt === "number"
          ? new Date(deal.createdAt).toISOString()
          : null;

  return {
    id: deal.id,
    dealName: deal.dealName,
    company: deal.company,
    amount: deal.amount,
    amountDisplay: deal.amountDisplay,
    stage: deal.stage,
    createdAt,
    avatars: avatars.slice(0, 4),
    isWon: deal.stageData?.is_won ?? false,
    isLost: deal.stageData?.is_lost ?? false,
    stageOrder: deal.stageData?.index_order ?? index,
    probability: null,
    dealStageId: deal.dealStageId,
  };
}

export function useCrmDashboardData() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<CrmDashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setData(EMPTY_DATA);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const prevWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      const [stagesRes, dealsRawRes, peopleWeekRes, peopleTodayRes, peopleFeaturedRes, eventsRes, tasksRes] =
        await Promise.all([
          supabase
            .from("deal_stages")
            .select("id, name, slug, is_won, is_lost, order_index, probability")
            .order("order_index", { ascending: true }),
          buildDealsQuery(supabase, {
            filters: {
              status: "all",
              stage: "",
              owner: "all",
              searchTerm: "",
              amountRange: "",
            },
            currentUserId: null,
            debouncedSearchTerm: "",
            sort: {
              sortDirection: "desc",
              isSortingByRecency: true,
              isSortingByName: false,
              isSortingByStage: false,
            },
            withCount: false,
            forKanban: true,
          }).limit(200),
          supabase
            .from("people")
            .select("id", { count: "exact", head: true })
            .eq("person_type", "contact")
            .gte("created_at", weekStart.toISOString())
            .lte("created_at", weekEnd.toISOString()),
          supabase
            .from("people")
            .select("id", { count: "exact", head: true })
            .eq("person_type", "contact")
            .gte("created_at", todayStart.toISOString())
            .lte("created_at", todayEnd.toISOString()),
          supabase
            .from("people")
            .select(
              `
              id,
              first_name,
              last_name,
              email,
              phone,
              title,
              photo_url,
              linkedin_url,
              twitter_url,
              facebook_url,
              github_url,
              last_contacted,
              source,
              company_name,
              company:companies!people_company_id_fkey ( name )
            `,
            )
            .eq("person_type", "contact")
            .order("last_contacted", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("deal_events")
            .select(
              `
              id,
              name,
              due_at,
              deal_id,
              deals (
                deal_name,
                users!deals_deal_owner_fkey ( first_name, last_name, avatar_url )
              )
            `,
            )
            .gte("due_at", monthStart.toISOString())
            .lte("due_at", monthEnd.toISOString())
            .order("due_at", { ascending: true })
            .limit(80),
          supabase
            .from("sequence_steps_people_join")
            .select(
              `
              id,
              scheduled_for,
              status,
              sequence_step_join:sequence_steps_join (
                step:sequence_steps ( is_task, name )
              )
            `,
            )
            .eq("status", "scheduled")
            .gte("scheduled_for", weekStart.toISOString())
            .lte("scheduled_for", weekEnd.toISOString())
            .limit(100),
        ]);

      if (dealsRawRes.error) throw dealsRawRes.error;
      if (stagesRes.error) throw stagesRes.error;

      const deals = await mapRawDealsToDeals(supabase, dealsRawRes.data || []);
      const stageById = new Map(
        (stagesRes.data || []).map((s) => [
          s.id,
          {
            ...s,
            probability:
              s.probability != null && Number.isFinite(Number(s.probability))
                ? Number(s.probability)
                : null,
          },
        ]),
      );

      const dealCards = deals.map((deal, i) => {
        const card = toDealCard(deal, i);
        const stage = deal.dealStageId ? stageById.get(deal.dealStageId) : undefined;
        return {
          ...card,
          probability: stage?.probability ?? null,
        };
      });

      const wonDeals = dealCards.filter((d) => d.isWon);
      const wonThisMonthDeals = wonDeals.filter((d) =>
        inRange(d.createdAt, monthStart, monthEnd),
      );
      const wonAmountThisMonth = wonThisMonthDeals.reduce(
        (sum, d) => sum + d.amount,
        0,
      );
      const wonDealsThisMonth = wonThisMonthDeals.length;

      const wonThisWeek = wonDeals
        .filter((d) => inRange(d.createdAt, weekStart, weekEnd))
        .reduce((sum, d) => sum + d.amount, 0);
      const wonPrevWeek = wonDeals
        .filter((d) => inRange(d.createdAt, prevWeekStart, prevWeekEnd))
        .reduce((sum, d) => sum + d.amount, 0);
      const wonWeekDeltaPct =
        wonPrevWeek > 0
          ? Math.round(((wonThisWeek - wonPrevWeek) / wonPrevWeek) * 100)
          : wonThisWeek > 0
            ? 100
            : null;

      const activeDeals = dealCards.filter((d) => !d.isWon && !d.isLost);

      const funnelMap = new Map<string, StageFunnelRow>();
      for (const stage of stagesRes.data || []) {
        if (stage.is_won || stage.is_lost) continue;
        funnelMap.set(stage.id, {
          id: stage.id,
          name: stage.name,
          amount: 0,
          weightedAmount: 0,
          dealCount: 0,
          orderIndex: stage.order_index ?? 0,
          isWon: false,
          isLost: false,
        });
      }

      for (const deal of activeDeals) {
        if (!deal.dealStageId) continue;
        const row = funnelMap.get(deal.dealStageId);
        if (!row) continue;
        const prob =
          deal.probability != null ? deal.probability / 100 : 1;
        row.amount += deal.amount;
        row.weightedAmount += deal.amount * prob;
        row.dealCount += 1;
      }

      const funnel = Array.from(funnelMap.values())
        .filter((r) => r.dealCount > 0 || r.amount > 0)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const pipelineTotal = funnel.reduce((s, r) => s + r.amount, 0);
      const pipelineWeighted = funnel.reduce((s, r) => s + r.weightedAmount, 0);

      const calendarEvents: CalendarEventMarker[] = (eventsRes.data || []).map(
        (ev: any, index: number) => {
          const deal = Array.isArray(ev.deals) ? ev.deals[0] : ev.deals;
          const owner = deal
            ? Array.isArray(deal.users)
              ? deal.users[0]
              : deal.users
            : null;
          const ownerName = owner
            ? `${owner.first_name || ""} ${owner.last_name || ""}`.trim()
            : "";
          return {
            id: ev.id,
            date: new Date(ev.due_at),
            label: ev.name || deal?.deal_name || "Event",
            dealId: ev.deal_id,
            avatarUrl: owner?.avatar_url ?? null,
            avatarName: ownerName || undefined,
            colorIndex: index % 4,
          };
        },
      );

      const taskRows = (tasksRes.data || []).filter((row: any) => {
        const join = Array.isArray(row.sequence_step_join)
          ? row.sequence_step_join[0]
          : row.sequence_step_join;
        const step = join
          ? Array.isArray(join.step)
            ? join.step[0]
            : join.step
          : null;
        return step?.is_task === true;
      });

      const tasksThisWeek = taskRows.length;
      const tasksToday = taskRows.filter((row: any) =>
        inRange(row.scheduled_for, todayStart, todayEnd),
      ).length;

      let featuredContact: FeaturedContact | null = null;
      if (peopleFeaturedRes.data) {
        const p = peopleFeaturedRes.data as any;
        const companyRel = Array.isArray(p.company) ? p.company[0] : p.company;
        featuredContact = {
          id: p.id,
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          email: p.email || "",
          phone: p.phone || "",
          title: p.title || "",
          company: companyRel?.name || p.company_name || "",
          photoUrl: p.photo_url,
          linkedinUrl: p.linkedin_url,
          twitterUrl: p.twitter_url,
          facebookUrl: p.facebook_url,
          githubUrl: p.github_url,
          lastContacted: p.last_contacted,
          source: p.source,
        };
      } else if (!peopleFeaturedRes.error) {
        // Fallback: most recently created contact
        const { data: fallback } = await supabase
          .from("people")
          .select(
            `
            id,
            first_name,
            last_name,
            email,
            phone,
            title,
            photo_url,
            linkedin_url,
            twitter_url,
            facebook_url,
            github_url,
            last_contacted,
            source,
            company_name,
            company:companies!people_company_id_fkey ( name )
          `,
          )
          .eq("person_type", "contact")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallback) {
          const companyRel = Array.isArray(fallback.company)
            ? fallback.company[0]
            : fallback.company;
          featuredContact = {
            id: fallback.id,
            firstName: fallback.first_name || "",
            lastName: fallback.last_name || "",
            email: fallback.email || "",
            phone: fallback.phone || "",
            title: fallback.title || "",
            company: companyRel?.name || fallback.company_name || "",
            photoUrl: fallback.photo_url,
            linkedinUrl: fallback.linkedin_url,
            twitterUrl: fallback.twitter_url,
            facebookUrl: fallback.facebook_url,
            githubUrl: fallback.github_url,
            lastContacted: fallback.last_contacted,
            source: fallback.source,
          };
        }
      }

      setData({
        kpis: {
          wonAmountThisMonth,
          wonDealsThisMonth,
          wonWeekDeltaPct,
          newContactsThisWeek: peopleWeekRes.count ?? 0,
          newContactsToday: peopleTodayRes.count ?? 0,
          tasksThisWeek,
          tasksToday,
          pipelineTotal,
          pipelineWeighted,
        },
        recentDeals: dealCards.slice(0, 6),
        funnel,
        calendarEvents,
        featuredContact,
      });
    } catch (err) {
      console.error("CRM dashboard fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}
