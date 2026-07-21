"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CreditCard,
  LayoutGrid,
  User,
  UserPlus,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/auth";
import { useActiveAccount } from "@/components/active-account-context";

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

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06)] ${className ?? "h-48"}`}
    />
  );
}

function memberDisplayName(member: MemberRow): string {
  const user = member.users;
  if (!user) return "Unknown member";
  const full = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return full || user.email;
}

export function AdminDashboard() {
  const { activeAccount, activeAccountId, loading: accountLoading } =
    useActiveAccount();
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
          { data: memberRows, error: membersError },
          { data: accessRows, error: accessError },
        ] = await Promise.all([
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

        if (!isMounted) return;

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

    void load();
    return () => {
      isMounted = false;
    };
  }, [activeAccountId, accountLoading]);

  const activeCount = useMemo(() => members.length, [members]);
  const isLoading = loading || accountLoading;
  const displayName = activeAccount?.name ?? "your account";
  const TypeIcon =
    activeAccount?.accountType === "organization" ? Building2 : User;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16 pt-1">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {activeAccount && (
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_1px_2px_rgba(60,64,67,0.12)]">
                {activeAccount.iconUrl ? (
                  <Image
                    src={activeAccount.iconUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <TypeIcon className="h-4 w-4 text-[#5f6368]" />
                )}
              </div>
            )}
            <div>
              <h1 className="text-xl font-normal text-[#202124] sm:text-2xl">
                {displayName}
              </h1>
              <p className="text-sm text-[#5f6368]">
                Welcome to the Kenoo Admin Console.
              </p>
            </div>
          </div>
        </div>
      </header>

      {!activeAccountId && !accountLoading ? (
        <div className="rounded-2xl border border-[#e8eaed] bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
          <Building2 className="mx-auto h-10 w-10 text-[#dadce0]" />
          <p className="mt-4 text-sm font-medium text-[#202124]">
            No account selected
          </p>
          <p className="mt-1 text-sm text-[#5f6368]">
            Choose an account from the header switcher to view its admin home.
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonBlock className="h-72 lg:col-span-1" />
          <SkeletonBlock className="h-72 lg:col-span-1" />
          <SkeletonBlock className="h-72 lg:col-span-1" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Users card */}
          <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-[#202124]">Users</h2>
                <p className="mt-0.5 text-sm text-[#5f6368]">
                  Add or manage users
                </p>
              </div>
              <Link
                href="/users"
                className="shrink-0 text-sm font-medium text-[#1967d2] hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="mb-5">
              <p className="text-xs text-[#5f6368]">Active</p>
              <p className="mt-1 text-3xl font-normal tabular-nums text-[#202124]">
                {activeCount}
              </p>
            </div>

            <div className="space-y-2.5 border-t border-[#f1f3f4] pt-4">
              <Link
                href="/users?invite=1"
                className="flex items-center gap-2 text-sm text-[#1967d2] hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add a user
              </Link>
              <Link
                href="/users"
                className="block text-sm text-[#1967d2] hover:underline"
              >
                Update a user&apos;s name or email
              </Link>
              <Link
                href="/account"
                className="block text-sm text-[#1967d2] hover:underline"
              >
                Manage account settings
              </Link>
            </div>

            {members.slice(0, 3).length > 0 && (
              <div className="mt-5 space-y-2 border-t border-[#f1f3f4] pt-4">
                {members.slice(0, 3).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#f1f3f4]">
                      {member.users?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.users.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-3.5 w-3.5 text-[#9aa0a6]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[#202124]">
                        {memberDisplayName(member)}
                      </p>
                      <p className="truncate text-xs capitalize text-[#5f6368]">
                        {member.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Billing card */}
          <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-[#202124]">
                  Billing
                </h2>
                <p className="mt-0.5 text-sm text-[#5f6368]">
                  Manage subscriptions and billing
                </p>
              </div>
              <Link
                href="/billing"
                className="shrink-0 text-sm font-medium text-[#1967d2] hover:underline"
              >
                Manage
              </Link>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium text-[#202124]">Kenoo Starter</p>
              <p className="text-[#5f6368]">Flexible Plan</p>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-2xl font-normal text-[#202124]">$0</span>
                <span className="text-[#5f6368]">/ seat / month</span>
              </div>
              <p className="text-[#5f6368]">Licenses × {activeCount || 1}</p>
              <p className="pt-1 text-[#202124]">
                Estimated bill{" "}
                <span className="font-medium">$0</span>
              </p>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-[#f1f3f4] pt-4">
              <Link
                href="/billing"
                className="block text-sm text-[#1967d2] hover:underline"
              >
                View transactions / invoices
              </Link>
              <Link
                href="/billing?section=payment"
                className="flex items-center gap-2 text-sm text-[#1967d2] hover:underline"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Manage payment method
              </Link>
              <Link
                href="/billing"
                className="block text-sm text-[#1967d2] hover:underline"
              >
                Buy or upgrade
              </Link>
            </div>
          </section>

          {/* Apps card */}
          <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-[#202124]">Apps</h2>
                <p className="mt-0.5 text-sm text-[#5f6368]">
                  Apps enabled for this account
                </p>
              </div>
              {activeAccountId && (
                <Link
                  href={`/accounts/${activeAccountId}`}
                  className="shrink-0 text-sm font-medium text-[#1967d2] hover:underline"
                >
                  Manage
                </Link>
              )}
            </div>

            <div className="mb-5">
              <p className="text-xs text-[#5f6368]">Enabled</p>
              <p className="mt-1 text-3xl font-normal tabular-nums text-[#202124]">
                {apps.length}
              </p>
            </div>

            <div className="space-y-2">
              {apps.length > 0 ? (
                apps.slice(0, 4).map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 rounded-xl bg-[#f8f9fa] px-3 py-2"
                  >
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white">
                      {app.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={app.icon_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <LayoutGrid className="h-3.5 w-3.5 text-[#9aa0a6]" />
                      )}
                    </div>
                    <p className="truncate text-sm text-[#202124]">{app.name}</p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-[#5f6368]">
                  No apps enabled yet
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
