"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Building2,
  ChevronRight,
  LayoutGrid,
  Settings,
  Shield,
  Sparkles,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getSupabaseClient } from "@/lib/auth";
import { cn } from "@walls/utils";
import { useActiveAccount } from "@/components/active-account-context";

type AccountSnapshot = {
  id: string;
  created_at: string;
  account_type: "personal" | "organization";
  name: string;
  slug: string | null;
  icon_url: string | null;
  website: string | null;
  description: string | null;
};

type MemberRow = {
  id: string;
  created_at: string;
  role: string;
  users: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
};

type AppAccessRow = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
      {children}
    </p>
  );
}

function SkeletonBlock({ h = "h-40" }: { h?: string }) {
  return (
    <div className={cn(h, "animate-pulse rounded-2xl bg-neutral-100/80")} />
  );
}

function AnimatedCount({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 18, mass: 0.6 });
  const formatted = useTransform(spring, (latest) =>
    Math.round(latest).toLocaleString(),
  );
  useEffect(() => {
    mv.set(value);
  }, [mv, value]);
  return <motion.span>{formatted}</motion.span>;
}

function groupByMonth(
  items: { date: string }[],
): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, count]) => ({
      month: new Date(`${key}-15`).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      count,
    }));
}

function memberDisplayName(member: MemberRow): string {
  const user = member.users;
  if (!user) return "Unknown member";
  const full = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return full || user.email;
}

const tooltipStyle = {
  backgroundColor: "rgb(23 23 23)",
  border: "1px solid rgb(64 64 64)",
  borderRadius: "10px",
  fontSize: "12px",
};

export function AdminDashboard() {
  const { activeAccount, activeAccountId, loading: accountLoading } =
    useActiveAccount();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [apps, setApps] = useState<AppAccessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeAccountId || accountLoading) {
      setLoading(accountLoading);
      return;
    }

    let isMounted = true;
    const supabase = getSupabaseClient();
    const accountId = activeAccountId;

    async function load() {
      setLoading(true);
      try {
        const [
          { data: accountRow, error: accountError },
          { data: memberRows, error: membersError },
          { data: accessRows, error: accessError },
        ] = await Promise.all([
          supabase
            .from("accounts")
            .select(
              "id, created_at, account_type, name, slug, icon_url, website, description",
            )
            .eq("id", accountId)
            .maybeSingle(),
          supabase
            .from("account_users")
            .select(
              `id, created_at, role, users ( first_name, last_name, email, avatar_url )`,
            )
            .eq("account_id", accountId)
            .order("created_at", { ascending: false }),
          supabase
            .from("account_app_access")
            .select("app_id, apps(id, slug, name, icon_url)")
            .eq("account_id", accountId),
        ]);

        if (accountError) throw accountError;
        if (!isMounted) return;

        setAccount(
          accountRow
            ? {
                id: accountRow.id,
                created_at: accountRow.created_at,
                account_type: accountRow.account_type as AccountSnapshot["account_type"],
                name: accountRow.name,
                slug: accountRow.slug,
                icon_url: accountRow.icon_url,
                website: accountRow.website,
                description: accountRow.description,
              }
            : null,
        );

        if (!membersError) {
          setMembers(
            (memberRows ?? []).map((row) => {
              const userRaw = row.users;
              const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
              return {
                id: row.id as string,
                created_at: row.created_at as string,
                role: row.role as string,
                users: user ?? null,
              };
            }),
          );
        }

        if (!accessError) {
          setApps(
            (accessRows ?? [])
              .map((row) => {
                const appRaw = row.apps;
                const app = Array.isArray(appRaw) ? appRaw[0] : appRaw;
                if (!app) return null;
                return {
                  id: app.id as string,
                  slug: app.slug as string,
                  name: app.name as string,
                  icon_url: (app.icon_url as string | null) ?? null,
                };
              })
              .filter((app): app is AppAccessRow => app !== null),
          );
        }
      } catch {
        // partial data is fine
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [activeAccountId, accountLoading]);

  const stats = useMemo(() => {
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const newMembersThisMonth = members.filter(
      (m) => new Date(m.created_at) >= thisMonthStart,
    ).length;

    return {
      memberCount: members.length,
      appCount: apps.length,
      newMembersThisMonth,
      membersByMonth: groupByMonth(
        members.map((m) => ({ date: m.created_at })),
      ),
      admins: members.filter((m) =>
        ["owner", "admin"].includes(m.role.toLowerCase()),
      ).length,
    };
  }, [members, apps]);

  const quickLinks = useMemo(
    () => [
      {
        name:
          activeAccount?.accountType === "organization"
            ? "Organization"
            : "Account settings",
        description: "Profile, members, invites, and branding",
        path: "/organizations",
        icon: Settings,
        accent: "var(--kenoo-sky)",
      },
      {
        name: "App access",
        description: "Manage which apps this account can use",
        path: activeAccountId ? `/accounts/${activeAccountId}` : "/",
        icon: LayoutGrid,
        accent: "var(--kenoo-blue)",
      },
    ],
    [activeAccount?.accountType, activeAccountId],
  );

  const heroStats = [
    {
      label: "Members",
      value: stats.memberCount,
      sub:
        stats.newMembersThisMonth > 0
          ? `+${stats.newMembersThisMonth} this month`
          : "in this account",
      icon: Users,
      accent: "var(--kenoo-blue)",
    },
    {
      label: "Apps enabled",
      value: stats.appCount,
      sub: "active app grants",
      icon: LayoutGrid,
      accent: "var(--kenoo-emerald)",
    },
    {
      label: "Admins",
      value: stats.admins,
      sub: "owners & admins",
      icon: Shield,
      accent: "var(--kenoo-orange)",
    },
    {
      label: "Your role",
      value: null as number | null,
      valueLabel: activeAccount?.role ?? "—",
      sub: activeAccount?.accountType ?? "account",
      icon: User,
      accent: "var(--kenoo-sky)",
    },
  ];

  const isLoading = loading || accountLoading;
  const displayName = account?.name ?? activeAccount?.name ?? "your account";
  const TypeIcon =
    (account?.account_type ?? activeAccount?.accountType) === "organization"
      ? Building2
      : User;

  return (
    <div className="admin-dashboard mx-auto max-w-6xl space-y-10 pb-16 pt-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-gradient-to-br from-white via-white to-neutral-50 p-8 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.08)] md:p-10"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "var(--kenoo-sky)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--kenoo-blue)" }}
        />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-medium text-neutral-600 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-kenoo-blue" />
              {activeAccount?.accountType === "organization"
                ? "Organization admin"
                : "Account admin"}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-900 md:text-4xl">
              <span className="text-kenoo-blue">{displayName}</span>
            </h1>
            <p className="max-w-xl text-sm font-light leading-relaxed text-neutral-500">
              Overview for the account selected in the header — members, app
              access, and settings for this workspace only.
            </p>
          </div>

          {activeAccount && (
            <Link
              href="/organizations"
              className="group inline-flex shrink-0 items-center gap-3 rounded-2xl border border-neutral-200 bg-white/90 px-4 py-3 shadow-sm transition-all hover:border-kenoo-blue/30 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                {activeAccount.iconUrl ? (
                  <Image
                    src={activeAccount.iconUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <TypeIcon className="h-5 w-5 text-neutral-500" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {activeAccount.name}
                </p>
                <p className="text-xs capitalize text-neutral-400">
                  {activeAccount.role} · {activeAccount.accountType}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-kenoo-blue" />
            </Link>
          )}
        </div>
      </motion.div>

      {!activeAccountId && !accountLoading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm">
          <Building2 className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-4 text-sm font-medium text-neutral-700">
            No account selected
          </p>
          <p className="mt-1 text-sm font-light text-neutral-400">
            Choose an account from the header switcher to view its admin
            dashboard.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} h="h-28" />
            ))}
          </div>
          <SkeletonBlock h="h-[240px]" />
          <div className="grid gap-6 lg:grid-cols-2">
            <SkeletonBlock h="h-64" />
            <SkeletonBlock h="h-64" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {heroStats.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1 opacity-80"
                    style={{ background: s.accent }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {s.value !== null ? (
                        <p className="text-3xl font-black tabular-nums tracking-tight text-neutral-900">
                          <AnimatedCount value={s.value} />
                        </p>
                      ) : (
                        <p className="text-2xl font-black capitalize tracking-tight text-neutral-900">
                          {s.valueLabel}
                        </p>
                      )}
                      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
                        {s.label}
                      </p>
                      <p className="mt-2 text-xs font-light capitalize text-neutral-400">
                        {s.sub}
                      </p>
                    </div>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${s.accent}18`, color: s.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {stats.membersByMonth.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm lg:col-span-3"
              >
                <SectionLabel>Member growth</SectionLabel>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.membersByMonth}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="memberGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--kenoo-blue)"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--kenoo-blue)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgb(229 229 229)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
                        allowDecimals={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "rgb(212 212 216)" }}
                        itemStyle={{ color: "rgb(212 212 216)" }}
                        formatter={(value: number) => [value, "New members"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--kenoo-blue)"
                        strokeWidth={2.5}
                        fill="url(#memberGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                "rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm",
                stats.membersByMonth.length > 1
                  ? "lg:col-span-2"
                  : "lg:col-span-5",
              )}
            >
              <SectionLabel>Enabled apps</SectionLabel>
              <div className="mt-2 space-y-2">
                {apps.length > 0 ? (
                  apps.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 px-3 py-2.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200/60">
                        {app.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={app.icon_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <LayoutGrid className="h-3.5 w-3.5 text-neutral-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-800">
                          {app.name}
                        </p>
                        <p className="truncate text-xs text-neutral-400">
                          {app.slug}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm font-light text-neutral-400">
                    No apps enabled yet
                  </p>
                )}
                {activeAccountId && (
                  <Link
                    href={`/accounts/${activeAccountId}`}
                    className="mt-2 block text-center text-xs font-medium text-kenoo-blue hover:underline"
                  >
                    Manage app access
                  </Link>
                )}
              </div>
            </motion.div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3 lg:col-span-2"
            >
              <SectionLabel>Quick access</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.path}
                      className="group flex items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
                    >
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                        style={{
                          background: `${item.accent}15`,
                          color: item.accent,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-sm font-light text-neutral-500">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-600" />
                    </Link>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl border border-neutral-200/80 bg-gradient-to-b from-neutral-900 to-neutral-800 p-6 text-white shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
                <Activity className="h-3.5 w-3.5" />
                Account snapshot
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-light text-neutral-300">
                    Type
                  </span>
                  <span className="text-sm font-semibold capitalize">
                    {account?.account_type ?? activeAccount?.accountType}
                  </span>
                </div>
                {account?.slug && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-light text-neutral-300">
                      Slug
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {account.slug}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-light text-neutral-300">
                    Admin access
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <UserPlus className="h-4 w-4 shrink-0 text-kenoo-sky" />
                  <p className="text-xs font-light leading-relaxed text-neutral-400">
                    Switch accounts from the header to manage a different
                    organization.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {members.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <SectionLabel>Members</SectionLabel>
                <Link
                  href="/organizations"
                  className="text-xs font-medium text-kenoo-blue hover:underline"
                >
                  Manage members
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {members.slice(0, 6).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100">
                      {member.users?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.users.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-neutral-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {memberDisplayName(member)}
                      </p>
                      <p className="truncate text-xs font-light text-neutral-400">
                        {member.users?.email} · {member.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
