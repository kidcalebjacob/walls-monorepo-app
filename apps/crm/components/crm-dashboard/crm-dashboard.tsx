"use client";

import { useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Calendar as CalendarIcon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Github,
  Linkedin,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Scan,
  UserRound,
  Users,
} from "lucide-react";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { CalendarEventMarker, DashboardDealCard, FeaturedContact } from "./types";
import { useCrmDashboardData } from "./use-dashboard-data";

/** Frosted glass surface — matches the CRM sidebar rail. */
const GLASS_PANEL =
  "rounded-[2rem] border border-white/60 bg-white/80 shadow-[0_10px_32px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-xl ring-1 ring-black/[0.03]";

const GLASS_INSET =
  "rounded-2xl border border-white/50 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md ring-1 ring-black/[0.02]";

const DEAL_CARD_STYLES = [
  "bg-kenoo-blue/90 text-white backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/20",
  "bg-kenoo-sky/90 text-white backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/20",
  "bg-kenoo-black/90 text-white backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.16)] ring-1 ring-white/15",
  "bg-kenoo-yellow/90 text-kenoo-black backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.1)] ring-1 ring-white/40",
  "bg-white/70 text-neutral-900 backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.04]",
  "bg-neutral-100/80 text-neutral-900 backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.04]",
] as const;

const CAL_DOT_COLORS = [
  "bg-kenoo-blue",
  "bg-kenoo-yellow",
  "bg-kenoo-sky",
  "bg-kenoo-emerald",
] as const;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount).toLocaleString("en-US")}`;
  }
  return formatCurrency(amount);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatLastContacted(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return format(d, "MM/dd/yyyy 'at' h:mm a");
}

function OverlappingAvatars({
  avatars,
  light,
}: {
  avatars: { id: string; name: string; avatarUrl?: string | null }[];
  light?: boolean;
}) {
  if (avatars.length === 0) return null;
  return (
    <div className="flex items-center -space-x-2">
      {avatars.slice(0, 3).map((a) => (
        <Avatar
          key={a.id}
          className={cn(
            "h-7 w-7 border-2",
            light ? "border-white/40" : "border-white",
          )}
        >
          {a.avatarUrl ? (
            <AvatarImage src={a.avatarUrl} alt={a.name} optimizeWidth={28} />
          ) : null}
          <AvatarFallback
            className={cn(
              "text-[9px] font-medium",
              light ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-600",
            )}
          >
            {initials(a.name) || "?"}
          </AvatarFallback>
        </Avatar>
      ))}
      {avatars.length > 3 ? (
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[9px] font-medium",
            light
              ? "border-white/40 bg-white/20 text-white"
              : "border-white bg-neutral-200 text-neutral-600",
          )}
        >
          +{avatars.length - 3}
        </div>
      ) : null}
    </div>
  );
}

function KpiBlock({
  icon: Icon,
  value,
  labelLines,
  badge,
  badgeClassName,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  labelLines: [string, string];
  badge?: string;
  badgeClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/75 shadow-[0_6px_18px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.03] backdrop-blur-md">
        <Icon className="h-[18px] w-[18px] text-neutral-500" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums sm:text-[1.65rem]">
            {value}
          </p>
          {badge ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
                badgeClassName,
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-neutral-400">
          {labelLines[0]}
          <br />
          {labelLines[1]}
        </p>
      </div>
    </div>
  );
}

function InteractionCard({
  deal,
  styleIndex,
}: {
  deal: DashboardDealCard;
  styleIndex: number;
}) {
  const style = DEAL_CARD_STYLES[styleIndex % DEAL_CARD_STYLES.length];
  const isLight = styleIndex % DEAL_CARD_STYLES.length >= 3;
  const dateLabel = deal.createdAt
    ? format(new Date(deal.createdAt), "MMMM d")
    : deal.stage;

  return (
    <Link
      href={`/agents/crm/deals`}
      className={cn(
        "group relative flex min-h-[118px] flex-col justify-between overflow-hidden rounded-[22px] p-4 transition duration-300",
        "hover:scale-[1.015] hover:shadow-[0_12px_28px_rgba(15,23,42,0.14)]",
        style,
      )}
    >
      <div>
        <p
          className={cn(
            "text-[11px] font-medium",
            isLight ? "text-neutral-500" : "text-white/75",
          )}
        >
          {dateLabel}
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
          {deal.dealName}
        </p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-sm font-semibold tabular-nums">
          {deal.amountDisplay || formatCompactAmount(deal.amount)}
        </p>
        <OverlappingAvatars avatars={deal.avatars} light={!isLight} />
      </div>
    </Link>
  );
}

function TasksCalendar({
  events,
  month,
  onMonthChange,
}: {
  events: CalendarEventMarker[];
  month: Date;
  onMonthChange: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventMarker[]>();
    for (const ev of events) {
      const key = format(ev.date, "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tasks Schedule</h3>
          <p className="text-xs text-neutral-500">{format(month, "MMMM yyyy")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onMonthChange(subMonths(month, 1))}
          >
            <span className="sr-only">Previous month</span>
            <ChevronLeft className="h-3.5 w-3.5 text-neutral-500" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <span className="sr-only">Next month</span>
            <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />
          </Button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) || [];
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, new Date());
          const primary = dayEvents[0];
          const accent =
            primary != null
              ? CAL_DOT_COLORS[primary.colorIndex % CAL_DOT_COLORS.length]
              : null;

          return (
            <div
              key={key}
              className={cn(
                "relative flex min-h-[42px] flex-col items-center justify-start rounded-2xl p-1 transition",
                !inMonth && "opacity-30",
                accent && inMonth && `${accent} text-white`,
                !accent && isToday && "ring-1 ring-kenoo-sky/50",
                !accent && "hover:bg-white/60 hover:backdrop-blur-sm",
              )}
              title={dayEvents.map((e) => e.label).join(", ") || undefined}
            >
              <span
                className={cn(
                  "text-[11px] font-medium",
                  accent ? "text-white" : "text-neutral-700",
                )}
              >
                {format(day, "d")}
              </span>
              {primary?.avatarUrl || primary?.avatarName ? (
                <Avatar className="mt-0.5 h-4 w-4 border border-white/50">
                  {primary.avatarUrl ? (
                    <AvatarImage
                      src={primary.avatarUrl}
                      alt={primary.avatarName || ""}
                      optimizeWidth={16}
                    />
                  ) : null}
                  <AvatarFallback className="bg-white/30 text-[6px] text-white">
                    {initials(primary.avatarName || "?")}
                  </AvatarFallback>
                </Avatar>
              ) : dayEvents.length > 0 ? (
                <span
                  className={cn(
                    "mt-1 h-1 w-1 rounded-full",
                    accent ? "bg-white" : "bg-kenoo-blue",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatFunnelAmount(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")}$`;
}

function StageFunnel({
  funnel,
  total,
  weighted,
}: {
  funnel: { id: string; name: string; amount: number; weightedAmount: number; dealCount: number }[];
  total: number;
  weighted: number;
}) {
  const [mode, setMode] = useState<"total" | "weighted">("weighted");
  const displayTotal = mode === "total" ? total : weighted;
  const max = Math.max(
    ...funnel.map((r) => (mode === "total" ? r.amount : r.weightedAmount)),
    1,
  );
  const stageCount = Math.max(funnel.length, 1);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Stage Funnel
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="More"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/70 text-neutral-400 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-sm transition hover:bg-white/90 hover:text-neutral-600"
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <Link
            href="/agents/crm/deals"
            title="Open deals"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/70 text-neutral-400 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-sm transition hover:bg-white/90 hover:text-neutral-600"
          >
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[1.65rem]">
            {formatCurrency(displayTotal)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">Total in Pipeline</p>
        </div>
        <div className="flex shrink-0 rounded-full border border-white/60 bg-white/50 p-1 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm ring-1 ring-black/[0.02]">
          <button
            type="button"
            onClick={() => setMode("weighted")}
            className={cn(
              "rounded-full px-3 py-1.5 transition",
              mode === "weighted"
                ? "bg-white/90 text-neutral-800 shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                : "text-neutral-400 hover:text-neutral-600",
            )}
          >
            Weighted
          </button>
          <button
            type="button"
            onClick={() => setMode("total")}
            className={cn(
              "rounded-full px-3 py-1.5 transition",
              mode === "total"
                ? "bg-white/90 text-neutral-800 shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                : "text-neutral-400 hover:text-neutral-600",
            )}
          >
            Total
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3.5 overflow-hidden pb-1">
        {funnel.length === 0 ? (
          <p className="text-sm text-neutral-400">No active pipeline stages yet.</p>
        ) : (
          funnel.map((row, index) => {
            const value = mode === "total" ? row.amount : row.weightedAmount;
            const relative = value / max;
            const widthPct = Math.max(
              42,
              Math.round(100 - (index / stageCount) * 38 - (1 - relative) * 12),
            );
            const offsetPct = Math.min(
              28,
              Math.round((index / Math.max(stageCount - 1, 1)) * 22 + (1 - relative) * 6),
            );

            return (
              <div
                key={row.id}
                className="flex w-full transition-all duration-500 ease-out"
                style={{
                  width: `${widthPct}%`,
                  marginLeft: `${offsetPct}%`,
                }}
              >
                <div
                  className={cn(
                    "group flex w-full items-center justify-between gap-3 rounded-full",
                    "border border-white/60 bg-white/65 px-5 py-3.5 backdrop-blur-md",
                    "shadow-[0_6px_18px_rgba(15,23,42,0.06)]",
                    "ring-1 ring-black/[0.03]",
                    "transition hover:bg-white/85 hover:shadow-[0_8px_22px_rgba(15,23,42,0.1)]",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-neutral-500">
                      {row.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold tabular-nums tracking-tight text-neutral-900">
                      {formatFunnelAmount(value)}
                      <span className="ml-1.5 text-[10px] font-normal text-neutral-400">
                        · {row.dealCount}
                      </span>
                    </p>
                  </div>
                  <Link
                    href="/agents/crm/deals"
                    title={`View ${row.name} deals`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/80 text-neutral-400 opacity-70 shadow-[0_2px_6px_rgba(15,23,42,0.04)] backdrop-blur-sm transition group-hover:opacity-100 hover:bg-white hover:text-neutral-600"
                  >
                    <Scan className="h-3 w-3" strokeWidth={1.75} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ContactPanel({ contact }: { contact: FeaturedContact | null }) {
  if (!contact) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-8 text-center",
          GLASS_PANEL,
        )}
      >
        <Users className="mb-3 h-8 w-8 text-neutral-300" strokeWidth={1.25} />
        <p className="text-sm font-medium text-neutral-600">No contacts yet</p>
        <p className="mt-1 text-xs text-neutral-400">
          Add people to see their details here.
        </p>
        <Button asChild className="mt-4 rounded-full" size="sm">
          <Link href="/agents/crm/people">Go to People</Link>
        </Button>
      </div>
    );
  }

  const fullName =
    `${contact.firstName} ${contact.lastName}`.trim() || "Unnamed contact";
  const sources = [
    contact.linkedinUrl
      ? { href: contact.linkedinUrl, label: "LinkedIn", icon: Linkedin }
      : null,
    contact.githubUrl
      ? { href: contact.githubUrl, label: "GitHub", icon: Github }
      : null,
    contact.twitterUrl
      ? { href: contact.twitterUrl, label: "X", icon: null }
      : null,
    contact.facebookUrl
      ? { href: contact.facebookUrl, label: "Facebook", icon: null }
      : null,
  ].filter(Boolean) as {
    href: string;
    label: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number }> | null;
  }[];

  const fields = [
    { label: "First Name", value: contact.firstName || "—" },
    { label: "Last Name", value: contact.lastName || "—" },
    { label: "Email", value: contact.email || "—" },
    { label: "Phone Number", value: contact.phone || "—" },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className={cn("p-6 text-center", GLASS_PANEL)}>
        <Avatar className="mx-auto h-24 w-24 border-4 border-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04]">
          {contact.photoUrl ? (
            <AvatarImage src={contact.photoUrl} alt={fullName} optimizeWidth={96} />
          ) : null}
          <AvatarFallback className="bg-white/80 text-xl font-semibold text-neutral-500 backdrop-blur-sm">
            {initials(fullName) || "?"}
          </AvatarFallback>
        </Avatar>
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          {fullName}
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          {[contact.title, contact.company].filter(Boolean).join(", ") || "Contact"}
        </p>

        <div className="mt-5 flex items-center justify-center gap-2">
          {[
            {
              href: `/agents/crm/people`,
              icon: Pencil,
              label: "Edit",
            },
            contact.email
              ? { href: `mailto:${contact.email}`, icon: Mail, label: "Email" }
              : null,
            contact.phone
              ? { href: `tel:${contact.phone}`, icon: Phone, label: "Call" }
              : null,
            {
              href: "/agents/crm/people",
              icon: Plus,
              label: "Add",
            },
            {
              href: "/agents/crm/deals",
              icon: CalendarIcon,
              label: "Schedule",
            },
          ]
            .filter(Boolean)
            .map((action) => {
              const a = action!;
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  title={a.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/70 text-neutral-500 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-sm transition hover:bg-white hover:text-neutral-800"
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
              );
            })}
          <button
            type="button"
            title="More"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/70 text-neutral-500 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-sm transition hover:bg-white"
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className={cn("flex-1 p-5", GLASS_PANEL)}>
        <div className="space-y-4">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-center justify-between gap-3 border-b border-black/[0.04] pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  {field.label}
                </p>
                <p className="mt-0.5 truncate text-sm text-foreground">{field.value}</p>
              </div>
              <Link
                href={`/agents/crm/people`}
                className="shrink-0 rounded-full p-1.5 text-neutral-300 transition hover:bg-white/70 hover:text-neutral-500"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.5} />
              </Link>
            </div>
          ))}

          <div className="border-b border-black/[0.04] pb-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Sources
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {sources.length > 0 ? (
                sources.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      title={s.label}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/70 text-neutral-500 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-sm transition hover:bg-white hover:text-neutral-800"
                    >
                      {Icon ? (
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      ) : (
                        <span className="text-[9px] font-semibold">{s.label[0]}</span>
                      )}
                    </a>
                  );
                })
              ) : contact.source ? (
                <span className="rounded-full border border-white/60 bg-white/60 px-2.5 py-1 text-[11px] text-neutral-600 backdrop-blur-sm">
                  {contact.source}
                </span>
              ) : (
                <span className="text-xs text-neutral-400">No sources linked</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Last Contacted
            </p>
            <p className="mt-0.5 text-sm text-foreground">
              {formatLastContacted(contact.lastContacted)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="app-sidebar-pad mx-auto flex h-full max-w-[1600px] flex-col gap-6 py-6 pr-4 sm:pr-6 lg:pr-8">
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 py-2">
        <Skeleton className="h-14 w-52 rounded-2xl bg-white/50" />
        <Skeleton className="h-14 w-44 rounded-2xl bg-white/50" />
        <Skeleton className="h-14 w-44 rounded-2xl bg-white/50" />
      </div>
      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-[2rem] bg-white/50" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-72 w-full rounded-[2rem] bg-white/50" />
            <Skeleton className="h-72 w-full rounded-[2rem] bg-white/50" />
          </div>
        </div>
        <Skeleton className="h-[520px] w-full rounded-[2rem] bg-white/50" />
      </div>
    </div>
  );
}

export function CrmDashboard() {
  const { data, loading, error } = useCrmDashboardData();
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  if (loading) return <DashboardSkeleton />;

  const { kpis, recentDeals, funnel, calendarEvents, featuredContact } = data;
  const weekDelta =
    kpis.wonWeekDeltaPct != null
      ? `${kpis.wonWeekDeltaPct > 0 ? "+" : ""}${kpis.wonWeekDeltaPct}% week`
      : undefined;

  return (
    <div className="app-sidebar-pad mx-auto flex min-h-full max-w-[1600px] flex-col gap-6 bg-kenoo-white py-6 pr-4 sm:pr-6 lg:pr-8">
      {/* KPIs */}
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 py-1 sm:gap-x-16 lg:gap-x-20">
        <KpiBlock
          icon={BarChart3}
          value={formatCurrency(kpis.wonAmountThisMonth)}
          labelLines={[
            `Won from ${kpis.wonDealsThisMonth} Deal${kpis.wonDealsThisMonth === 1 ? "" : "s"}`,
            "This Month",
          ]}
          badge={weekDelta}
          badgeClassName="bg-kenoo-yellow text-kenoo-black"
        />
        <KpiBlock
          icon={UserRound}
          value={`+${kpis.newContactsThisWeek}`}
          labelLines={["New Contacts", "for Week"]}
          badge={
            kpis.newContactsToday > 0
              ? `+${kpis.newContactsToday} today`
              : undefined
          }
          badgeClassName="bg-kenoo-blue text-white"
        />
        <KpiBlock
          icon={CalendarPlus}
          value={`+${kpis.tasksThisWeek}`}
          labelLines={["New Tasks", "for Week"]}
          badge={
            kpis.tasksToday > 0 ? `+${kpis.tasksToday} today` : undefined
          }
          badgeClassName="bg-white/80 text-neutral-600 ring-1 ring-black/[0.04] backdrop-blur-sm"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Interaction History */}
          <section className={cn("p-5 sm:p-6", GLASS_PANEL)}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Interaction History
              </h2>
              <Link
                href="/agents/crm/deals"
                className="text-xs font-medium text-neutral-500 transition hover:text-neutral-800"
              >
                View all deals
              </Link>
            </div>

            {recentDeals.length === 0 ? (
              <div
                className={cn(
                  "flex min-h-[140px] items-center justify-center border-dashed border-neutral-300/60",
                  GLASS_INSET,
                )}
              >
                <p className="text-sm text-neutral-400">No deals yet</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recentDeals.map((deal, i) => (
                  <InteractionCard key={deal.id} deal={deal} styleIndex={i} />
                ))}
              </div>
            )}
          </section>

          {/* Calendar + Funnel */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className={cn("p-5 sm:p-6", GLASS_PANEL)}>
              <TasksCalendar
                events={calendarEvents}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
              />
            </section>
            <section className={cn("p-5 sm:p-6", GLASS_PANEL)}>
              <StageFunnel
                funnel={funnel}
                total={kpis.pipelineTotal}
                weighted={kpis.pipelineWeighted}
              />
            </section>
          </div>
        </div>

        {/* Contact panel */}
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <ContactPanel contact={featuredContact} />
        </aside>
      </div>
    </div>
  );
}
