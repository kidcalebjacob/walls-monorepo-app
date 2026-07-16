"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from '@walls/auth';
import { getSupabaseClient } from '@walls/auth';
import {
  LedgerEntry,
} from "./index/types";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from '@walls/utils';
import { LedgerHeader } from "./ledger-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@walls/ui/dropdown-menu';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TalentSearch } from "@/components/ui/searches/talent-search";
import { AgentSearch } from "@/components/ui/searches/agent-search";

/** Slot-machine style animated number (same as agent-home MetricCard). */
function AnimatedBalance({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 18, mass: 0.6 });
  const formatted = useTransform(spring, (latest) => {
    const next = Number(latest.toFixed(2));
    const nf = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return nf.format(next);
  });

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  return <motion.span>{formatted}</motion.span>;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
type ChartDataPoint = { month: string; income: number; payouts: number; expenses: number; net: number; forecast: number };
type RevenueBreakdownPoint = { id: string; name: string; revenue: number };
type ChartRangeKey = "past30Days" | "past3Months" | "past6Months" | "past12Months" | "allTime";

const CHART_RANGE_OPTIONS: Array<{ key: ChartRangeKey; label: string }> = [
  { key: "past30Days", label: "Past 30 days" },
  { key: "past3Months", label: "Past 3 months" },
  { key: "past6Months", label: "Past 6 months" },
  { key: "past12Months", label: "Past 12 months" },
  { key: "allTime", label: "All time" },
];

const EXPENSE_COLORS = [
  "#ff1744", "#ff6b00", "#7a04eb", "#0066b2", "#00a652",
  "#e0ea00", "#00d1c1", "#d63384", "#1e3264", "#fc4c02",
];

const REVENUE_COLORS = [
  "#00a652", "#0066b2", "#00d1c1", "#7a04eb", "#e0ea00",
  "#fc4c02", "#d63384", "#1e3264", "#ff6b00", "#26a69a",
];

function buildChartDataFromEntries(entries: LedgerEntry[], range: ChartRangeKey): ChartDataPoint[] {
  const now = new Date();
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (range === "past30Days") {
    const points: ChartDataPoint[] = [];
    const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      let income = 0;
      let expenses = 0;
      for (const e of entries) {
        const ed = e.date.slice(0, 10);
        if (ed !== dayKey) continue;
        const amt = e.usd_amount != null ? Number(e.usd_amount) : Number(e.amount);
        if (amt > 0) income += amt;
        else expenses += Math.abs(amt);
      }
      const payouts = expenses;
      const net = income - expenses;
      points.push({
        month: dayFmt.format(d),
        income: round2(income),
        payouts: round2(payouts),
        expenses: round2(expenses),
        net: round2(net),
        forecast: 0,
      });
    }
    return points;
  }

  let monthsToShow = 6;
  if (range === "past3Months") monthsToShow = 3;
  else if (range === "past12Months") monthsToShow = 12;
  else if (range === "allTime") {
    const validDates = entries
      .map((e) => new Date(e.date))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (validDates.length > 0) {
      const earliest = validDates.reduce((min, d) => (d < min ? d : min), validDates[0]);
      monthsToShow = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1;
    } else {
      monthsToShow = 1;
    }
  }

  const points: ChartDataPoint[] = [];
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel =
      monthsToShow > 12
        ? `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
        : MONTH_LABELS[d.getMonth()];
    let income = 0;
    let expenses = 0;
    for (const e of entries) {
      const ed = e.date.slice(0, 7);
      if (ed !== monthKey) continue;
      const amt = e.usd_amount != null ? Number(e.usd_amount) : Number(e.amount);
      if (amt > 0) income += amt;
      else expenses += Math.abs(amt);
    }
    const payouts = expenses;
    const net = income - expenses;
    points.push({
      month: monthLabel,
      income: round2(income),
      payouts: round2(payouts),
      expenses: round2(expenses),
      net: round2(net),
      forecast: 0,
    });
  }
  return points;
}

/** Wise transaction row from GET /api/wise/transactions */
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

  const description =
    row.merchant_name ||
    (row.raw?.details?.description as string | undefined) ||
    `${row.type || "Transaction"} ${row.currency}`;
  const recipientOrPayer = row.merchant_name || "—";

  return {
    id: row.id,
    date: row.wise_created_at,
    type,
    description,
    recipientOrPayer,
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

interface AgentsLedgerProps {
  analyticsData?: unknown;
}

function AgentsLedgerContent({ analyticsData: _analyticsData }: AgentsLedgerProps) {
  const { user } = useAuth();
  // WISE wallet balance: all currencies converted to USD total
  const [wiseTotalUsd, setWiseTotalUsd] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"payouts" | "net" | "incomeAndExpenses">("incomeAndExpenses");
  const [chartRange, setChartRange] = useState<ChartRangeKey>("past6Months");

  const [fullTalentRevenueData, setFullTalentRevenueData] = useState<RevenueBreakdownPoint[]>([]);
  const [fullAgentRevenueData, setFullAgentRevenueData] = useState<RevenueBreakdownPoint[]>([]);
  const [displayedTalentIds, setDisplayedTalentIds] = useState<string[]>([]);
  const [displayedAgentIds, setDisplayedAgentIds] = useState<string[]>([]);
  const [talentSwapIndex, setTalentSwapIndex] = useState<number | null>(null);
  const [agentSwapIndex, setAgentSwapIndex] = useState<number | null>(null);
  const [dealsChartsLoading, setDealsChartsLoading] = useState(true);
  const [expensesPage, setExpensesPage] = useState(0);
  const [revenueSourcePage, setRevenueSourcePage] = useState(0);


  /** Full transaction list used for time-range charting + derived windows. */
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  // Fetch WISE balance from Supabase (sum of balance_usd) when user is present
  useEffect(() => {
    if (!user) {
      setBalanceLoading(false);
      setWiseTotalUsd(null);
      return;
    }

    let cancelled = false;
    const supabase = getSupabaseClient();

    async function loadBalance() {
      setBalanceLoading(true);
      setBalanceError(null);
      try {
        const { data, error } = await supabase
          .from("wise_wallets")
          .select("balance_usd, is_active")
          .eq("is_active", true);

        if (cancelled) return;

        if (error) {
          setBalanceError(error.message || "Unable to load balance");
          setWiseTotalUsd(null);
          return;
        }

        const rows = Array.isArray(data) ? data : [];
        let total = 0;
        for (const row of rows as Array<{ balance_usd: number | string | null }>) {
          if (row.balance_usd != null) {
            const v = Number(row.balance_usd);
            if (!Number.isNaN(v)) total += v;
          }
        }
        total = Math.round(total * 100) / 100;
        setWiseTotalUsd(total);
      } catch (err: any) {
        if (!cancelled) {
          setBalanceError(err?.message ?? "Unable to load balance");
          setWiseTotalUsd(null);
        }
      } finally {
        if (!cancelled) {
          setBalanceLoading(false);
        }
      }
    }

    loadBalance();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Fetch full ledger entries for chart range filtering. */
  const fetchChartAndQuarterData = React.useCallback(async () => {
    if (!user) return;
    try {
      const supabase = getSupabaseClient();
      const { data: rows, error } = await supabase
        .from("wise_transactions")
        .select("id, wise_transaction_id, type, amount, currency, merchant_name, wise_created_at, raw, usd_amount")
        .order("wise_created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const list = (Array.isArray(rows) ? rows : []) as WiseTransactionRow[];
      setLedgerEntries(list.map(wiseTransactionToLedgerEntry));
    } catch {
      setLedgerEntries([]);
    }
  }, [user]);

  /** Fetch talent and agent revenue breakdowns from deals tables (current quarter only, by deal created_at). */
  const fetchDealsChartsData = React.useCallback(async () => {
    if (!user) return;
    setDealsChartsLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Current quarter date range (e.g. if now is Feb 2025, current quarter = Q1 2025 Jan 1–today)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentQ = Math.floor(now.getMonth() / 3) + 1;
      const quarterStart = new Date(currentYear, (currentQ - 1) * 3, 1);
      const quarterEnd = new Date(now); // through today
      const quarterStartIso = quarterStart.toISOString();
      const quarterEndIso = quarterEnd.toISOString();

      const [{ data: dealsData }, { data: dealTalentData }] = await Promise.all([
        supabase
          .from("deals")
          .select(
            "id, deal_owner, created_at, users!deals_deal_owner_fkey(id, first_name, last_name), deal_deliverables(quantity, unit_price_cents, billing_type, recurrence_count)"
          )
          .gte("created_at", quarterStartIso)
          .lte("created_at", quarterEndIso),
        supabase
          .from("deal_talent")
          .select("deal_id, talent_id, talent(id, first_name, last_name)"),
      ]);

      const calcDealRevenue = (deliverables: Array<{ quantity: number | string; unit_price_cents: number | string; billing_type: string; recurrence_count: number | null }>) => {
        let total = 0;
        for (const d of deliverables) {
          const base = Number(d.unit_price_cents) * Number(d.quantity);
          total += d.billing_type === "recurring" && d.recurrence_count ? base * d.recurrence_count : base;
        }
        return total;
      };

      const centsToUsd = (cents: number) => Math.round((cents / 100) * 100) / 100;

      const deals = (dealsData || []) as Array<{
        id: string;
        deal_owner: string;
        deal_deliverables?: Array<{
          quantity: number | string;
          unit_price_cents: number | string;
          billing_type: string;
          recurrence_count: number | null;
        }>;
        users?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
      }>;
      const dealRevenueMap = new Map<string, number>();
      const agentMap = new Map<string, { name: string; revenue: number }>();

      for (const deal of deals) {
        const deliverables = Array.isArray(deal.deal_deliverables) ? deal.deal_deliverables : [];
        const dealRev = calcDealRevenue(deliverables);
        dealRevenueMap.set(deal.id as string, dealRev);

        const owner = Array.isArray(deal.users) ? deal.users[0] : deal.users;
        if (!owner) continue;
        const agentId = deal.deal_owner as string;
        const agentName = `${owner.first_name || ""} ${owner.last_name || ""}`.trim() || "Unknown";
        if (!agentMap.has(agentId)) agentMap.set(agentId, { name: agentName, revenue: 0 });
        agentMap.get(agentId)!.revenue += dealRev;
      }

      const talentMap = new Map<string, { name: string; revenue: number }>();
      for (const dt of (dealTalentData || []) as Array<{
        talent_id: string;
        deal_id: string;
        talent?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
      }>) {
        const t = Array.isArray(dt.talent) ? dt.talent[0] : dt.talent;
        if (!t) continue;
        const talentId = dt.talent_id as string;
        const talentName = `${t.first_name || ""} ${t.last_name || ""}`.trim() || "Unknown";
        const dealRev = dealRevenueMap.get(dt.deal_id as string) || 0;
        if (!talentMap.has(talentId)) talentMap.set(talentId, { name: talentName, revenue: 0 });
        talentMap.get(talentId)!.revenue += dealRev;
      }

      const talentList: RevenueBreakdownPoint[] = Array.from(talentMap.entries())
        .map(([id, t]) => ({ id, name: t.name, revenue: centsToUsd(t.revenue) }))
        .sort((a, b) => b.revenue - a.revenue);
      const agentList: RevenueBreakdownPoint[] = Array.from(agentMap.entries())
        .map(([id, a]) => ({ id, name: a.name, revenue: centsToUsd(a.revenue) }))
        .sort((a, b) => b.revenue - a.revenue);

      setFullTalentRevenueData(talentList);
      setFullAgentRevenueData(agentList);
      setDisplayedTalentIds(talentList.slice(0, 5).map((t) => t.id));
      setDisplayedAgentIds(agentList.slice(0, 5).map((a) => a.id));
    } catch {
      setFullTalentRevenueData([]);
      setFullAgentRevenueData([]);
      setDisplayedTalentIds([]);
      setDisplayedAgentIds([]);
    } finally {
      setDealsChartsLoading(false);
    }
  }, [user]);

  // Load chart/quarter data once when user is present
  useEffect(() => {
    if (!user) {
      setLedgerEntries([]);
      return;
    }
    fetchChartAndQuarterData();
  }, [user, fetchChartAndQuarterData]);

  // Load deals breakdown charts once when user is present
  useEffect(() => {
    if (!user) {
      setFullTalentRevenueData([]);
      setFullAgentRevenueData([]);
      setDisplayedTalentIds([]);
      setDisplayedAgentIds([]);
      setDealsChartsLoading(false);
      return;
    }
    fetchDealsChartsData();
  }, [user, fetchDealsChartsData]);

  const last6MonthsEntries = React.useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return ledgerEntries.filter((entry) => {
      const d = new Date(entry.date);
      return !Number.isNaN(d.getTime()) && d >= start;
    });
  }, [ledgerEntries]);

  // Derived: displayed rows for charts (5 slots, with id/name/revenue)
  const talentRevenueData = React.useMemo(() => {
    const full = fullTalentRevenueData;
    return displayedTalentIds.map((id) => {
      const t = full.find((x) => x.id === id);
      return t ? { ...t } : { id, name: "Unknown", revenue: 0 };
    });
  }, [fullTalentRevenueData, displayedTalentIds]);

  const agentRevenueData = React.useMemo(() => {
    const full = fullAgentRevenueData;
    return displayedAgentIds.map((id) => {
      const a = full.find((x) => x.id === id);
      return a ? { ...a } : { id, name: "Unknown", revenue: 0 };
    });
  }, [fullAgentRevenueData, displayedAgentIds]);

  /** Custom Y-axis tick: swap icon on hover, click opens search dialog */
  const renderTalentTick =
    (onSwap: (index: number) => void) => {
      function TalentTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
      const { x = 0, y = 0, payload } = props;
      const value = payload?.value ?? "";
      const display = value.length > 13 ? value.slice(0, 13) + "…" : value;
      const index = talentRevenueData.findIndex((d) => d.name === value);
      if (index < 0) return (<g><title>{value}</title><text x={x} y={y} fill="rgb(64 64 64)" fontSize={11}>{display}</text></g>);
      return (
        <g>
          <foreignObject
            x={Math.max(0, (x ?? 0) - 86)}
            y={(y ?? 0) - 10}
            width={90}
            height={20}
            className="overflow-visible"
          >
            <div
              className="group flex items-center gap-1.5 cursor-pointer w-full h-full rounded px-0.5 hover:bg-neutral-100/20"
              style={{ fontSize: 11, color: "rgb(64 64 64)" }}
              title={value}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSwap(index);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ArrowLeftRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="truncate">{display}</span>
            </div>
          </foreignObject>
        </g>
      );
      }
      return TalentTick;
    };

  const renderAgentTick =
    (onSwap: (index: number) => void) => {
      function AgentTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
      const { x = 0, y = 0, payload } = props;
      const value = payload?.value ?? "";
      const display = value.length > 13 ? value.slice(0, 13) + "…" : value;
      const index = agentRevenueData.findIndex((d) => d.name === value);
      if (index < 0) return (<g><title>{value}</title><text x={x} y={y} fill="rgb(64 64 64)" fontSize={11}>{display}</text></g>);
      return (
        <g>
          <foreignObject
            x={Math.max(0, (x ?? 0) - 86)}
            y={(y ?? 0) - 10}
            width={90}
            height={20}
            className="overflow-visible"
          >
            <div
              className="group flex items-center gap-1.5 cursor-pointer w-full h-full rounded px-0.5 hover:bg-neutral-100/80"
              style={{ fontSize: 11, color: "rgb(64 64 64)" }}
              title={value}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSwap(index);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ArrowLeftRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="truncate">{display}</span>
            </div>
          </foreignObject>
        </g>
      );
      }
      return AgentTick;
    };

  const chartData = React.useMemo(
    () => buildChartDataFromEntries(ledgerEntries, chartRange),
    [ledgerEntries, chartRange]
  );
  const selectedChartRangeLabel = React.useMemo(
    () => CHART_RANGE_OPTIONS.find((option) => option.key === chartRange)?.label ?? "Past 6 months",
    [chartRange]
  );
  const netZeroOffset = React.useMemo(() => {
    if (chartData.length === 0) return 0.5;
    const netValues = chartData.map((point) => point.net);
    const min = Math.min(...netValues, 0);
    const max = Math.max(...netValues, 0);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [chartData]);

  const { quarterLabel, quarterRevenue, quarterExpenses } = React.useMemo(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    const quarterLabel = `Q${q}`;
    const quarterStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
    const startStr = quarterStart.toISOString().slice(0, 10);
    const endStr = quarterEnd.toISOString().slice(0, 10);
    let revenue = 0;
    let expenses = 0;
    for (const e of last6MonthsEntries) {
      const dateStr = e.date.slice(0, 10);
      if (dateStr < startStr || dateStr > endStr) continue;
      const amt = e.usd_amount != null ? Number(e.usd_amount) : Number(e.amount);
      if (amt > 0) revenue += amt;
      else expenses += Math.abs(amt);
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      quarterLabel,
      quarterRevenue: round2(revenue),
      quarterExpenses: round2(expenses),
    };
  }, [last6MonthsEntries]);

  const EXPENSES_PAGE_SIZE = 9;

  const expensesBreakdownFull = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const e of last6MonthsEntries) {
      if (e.sourceType?.toUpperCase() === "CONVERSION") continue;
      const amt = e.usd_amount != null ? Number(e.usd_amount) : Number(e.amount);
      if (amt >= 0) continue;
      const name = e.recipientOrPayer && e.recipientOrPayer !== "—" ? e.recipientOrPayer : "Unknown";
      map.set(name, (map.get(name) ?? 0) + Math.abs(amt));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [last6MonthsEntries]);

  const expensesBreakdown = React.useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(expensesBreakdownFull.length / EXPENSES_PAGE_SIZE));
    const page = Math.min(expensesPage, totalPages - 1);
    const start = page * EXPENSES_PAGE_SIZE;
    return expensesBreakdownFull.slice(start, start + EXPENSES_PAGE_SIZE);
  }, [expensesBreakdownFull, expensesPage]);

  const expensesTotalPages = Math.max(1, Math.ceil(expensesBreakdownFull.length / EXPENSES_PAGE_SIZE));

  const totalExpensesBreakdown = React.useMemo(
    () => expensesBreakdown.reduce((sum, d) => sum + d.value, 0),
    [expensesBreakdown]
  );

  const REVENUE_PAGE_SIZE = 9;

  const revenueBreakdownFull = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const e of last6MonthsEntries) {
      if (e.sourceType?.toUpperCase() === "CONVERSION") continue;
      if (e.sourceType?.toUpperCase() === "MONEY_ADDED") continue;
      const amt = e.usd_amount != null ? Number(e.usd_amount) : Number(e.amount);
      if (amt <= 0) continue;
      const name = e.recipientOrPayer && e.recipientOrPayer !== "—" ? e.recipientOrPayer : "Unknown";
      map.set(name, (map.get(name) ?? 0) + amt);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [last6MonthsEntries]);

  const revenueBreakdown = React.useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(revenueBreakdownFull.length / REVENUE_PAGE_SIZE));
    const page = Math.min(revenueSourcePage, totalPages - 1);
    const start = page * REVENUE_PAGE_SIZE;
    return revenueBreakdownFull.slice(start, start + REVENUE_PAGE_SIZE);
  }, [revenueBreakdownFull, revenueSourcePage]);

  const revenueTotalPages = Math.max(1, Math.ceil(revenueBreakdownFull.length / REVENUE_PAGE_SIZE));

  const totalRevenueBreakdown = React.useMemo(
    () => revenueBreakdown.reduce((sum, d) => sum + d.value, 0),
    [revenueBreakdown]
  );

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 w-full flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-none pl-8 pr-4 md:pr-6">
            {/* Shared Ledger Header */}
            <LedgerHeader />

            {/* Balance hero - Q revenue (left), Balance (center), Q expenses (right) */}
            <div className="pt-6 pb-6 flex flex-row items-stretch justify-center gap-8 md:gap-12">
              <div className="flex flex-1 flex-col items-center justify-center min-w-0">
                <p className="text-2xl md:text-3xl font-black tabular-nums text-neutral-900 tracking-tight">
                  <AnimatedBalance value={quarterRevenue} />
                </p>
                <span className="mt-0.5 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[120px]">
                  <span className="flex-1 min-w-0 border-t-2 border-solid border-[var(--kenoo-lime)]" />
                  <span className="flex-shrink-0">{quarterLabel} Revenue</span>
                  <span className="flex-1 min-w-0 border-t-2 border-solid border-[var(--kenoo-lime)]" />
                </span>
              </div>
              <div className="flex flex-col items-center justify-center flex-shrink-0">
                {balanceError ? (
                  <p className="text-sm text-amber-600">{balanceError}</p>
                ) : !balanceLoading && wiseTotalUsd == null ? (
                  <p className="text-sm text-neutral-500">No balances yet</p>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl md:text-6xl lg:text-7xl font-black text-neutral-900 tracking-tight tabular-nums">
                        <AnimatedBalance value={wiseTotalUsd ?? 0} />
                      </span>
                      <span className="font-light text-neutral-500 uppercase tracking-wider text-sm">
                        USD
                      </span>
                    </div>
                    <span className="mt-1 font-light text-neutral-500 uppercase tracking-wider text-sm">
                      Balance
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col items-center justify-center min-w-0">
                <p className="text-2xl md:text-3xl font-black tabular-nums text-neutral-900 tracking-tight">
                  <AnimatedBalance value={quarterExpenses} />
                </p>
                <span className="mt-0.5 font-light text-neutral-500 uppercase tracking-wider text-xs inline-flex items-center gap-2 w-full max-w-[120px]">
                  <span className="flex-1 min-w-0 border-t-2 border-solid border-[#ff1744]" />
                  <span className="flex-shrink-0">{quarterLabel} Expenses</span>
                  <span className="flex-1 min-w-0 border-t-2 border-solid border-[#ff1744]" />
                </span>
              </div>
            </div>

            {/* Half-year statement chart - no container, almost full width */}
            <div className="pt-10 pb-2 mb-8 w-full pr-2">
              <div className="mb-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="text-xs font-medium text-neutral-500 uppercase tracking-widest inline-flex items-center gap-1.5 hover:text-neutral-700 transition-colors"
                    >
                      <span>{selectedChartRangeLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[170px]">
                    {CHART_RANGE_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.key}
                        onSelect={() => setChartRange(option.key)}
                        className={cn(
                          "cursor-pointer",
                          chartRange === option.key ? "bg-neutral-100 text-neutral-900" : ""
                        )}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Metric tabs styled like view-agent-companies tabs */}
              <div className="flex items-center gap-2 mb-2 -ml-2">
                {(["incomeAndExpenses", "payouts", "net"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChartMetric(key)}
                    className={cn(
                      "relative px-4 py-2 group hover:bg-transparent font-light text-xs uppercase tracking-wider transition-colors",
                      chartMetric === key
                        ? "text-neutral-800"
                        : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    {key === "incomeAndExpenses" ? "Income & expenses" : key === "net" ? "Net" : "Payouts"}
                    <div
                      className={cn(
                        "absolute bottom-0 left-0 h-0.5 bg-neutral-800 transition-all duration-300",
                        chartMetric === key
                          ? "w-4/5 mx-auto right-0"
                          : "w-0 group-hover:w-4/5 group-hover:mx-auto group-hover:right-0"
                      )}
                    />
                  </button>
                ))}
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fillPrimary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--kenoo-lime)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--kenoo-lime)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff1744" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#ff1744" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(148 163 184)" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="rgb(148 163 184)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="strokeNetByZero" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--kenoo-lime)" />
                        <stop offset={`${netZeroOffset * 100}%`} stopColor="var(--kenoo-lime)" />
                        <stop offset={`${netZeroOffset * 100}%`} stopColor="#ff1744" />
                        <stop offset="100%" stopColor="#ff1744" />
                      </linearGradient>
                      <linearGradient id="fillNetByZero" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--kenoo-lime)" stopOpacity={0.25} />
                        <stop offset={`${netZeroOffset * 100}%`} stopColor="var(--kenoo-lime)" stopOpacity={0.25} />
                        <stop offset={`${netZeroOffset * 100}%`} stopColor="#ff1744" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#ff1744" stopOpacity={0.22} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgb(212 212 212)"
                      vertical={true}
                      horizontal={true}
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={{ stroke: "rgb(212 212 212)" }}
                      tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                      tickLine={false}
                      minTickGap={chartRange === "past30Days" ? 28 : undefined}
                    />
                    <YAxis
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                      tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(2)}k` : `$${Number(v).toFixed(2)}`)}
                      domain={["auto", "auto"]}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgb(38 38 38)",
                        border: "1px solid rgb(64 64 64)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "rgb(212 212 216)" }}
                      itemStyle={{ color: "rgb(212 212 216)" }}
                      formatter={(value: number, name: string) => {
                        const label = name === "income" ? "Income" : name === "expenses" ? "Expenses" : name === "net" ? "Net" : name === "payouts" ? "Payouts" : name;
                        return [typeof value === "number" && value >= 1000 ? `$${(value / 1000).toFixed(2)}k` : `$${Number(value).toFixed(2)}`, label];
                      }}
                      labelFormatter={(label) => label}
                    />
                    {chartMetric === "incomeAndExpenses" ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey="income"
                          stroke="var(--kenoo-lime)"
                          strokeWidth={2.5}
                          fill="url(#fillPrimary)"
                          name="Income"
                        />
                        <Area
                          type="monotone"
                          dataKey="expenses"
                          stroke="#ff1744"
                          strokeWidth={2.5}
                          fill="url(#fillExpenses)"
                          name="Expenses"
                        />
                      </>
                    ) : (
                      <>
                        {chartMetric === "net" ? (
                          <Area
                            type="monotone"
                            dataKey="net"
                            stroke="url(#strokeNetByZero)"
                            strokeWidth={2.5}
                            fill="url(#fillNetByZero)"
                            name="Net"
                          />
                        ) : (
                          <Area
                            type="monotone"
                            dataKey="payouts"
                            stroke="#ff1744"
                            strokeWidth={2.5}
                            fill="url(#fillExpenses)"
                            name="Payouts"
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="forecast"
                          stroke="rgb(148 163 184)"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          fill="url(#fillForecast)"
                        />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue Breakdown Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pr-2">
              {/* Talent Revenue */}
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
                  Talent revenue (current quarter)
                </p>
                <div className="h-[340px] w-full">
                  {dealsChartsLoading ? (
                    <div className="h-full w-full bg-neutral-100 rounded-2xl animate-pulse" />
                  ) : talentRevenueData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-neutral-400 text-sm font-light">
                      No talent deal data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={talentRevenueData}
                        layout="vertical"
                        margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="fillTalentBar" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="var(--kenoo-lime)" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="var(--kenoo-lime)" stopOpacity={0.35} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgb(212 212 212)"
                          horizontal={false}
                          vertical={true}
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                          tickFormatter={(v) =>
                            v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          width={92}
                          tick={renderTalentTick((index) => setTalentSwapIndex(index))}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                          contentStyle={{
                            backgroundColor: "rgb(38 38 38)",
                            border: "1px solid rgb(64 64 64)",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "rgb(212 212 216)" }}
                          itemStyle={{ color: "rgb(212 212 216)" }}
                          formatter={(value: number) => [
                            value >= 1000
                              ? `$${(value / 1000).toFixed(2)}k`
                              : `$${Number(value).toFixed(2)}`,
                            "Revenue",
                          ]}
                        />
                        <ReferenceLine
                          x={20000}
                          stroke="#ff1744"
                          strokeOpacity={0.4}
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          label={{ value: "20k target", position: "top", fill: "#ff1744", fontSize: 10 }}
                        />
                        <Bar
                          dataKey="revenue"
                          fill="url(#fillTalentBar)"
                          activeBar={{ fill: "url(#fillTalentBar)", opacity: 0.85 }}
                          radius={[0, 4, 4, 0]}
                          maxBarSize={38}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Agent Revenue */}
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
                  Agent revenue (current quarter)
                </p>
                <div className="h-[340px] w-full">
                  {dealsChartsLoading ? (
                    <div className="h-full w-full bg-neutral-100 rounded-2xl animate-pulse" />
                  ) : agentRevenueData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-neutral-400 text-sm font-light">
                      No agent deal data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={agentRevenueData}
                        layout="vertical"
                        margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="fillAgentBar" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity={0.35} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgb(212 212 212)"
                          horizontal={false}
                          vertical={true}
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                          tickFormatter={(v) =>
                            v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          width={92}
                          tick={renderAgentTick((index) => setAgentSwapIndex(index))}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                          contentStyle={{
                            backgroundColor: "rgb(38 38 38)",
                            border: "1px solid rgb(64 64 64)",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "rgb(212 212 216)" }}
                          itemStyle={{ color: "rgb(212 212 216)" }}
                          formatter={(value: number) => [
                            value >= 1000
                              ? `$${(value / 1000).toFixed(2)}k`
                              : `$${Number(value).toFixed(2)}`,
                            "Revenue",
                          ]}
                        />
                        <ReferenceLine
                          x={200000}
                          stroke="#ff1744"
                          strokeOpacity={0.4}
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          label={{ value: "200k target", position: "top", fill: "#ff1744", fontSize: 10 }}
                        />
                        <Bar
                          dataKey="revenue"
                          fill="url(#fillAgentBar)"
                          activeBar={{ fill: "url(#fillAgentBar)", opacity: 0.85 }}
                          radius={[0, 4, 4, 0]}
                          maxBarSize={38}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Top expenses + Top revenue in same row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pr-2 pb-8">
              {/* Expenses Breakdown — donut chart */}
              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                    Top expenses (last 6 months)
                  </p>
                {expensesBreakdownFull.length > EXPENSES_PAGE_SIZE && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setExpensesPage((p) => Math.max(0, p - 1))}
                      disabled={expensesPage === 0}
                      className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpensesPage((p) => Math.min(expensesTotalPages - 1, p + 1))}
                      disabled={expensesPage >= expensesTotalPages - 1}
                      className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {expensesBreakdown.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-neutral-400 text-sm font-light">
                  No expense data yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-8 items-center">
                  {/* Donut chart */}
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensesBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius="52%"
                          outerRadius="78%"
                          dataKey="value"
                          paddingAngle={2}
                          stroke="none"
                        >
                          {expensesBreakdown.map((_, i) => (
                            <Cell
                              key={i}
                              fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
                            />
                          ))}
                          <Label
                            content={(props) => {
                              const vb = (props as { viewBox?: { cx?: number; cy?: number } }).viewBox;
                              const cx = vb?.cx ?? 0;
                              const cy = vb?.cy ?? 0;
                              const display =
                                totalExpensesBreakdown >= 1000
                                  ? `$${(totalExpensesBreakdown / 1000).toFixed(1)}k`
                                  : `$${totalExpensesBreakdown.toFixed(0)}`;
                              return (
                                <text textAnchor="middle" dominantBaseline="middle">
                                  <tspan
                                    x={cx}
                                    y={cy - 9}
                                    fontSize={22}
                                    fontWeight="900"
                                    fill="rgb(23 23 23)"
                                    fontFamily="inherit"
                                  >
                                    {display}
                                  </tspan>
                                  <tspan
                                    x={cx}
                                    y={cy + 14}
                                    fontSize={11}
                                    fill="rgb(115 115 115)"
                                    fontWeight="300"
                                    letterSpacing="0.08em"
                                    fontFamily="inherit"
                                  >
                                    TOTAL SPENT
                                  </tspan>
                                </text>
                              );
                            }}
                            position="center"
                          />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgb(38 38 38)",
                            border: "1px solid rgb(64 64 64)",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "rgb(212 212 216)" }}
                          itemStyle={{ color: "rgb(212 212 216)" }}
                          formatter={(value: number, _name: string, entry: { payload?: { name?: string } }) => {
                            const label = entry?.payload?.name ?? "";
                            const pct = totalExpensesBreakdown > 0 ? ((value / totalExpensesBreakdown) * 100).toFixed(1) : "0";
                            const formatted =
                              value >= 1000
                                ? `$${(value / 1000).toFixed(2)}k`
                                : `$${Number(value).toFixed(2)}`;
                            return [`${formatted} (${pct}%)`, label];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Ranked breakdown list — accordion + staggered rows like agent-companies table */}
                  <div className="flex flex-col min-h-[200px] overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={expensesPage}
                        className="flex flex-col gap-3 overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                      >
                        {expensesBreakdown.map((item, i) => {
                          const pct =
                            totalExpensesBreakdown > 0
                              ? (item.value / totalExpensesBreakdown) * 100
                              : 0;
                          return (
                            <motion.div
                              key={item.name}
                              className="flex items-center gap-3"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.55,
                                delay: i * 0.08,
                                ease: [0.32, 0.72, 0, 1],
                              }}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{
                                  background: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
                                }}
                              />
                              <span className="text-sm font-light text-neutral-700 flex-1 truncate min-w-0" title={item.name}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Mini bar */}
                                <div className="w-16 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      background: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium tabular-nums text-neutral-900 w-16 text-right">
                                  {item.value >= 1000
                                    ? `$${(item.value / 1000).toFixed(2)}k`
                                    : `$${item.value.toFixed(2)}`}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}
              </div>

              {/* Revenue Breakdown — donut chart */}
              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                    Top revenue (last 6 months)
                  </p>
                {revenueBreakdownFull.length > REVENUE_PAGE_SIZE && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setRevenueSourcePage((p) => Math.max(0, p - 1))}
                      disabled={revenueSourcePage === 0}
                      className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevenueSourcePage((p) => Math.min(revenueTotalPages - 1, p + 1))}
                      disabled={revenueSourcePage >= revenueTotalPages - 1}
                      className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {revenueBreakdown.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-neutral-400 text-sm font-light">
                  No revenue data yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-8 items-center">
                  {/* Donut chart */}
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius="52%"
                          outerRadius="78%"
                          dataKey="value"
                          paddingAngle={2}
                          stroke="none"
                        >
                          {revenueBreakdown.map((_, i) => (
                            <Cell
                              key={i}
                              fill={REVENUE_COLORS[i % REVENUE_COLORS.length]}
                            />
                          ))}
                          <Label
                            content={(props) => {
                              const vb = (props as { viewBox?: { cx?: number; cy?: number } }).viewBox;
                              const cx = vb?.cx ?? 0;
                              const cy = vb?.cy ?? 0;
                              const display =
                                totalRevenueBreakdown >= 1000
                                  ? `$${(totalRevenueBreakdown / 1000).toFixed(1)}k`
                                  : `$${totalRevenueBreakdown.toFixed(0)}`;
                              return (
                                <text textAnchor="middle" dominantBaseline="middle">
                                  <tspan
                                    x={cx}
                                    y={cy - 9}
                                    fontSize={22}
                                    fontWeight="900"
                                    fill="rgb(23 23 23)"
                                    fontFamily="inherit"
                                  >
                                    {display}
                                  </tspan>
                                  <tspan
                                    x={cx}
                                    y={cy + 14}
                                    fontSize={11}
                                    fill="rgb(115 115 115)"
                                    fontWeight="300"
                                    letterSpacing="0.08em"
                                    fontFamily="inherit"
                                  >
                                    TOTAL EARNED
                                  </tspan>
                                </text>
                              );
                            }}
                            position="center"
                          />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgb(38 38 38)",
                            border: "1px solid rgb(64 64 64)",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "rgb(212 212 216)" }}
                          itemStyle={{ color: "rgb(212 212 216)" }}
                          formatter={(value: number, _name: string, entry: { payload?: { name?: string } }) => {
                            const label = entry?.payload?.name ?? "";
                            const pct = totalRevenueBreakdown > 0 ? ((value / totalRevenueBreakdown) * 100).toFixed(1) : "0";
                            const formatted =
                              value >= 1000
                                ? `$${(value / 1000).toFixed(2)}k`
                                : `$${Number(value).toFixed(2)}`;
                            return [`${formatted} (${pct}%)`, label];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Ranked breakdown list */}
                  <div className="flex flex-col min-h-[200px] overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={revenueSourcePage}
                        className="flex flex-col gap-3 overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                      >
                        {revenueBreakdown.map((item, i) => {
                          const pct =
                            totalRevenueBreakdown > 0
                              ? (item.value / totalRevenueBreakdown) * 100
                              : 0;
                          return (
                            <motion.div
                              key={item.name}
                              className="flex items-center gap-3"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.55,
                                delay: i * 0.08,
                                ease: [0.32, 0.72, 0, 1],
                              }}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{
                                  background: REVENUE_COLORS[i % REVENUE_COLORS.length],
                                }}
                              />
                              <span className="text-sm font-light text-neutral-700 flex-1 truncate min-w-0" title={item.name}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Mini bar */}
                                <div className="w-16 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      background: REVENUE_COLORS[i % REVENUE_COLORS.length],
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium tabular-nums text-neutral-900 w-16 text-right">
                                  {item.value >= 1000
                                    ? `$${(item.value / 1000).toFixed(2)}k`
                                    : `$${item.value.toFixed(2)}`}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Talent swap dialog */}
      <Dialog open={talentSwapIndex !== null} onOpenChange={(open) => !open && setTalentSwapIndex(null)}>
        <DialogContent className="max-w-[380px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Select talent</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4">
            <TalentSearch
              value={talentSwapIndex !== null ? displayedTalentIds[talentSwapIndex] ?? "" : ""}
              onSelect={(id) => {
                if (talentSwapIndex !== null) {
                  setDisplayedTalentIds((prev) => {
                    const next = [...prev];
                    next[talentSwapIndex] = id;
                    return next;
                  });
                  setTalentSwapIndex(null);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Agent swap dialog */}
      <Dialog open={agentSwapIndex !== null} onOpenChange={(open) => !open && setAgentSwapIndex(null)}>
        <DialogContent className="max-w-[380px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Select agent</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4">
            <AgentSearch
              value={agentSwapIndex !== null ? displayedAgentIds[agentSwapIndex] ?? "" : ""}
              onSelect={(id) => {
                if (agentSwapIndex !== null) {
                  setDisplayedAgentIds((prev) => {
                    const next = [...prev];
                    next[agentSwapIndex] = id;
                    return next;
                  });
                  setAgentSwapIndex(null);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AgentsLedger(props: AgentsLedgerProps) {
  return <AgentsLedgerContent {...props} />;
}
