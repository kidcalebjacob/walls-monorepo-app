"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Search, User, Users, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/auth";
import { cn } from "@walls/utils";

type AccountRow = {
  id: string;
  created_at: string;
  account_type: "personal" | "organization";
  name: string;
  slug: string | null;
  icon_url: string | null;
  member_count: number;
  app_count: number;
};

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-black tracking-tight text-neutral-900 md:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-light text-neutral-500">
        {description}
      </p>
    </div>
  );
}

export function AdminAccounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "organization" | "personal"
  >("organization");

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("accounts")
          .select("id, created_at, account_type, name, slug, icon_url")
          .order("name", { ascending: true });

        if (typeFilter !== "all") {
          query = query.eq("account_type", typeFilter);
        }

        const { data: accountsData, error: accountsError } = await query;
        if (accountsError) throw accountsError;
        if (!isMounted) return;

        const accountIds = (accountsData ?? []).map((a) => a.id);
        const memberCountByAccount = new Map<string, number>();
        const appCountByAccount = new Map<string, number>();

        if (accountIds.length > 0) {
          const [{ data: members }, { data: access }] = await Promise.all([
            supabase
              .from("account_users")
              .select("account_id")
              .in("account_id", accountIds),
            supabase
              .from("account_app_access")
              .select("account_id")
              .in("account_id", accountIds),
          ]);

          (members ?? []).forEach((m) => {
            if (!m.account_id) return;
            memberCountByAccount.set(
              m.account_id,
              (memberCountByAccount.get(m.account_id) ?? 0) + 1,
            );
          });
          (access ?? []).forEach((row) => {
            if (!row.account_id) return;
            appCountByAccount.set(
              row.account_id,
              (appCountByAccount.get(row.account_id) ?? 0) + 1,
            );
          });
        }

        setAccounts(
          (accountsData ?? []).map((a) => ({
            id: a.id,
            created_at: a.created_at,
            account_type: a.account_type as AccountRow["account_type"],
            name: a.name,
            slug: a.slug,
            icon_url: a.icon_url,
            member_count: memberCountByAccount.get(a.id) ?? 0,
            app_count: appCountByAccount.get(a.id) ?? 0,
          })),
        );
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load accounts");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [typeFilter]);

  const searchLower = search.trim().toLowerCase();
  const filtered =
    searchLower === ""
      ? accounts
      : accounts.filter(
          (a) =>
            a.name.toLowerCase().includes(searchLower) ||
            (a.slug ?? "").toLowerCase().includes(searchLower),
        );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Accounts"
        description="Browse and manage organization accounts, members, and app access."
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm font-light shadow-sm transition-colors placeholder:text-neutral-300 focus:border-kenoo-blue/40 focus:outline-none focus:ring-2 focus:ring-kenoo-blue/10"
            aria-label="Search accounts"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
          {(
            [
              { value: "organization", label: "Organizations" },
              { value: "personal", label: "Personal" },
              { value: "all", label: "All" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === value
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-neutral-100/80"
            />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {!isLoading && !error && accounts.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm">
          <Building2 className="mx-auto h-10 w-10 text-neutral-300" />
          <p className="mt-4 text-sm font-medium text-neutral-700">
            No accounts yet
          </p>
          <p className="mt-1 text-sm font-light text-neutral-400">
            Accounts will appear here once they are created.
          </p>
        </div>
      )}

      {!isLoading &&
        !error &&
        accounts.length > 0 &&
        filtered.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center text-sm font-light text-neutral-500 shadow-sm">
            No accounts match your search.
          </div>
        )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((account, i) => {
            const TypeIcon =
              account.account_type === "organization" ? Building2 : User;
            return (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Link
                  href={`/accounts/${account.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-kenoo-blue/25 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200/60">
                      {account.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.icon_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <TypeIcon className="h-5 w-5 text-neutral-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-neutral-900 group-hover:text-kenoo-blue">
                        {account.name}
                      </p>
                      <p className="truncate text-xs font-light text-neutral-400">
                        {account.slug ?? account.account_type}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                        {account.account_type}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-4 border-t border-neutral-100 pt-4 text-xs font-light text-neutral-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {account.member_count}{" "}
                      {account.member_count === 1 ? "member" : "members"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      {account.app_count}{" "}
                      {account.app_count === 1 ? "app" : "apps"}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
