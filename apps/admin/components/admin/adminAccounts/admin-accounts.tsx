"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Building2, Search, User } from "lucide-react";
import { getSupabaseClient } from "@/lib/auth";
import { cn } from "@/lib/utils";

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

export function AdminAccounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "organization" | "personal">(
    "organization",
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  return (
    <>
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">
              Admin
            </span>
            <span
              className="text-sm font-light text-neutral-400 select-none"
              aria-hidden
            >
              /
            </span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">
              Accounts
            </span>
          </div>,
          headerEl,
        )}

      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className={cn(
                "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                search.trim()
                  ? "border-b-[var(--kenoo-sky)]"
                  : "border-neutral-200",
                "focus:border-b-[var(--kenoo-sky)]",
              )}
              aria-label="Search accounts"
            />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-0.5">
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
                  "rounded-full px-3 py-1.5 text-xs font-light transition-colors",
                  typeFilter === value
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <section className="max-h-[min(70vh,720px)] overflow-y-auto pr-1 -mr-1">
          {isLoading && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Loading accounts…
            </p>
          )}
          {!isLoading && error && (
            <p className="py-10 text-center text-sm text-red-500">{error}</p>
          )}
          {!isLoading && !error && accounts.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              No accounts yet.
            </p>
          )}
          {!isLoading && !error && accounts.length > 0 && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              No accounts match your search.
            </p>
          )}
          {!isLoading && !error && filtered.length > 0 && (
            <div className="flex w-full flex-col gap-4">
              {filtered.map((account) => {
                const TypeIcon =
                  account.account_type === "organization" ? Building2 : User;
                return (
                  <Link
                    key={account.id}
                    href={`/accounts/${account.id}`}
                    className={cn(
                      "grid w-full grid-cols-1 gap-4 rounded-full border border-transparent bg-transparent p-4 shadow-none",
                      "sm:grid-cols-4 sm:items-center sm:gap-x-6 sm:gap-y-0 lg:gap-x-10",
                      "transition-all duration-300 ease-in-out",
                      "hover:border-neutral-200 hover:bg-gray-50/80",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 sm:col-span-2">
                      <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                        {account.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={account.icon_url}
                            alt=""
                            className="h-10 w-10 object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-zinc-400">
                            <TypeIcon className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {account.name}
                        </p>
                        <p className="truncate text-xs font-light text-zinc-400">
                          {account.slug ?? account.account_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-light text-zinc-500 capitalize">
                      {account.account_type}
                    </div>
                    <div className="flex items-center gap-4 text-sm font-light text-zinc-500">
                      <span>
                        {account.member_count}{" "}
                        {account.member_count === 1 ? "member" : "members"}
                      </span>
                      <span>
                        {account.app_count}{" "}
                        {account.app_count === 1 ? "app" : "apps"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
