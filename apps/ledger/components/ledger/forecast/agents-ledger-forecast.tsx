"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from '@walls/auth';
import { getSupabaseClient } from '@walls/auth';
import { LedgerHeader } from "../ledger-header";
import { ForecastChart } from "./forecast-chart";
import { ForecastSummaryCards } from "./forecast-summary-cards";
import { CRMSkeleton } from "@/components/ui/crm-skeleton";
import { LedgerEntry } from "../index/types";
import { motion } from "framer-motion";
import { useMotionValue, useSpring, useTransform } from "framer-motion";
import { TrendingUp } from "lucide-react";

/** Wise transaction row returned by Supabase query */
interface WiseTransactionRow {
  id: string;
  wise_transaction_id: string;
  type: string;
  amount: number;
  currency: string;
  merchant_name: string | null;
  wise_created_at: string;
  raw?: { referenceNumber?: string; details?: { description?: string } };
  usd_amount?: number | null;
}

function wiseTransactionToLedgerEntry(row: WiseTransactionRow): LedgerEntry {
  const amount = Number(row.amount);
  const wiseType = (row.type || "").toUpperCase();
  let type: LedgerEntry["type"] = "payment";
  if (amount > 0) type = "income";
  else if (wiseType === "TRANSFER") type = "payout";
  else if (wiseType === "CARD") type = "payment";
  else if (wiseType === "CONVERSION" || wiseType.includes("FEE")) type = "fee";
  else type = "payout";

  return {
    id: row.id,
    date: row.wise_created_at,
    type,
    description:
      row.merchant_name ||
      (row.raw?.details?.description as string | undefined) ||
      `${row.type || "Transaction"} ${row.currency}`,
    recipientOrPayer: row.merchant_name || "—",
    amount,
    currency: row.currency || "USD",
    status: "completed",
    source: "wise",
    reference: row.raw?.referenceNumber,
    createdAt: row.wise_created_at,
    sourceType: row.type ?? undefined,
    usd_amount: row.usd_amount ?? undefined,
  };
}

export interface MonthlySnapshot {
  month: string;
  year: number;
  monthIndex: number;
  income: number;
  expenses: number;
  net: number;
}

export interface ForecastPoint {
  month: string;
  actual: number | null;
  projected: number | null;
  income: number | null;
  expenses: number | null;
  projectedIncome: number | null;
  projectedExpenses: number | null;
  probableIncomeFromDeals: number | null;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function buildHistoricalSnapshots(entries: LedgerEntry[]): MonthlySnapshot[] {
  const now = new Date();
  const snapshots: MonthlySnapshot[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let income = 0;
    let expenses = 0;
    for (const e of entries) {
      if (e.date.slice(0, 7) !== monthKey) continue;
      const amt = e.usd_amount != null ? Number(e.usd_amount) : Number(e.amount);
      if (amt > 0) income += amt;
      else expenses += Math.abs(amt);
    }
    snapshots.push({
      month: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
    });
  }
  return snapshots;
}

function buildForecastPoints(
  historical: MonthlySnapshot[],
  avgIncome: number,
  avgExpenses: number,
  dealsProbableByMonth: Record<string, number>
): ForecastPoint[] {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const points: ForecastPoint[] = [];

  // Last 3 historical months (actual)
  for (let i = 2; i >= 0; i--) {
    const snap = historical[historical.length - 1 - i];
    if (!snap) continue;
    const monthKey = `${snap.year}-${String(snap.monthIndex + 1).padStart(2, "0")}`;
    const isCurrentMonth = monthKey === currentMonthKey;
    points.push({
      month: snap.month,
      actual: snap.net,
      projected: isCurrentMonth ? Math.round(avgIncome - avgExpenses) : null,
      income: snap.income,
      expenses: snap.expenses,
      projectedIncome: isCurrentMonth ? Math.round(avgIncome * 100) / 100 : null,
      projectedExpenses: isCurrentMonth ? Math.round(avgExpenses * 100) / 100 : null,
      probableIncomeFromDeals:
        isCurrentMonth && dealsProbableByMonth[monthKey] != null
          ? Math.round(dealsProbableByMonth[monthKey] * 100) / 100
          : null,
    });
  }

  // Next 6 projected months
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      month: MONTH_LABELS[d.getMonth()],
      actual: null,
      projected: Math.round((avgIncome - avgExpenses) * 100) / 100,
      income: null,
      expenses: null,
      projectedIncome: Math.round(avgIncome * 100) / 100,
      projectedExpenses: Math.round(avgExpenses * 100) / 100,
      probableIncomeFromDeals:
        dealsProbableByMonth[monthKey] != null
          ? Math.round(dealsProbableByMonth[monthKey] * 100) / 100
          : 0,
    });
  }

  return points;
}

/** Animated number display identical to ledger balance */
function AnimatedAmount({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 18, mass: 0.6 });
  const formatted = useTransform(spring, (latest) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(latest.toFixed(0)));
  });

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  return <motion.span>{formatted}</motion.span>;
}

interface AgentsLedgerForecastProps {
  analyticsData?: unknown;
}

function AgentsLedgerForecastContent({ analyticsData: _analyticsData }: AgentsLedgerForecastProps) {
  const { user } = useAuth();

  // Historical data
  const [historicalEntries, setHistoricalEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealsProbableByMonth, setDealsProbableByMonth] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      setHistoricalEntries([]);
      setDealsProbableByMonth({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const { data: rows, error } = await supabase
          .from("wise_transactions")
          .select("id, wise_transaction_id, type, amount, currency, merchant_name, wise_created_at, raw, usd_amount")
          .gte("wise_created_at", sixMonthsAgo.toISOString())
          .order("wise_created_at", { ascending: false });
        if (error) throw new Error(error.message);
        const list = (Array.isArray(rows) ? rows : []) as WiseTransactionRow[];
        if (!cancelled) setHistoricalEntries(list.map(wiseTransactionToLedgerEntry));
        console.log("[AgentsLedgerForecast] Loaded wise transactions:", {
          count: list.length,
        });

        // Fetch deals for probable income (pipeline) based on deal stages + deliverables
        const { data: dealsData, error: dealsError } = await supabase
          .from("deals")
          .select(
            `
            id,
            created_at,
            deal_owner,
            deal_stage_id,
            deal_stages (
              id,
              is_won,
              is_lost,
              probability
            )
          `
          );

        if (dealsError) {
          console.error("[AgentsLedgerForecast] Error fetching deals for forecast:", dealsError);
          if (!cancelled) setDealsProbableByMonth({});
        } else {
          const dealIds = (dealsData || []).map((d: any) => d.id).filter(Boolean);
          const dealCreatedAtById = new Map<string, string>();
          (dealsData || []).forEach((d: any) => {
            if (d.id && d.created_at) {
              dealCreatedAtById.set(d.id, d.created_at);
            }
          });
          console.log("[AgentsLedgerForecast] Deals fetched for probable income:", {
            dealsCount: dealsData?.length ?? 0,
            dealIdsSample: dealIds.slice(0, 5),
          });
          const dealStageByDealId = new Map<
            string,
            { probability: number; isActive: boolean }
          >();
          (dealsData || []).forEach((deal: any) => {
            const stage = deal.deal_stages
              ? Array.isArray(deal.deal_stages)
                ? deal.deal_stages[0]
                : deal.deal_stages
              : null;
            const isWon = stage?.is_won === true;
            const isLost = stage?.is_lost === true;
            dealStageByDealId.set(deal.id, {
              probability: Number(stage?.probability) || 0,
              isActive: !isWon && !isLost,
            });
          });
          console.log("[AgentsLedgerForecast] Deal stage map summary:", {
            total: dealStageByDealId.size,
          });

          const netPayoutStartByDealId = new Map<string, string>();
          if (dealIds.length > 0) {
            const { data: eventsData } = await supabase
              .from("deal_events")
              .select("deal_id, due_at")
              .in("deal_id", dealIds)
              .eq("event_type", "net_payout_start");
            (eventsData || []).forEach((e: any) => {
              if (e.due_at && !netPayoutStartByDealId.has(e.deal_id)) {
                netPayoutStartByDealId.set(e.deal_id, e.due_at);
              }
            });
            console.log("[AgentsLedgerForecast] net_payout_start events:", {
              eventsCount: eventsData?.length ?? 0,
              mappedDeals: netPayoutStartByDealId.size,
            });
          }

          const probableByMonth: Record<string, number> = {};

          if (dealIds.length > 0) {
            const { data: deliverablesData } = await supabase
              .from("deal_deliverables")
              .select(
                "deal_id, created_at, quantity, unit_price_cents, billing_type, billing_interval, starts_at, recurrence_count, net_payout"
              )
              .in("deal_id", dealIds);

            console.log("[AgentsLedgerForecast] Deliverables fetched for probable income:", {
              deliverablesCount: deliverablesData?.length ?? 0,
            });

            const now = new Date();
            const horizonMonths = 6;
            const horizonEnd = new Date(now.getFullYear(), now.getMonth() + horizonMonths + 1, 0);

            (deliverablesData || []).forEach((d: any) => {
              const q = Number(d.quantity) || 0;
              const c = Number(d.unit_price_cents) || 0;
              let lineTotal = (q * c) / 100;
              const stageInfo = dealStageByDealId.get(d.deal_id);
              if (!stageInfo?.isActive) return;
              const probabilityPct = stageInfo.probability || 0;

              const billingType = String(d.billing_type ?? "").toLowerCase();
              const isRecurring = billingType === "recurring";
              const hasFiniteCount =
                d.recurrence_count != null && Number(d.recurrence_count) > 0;

              // Case 1: recurring with NO recurrence_count -> ongoing subscription-style income
              if (isRecurring && !hasFiniteCount) {
                const interval = (d.billing_interval ?? "monthly").toLowerCase();

                // Convert per-interval value into approximate monthly amount
                let monthlyAmount = lineTotal;
                switch (interval) {
                  case "yearly":
                  case "annual":
                    monthlyAmount = lineTotal / 12;
                    break;
                  case "quarterly":
                    monthlyAmount = lineTotal / 3;
                    break;
                  case "weekly":
                    monthlyAmount = lineTotal * (52 / 12); // ~4.33x per month
                    break;
                  case "bi_weekly":
                  case "biweekly":
                    monthlyAmount = lineTotal * (26 / 12); // ~2.16x per month
                    break;
                  case "monthly":
                  default:
                    monthlyAmount = lineTotal;
                    break;
                }

                // Probable income = expected value (amount × probability), not agent commission
                const probableIncomePerMonth =
                  monthlyAmount * (probabilityPct / 100);

                // Determine when this recurring income starts:
                // prefer deliverable.starts_at, then deal.created_at, else now.
                const rawStart =
                  d.starts_at ||
                  dealCreatedAtById.get(d.deal_id) ||
                  now.toISOString();
                const startDate = new Date(rawStart);
                if (isNaN(startDate.getTime())) return;

                // We only forecast from "now" forward
                const forecastStartMonth = new Date(
                  Math.max(
                    new Date(startDate.getFullYear(), startDate.getMonth(), 1).getTime(),
                    new Date(now.getFullYear(), now.getMonth(), 1).getTime()
                  )
                );

                for (
                  let m = new Date(
                    forecastStartMonth.getFullYear(),
                    forecastStartMonth.getMonth(),
                    1
                  );
                  m <= horizonEnd;
                  m.setMonth(m.getMonth() + 1)
                ) {
                  const monthKey = `${m.getFullYear()}-${String(
                    m.getMonth() + 1
                  ).padStart(2, "0")}`;
                  probableByMonth[monthKey] =
                    (probableByMonth[monthKey] || 0) + probableIncomePerMonth;
                }

                return;
              }

              // Case 2: one-off — always put probable income in the next calendar month so every active one-off shows in the forecast (no dependence on created_at)
              if (!isRecurring) {
                const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                if (nextMonthStart > horizonEnd) return;
                const monthKey = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, "0")}`;
                const probableIncome = lineTotal * (probabilityPct / 100);
                probableByMonth[monthKey] = (probableByMonth[monthKey] || 0) + probableIncome;
                return;
              }

              // Case 3: finite recurring (has recurrence_count) — use net_payout_start + net_payout
              const recur = Number(d.recurrence_count) || 0;
              if (recur > 0) lineTotal *= recur;

              const startAt = netPayoutStartByDealId.get(d.deal_id);
              const netPayoutDays =
                d.net_payout != null ? Number(d.net_payout) : null;
              if (!startAt || netPayoutDays == null) return;

              const startDate = new Date(startAt);
              if (isNaN(startDate.getTime())) return;

              const payoutDate = new Date(startDate);
              payoutDate.setDate(payoutDate.getDate() + netPayoutDays);

              if (payoutDate < now || payoutDate > horizonEnd) return;

              const monthKey = `${payoutDate.getFullYear()}-${String(
                payoutDate.getMonth() + 1
              ).padStart(2, "0")}`;
              const probableIncome = lineTotal * (probabilityPct / 100);
              probableByMonth[monthKey] =
                (probableByMonth[monthKey] || 0) + probableIncome;
            });
          }

          if (!cancelled) {
            console.log("[AgentsLedgerForecast] Computed probable income by month:", probableByMonth);
            setDealsProbableByMonth(probableByMonth);
          }
        }
      } catch {
        if (!cancelled) {
          setHistoricalEntries([]);
          setDealsProbableByMonth({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const historical = React.useMemo(
    () => buildHistoricalSnapshots(historicalEntries),
    [historicalEntries]
  );

  const { avgIncome, avgExpenses, avgNet } = React.useMemo(() => {
    if (historical.length === 0) return { avgIncome: 0, avgExpenses: 0, avgNet: 0 };
    const nonZeroMonths = historical.filter((h) => h.income > 0 || h.expenses > 0);
    const count = nonZeroMonths.length || 1;
    const totalIncome = nonZeroMonths.reduce((s, h) => s + h.income, 0);
    const totalExpenses = nonZeroMonths.reduce((s, h) => s + h.expenses, 0);
    const avg = (n: number) => Math.round((n / count) * 100) / 100;
    return {
      avgIncome: avg(totalIncome),
      avgExpenses: avg(totalExpenses),
      avgNet: avg(totalIncome - totalExpenses),
    };
  }, [historical]);

  const forecastPoints = React.useMemo(
    () => buildForecastPoints(historical, avgIncome, avgExpenses, dealsProbableByMonth),
    [historical, avgIncome, avgExpenses, dealsProbableByMonth]
  );

  // Projected annual totals based on remaining months
  const now = new Date();
  const remainingMonths = 12 - (now.getMonth() + 1);
  const projectedAnnualIncome = React.useMemo(
    () => Math.round(historical.reduce((s, h) => s + h.income, 0) + avgIncome * remainingMonths),
    [historical, avgIncome, remainingMonths]
  );
  const projectedAnnualExpenses = React.useMemo(
    () => Math.round(historical.reduce((s, h) => s + h.expenses, 0) + avgExpenses * remainingMonths),
    [historical, avgExpenses, remainingMonths]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 w-full flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto overscroll-none pl-8 pr-4 md:pr-6">
          {/* Shared header (Cloud icon active) */}
          <LedgerHeader />

          {loading ? (
            <div className="flex flex-col gap-3 mt-6">
              <CRMSkeleton count={4} />
            </div>
          ) : (
            <>
              {/* Hero: Projected Annual Income / Avg Monthly Net / Projected Annual Expenses */}
              <div className="pt-6 pb-6 flex flex-row items-stretch justify-center gap-8 md:gap-12">
                <div className="flex flex-1 flex-col items-center justify-center min-w-0">
                  <p className="text-2xl md:text-3xl font-black tabular-nums text-neutral-900 tracking-tight">
                    <AnimatedAmount value={projectedAnnualIncome} />
                  </p>
                  <span className="mt-0.5 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[140px]">
                    <span className="flex-1 min-w-0 border-t-2 border-solid border-[var(--kenoo-lime)]" />
                    <span className="flex-shrink-0">Annual Income</span>
                    <span className="flex-1 min-w-0 border-t-2 border-solid border-[var(--kenoo-lime)]" />
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl md:text-6xl lg:text-7xl font-black text-neutral-900 tracking-tight tabular-nums">
                        <AnimatedAmount value={avgNet} />
                      </span>
                      <span className="font-light text-neutral-500 uppercase tracking-wider text-sm">
                        / mo
                      </span>
                    </div>
                    <span className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-sm">
                      Avg net
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center min-w-0">
                  <p className="text-2xl md:text-3xl font-black tabular-nums text-neutral-900 tracking-tight">
                    <AnimatedAmount value={projectedAnnualExpenses} />
                  </p>
                  <span className="mt-0.5 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[160px]">
                    <span className="flex-1 min-w-0 border-t-2 border-solid border-[#ff1744]" />
                    <span className="flex-shrink-0">Annual Expenses</span>
                    <span className="flex-1 min-w-0 border-t-2 border-solid border-[#ff1744]" />
                  </span>
                </div>
              </div>

              {/* Forecast chart */}
              <div className="pt-10 pb-2 mb-8 w-full pr-2">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
                  6-month forecast
                </p>
                <ForecastChart forecastPoints={forecastPoints} />
              </div>

              {/* Summary cards */}
              <div className="pb-4">
                <h1 className="text-4xl md:text-5xl font-black text-neutral-900 tracking-tight uppercase">
                  Projections
                </h1>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Based on your last 6 months of WISE activity.
                </p>
              </div>

              <ForecastSummaryCards
                historical={historical}
                avgIncome={avgIncome}
                avgExpenses={avgExpenses}
              />

              {/* Empty state */}
              {historicalEntries.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[240px] text-center px-4 mt-8">
                  <div className="w-16 h-16 rounded-full bg-neutral-200/80 flex items-center justify-center mb-4">
                    <TrendingUp className="h-8 w-8 text-neutral-400" />
                  </div>
                  <p className="text-neutral-600 font-medium">No data to forecast yet</p>
                  <p className="text-sm text-neutral-500 mt-1 max-w-sm">
                    Connect WISE and sync transactions to generate income forecasts and projections.
                  </p>
                </div>
              )}

              <div className="pb-8" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentsLedgerForecast(props: AgentsLedgerForecastProps) {
  return <AgentsLedgerForecastContent {...props} />;
}
