"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Plus,
  User as UserIcon,
} from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AppAccessPopout } from "@/components/admin/adminApps/app-access-popout";
import { getSupabaseClient } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type AccountDetail = {
  id: string;
  created_at: string;
  updated_at: string | null;
  account_type: "personal" | "organization";
  name: string;
  slug: string | null;
  icon_url: string | null;
  website: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  member_count: number;
  app_access?: { id: string; slug: string; name: string; icon_url: string | null }[];
};

interface AdminAccountDetailProps {
  account: AccountDetail;
}

type AppForAccess = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
};

function AppAccessPopoutContent({
  accountId,
  initialAppIds,
  onUpdated,
}: {
  accountId: string;
  initialAppIds: string[];
  onUpdated?: () => void;
}) {
  const [apps, setApps] = useState<AppForAccess[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialAppIds),
  );
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase
      .from("apps")
      .select("id, slug, name, icon_url")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setApps((data ?? []) as AppForAccess[]);
        setLoading(false);
      });
  }, []);

  const toggle = async (appId: string) => {
    const isSelected = selectedIds.has(appId);
    const next = new Set(selectedIds);
    if (isSelected) next.delete(appId);
    else next.add(appId);
    setSelectedIds(next);
    setError(null);
    setTogglingId(appId);
    const supabase = getSupabaseClient();
    try {
      if (isSelected) {
        const { error: deleteErr } = await supabase
          .from("account_app_access")
          .delete()
          .eq("account_id", accountId)
          .eq("app_id", appId);
        if (deleteErr) throw deleteErr;
      } else {
        const { error: insertErr } = await supabase
          .from("account_app_access")
          .insert({ account_id: accountId, app_id: appId });
        if (insertErr) throw insertErr;
      }
      onUpdated?.();
    } catch (e) {
      setSelectedIds((prev) => {
        const revert = new Set(prev);
        if (isSelected) revert.add(appId);
        else revert.delete(appId);
        return revert;
      });
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-neutral-100/80 backdrop-blur-md shadow-inner border border-neutral-200/50 p-6 text-center">
        <p className="text-sm text-zinc-500">Loading apps…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-2">
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => toggle(app.id)}
            disabled={togglingId !== null}
            className={cn(
              "flex w-full items-center gap-4 rounded-xl bg-neutral-100/80 backdrop-blur-md shadow-inner border-2 px-5 py-5 min-h-[72px] text-left transition-colors hover:bg-neutral-100",
              selectedIds.has(app.id)
                ? "border-kenoo-yellow ring-1 ring-kenoo-yellow/30"
                : "border-neutral-200/50",
            )}
          >
            {app.icon_url ? (
              <Image
                src={app.icon_url}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded object-contain"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-zinc-200 text-lg font-medium text-zinc-500">
                {app.name.slice(0, 1)}
              </span>
            )}
            <span className="text-sm font-medium text-zinc-900">{app.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start py-3 border-b border-neutral-200/80 last:border-0">
      <dt className="w-36 flex-shrink-0 text-xs font-medium text-neutral-400 uppercase tracking-wide pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-sm text-neutral-800 font-light">{children}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}

export function AdminAccountDetail({ account }: AdminAccountDetailProps) {
  const [mounted, setMounted] = useState(false);
  const [appAccessPopoutOpen, setAppAccessPopoutOpen] = useState(false);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  const isOrg = account.account_type === "organization";

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
            <span
              className="text-sm font-light text-neutral-400 select-none"
              aria-hidden
            >
              /
            </span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">
              {account.name}
            </span>
          </div>,
          headerEl,
        )}

      <div className="space-y-8 pb-10">
        <div className="pt-3">
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Accounts
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 rounded-full flex-shrink-0 mt-0.5">
              <AvatarImage src={account.icon_url ?? undefined} alt={account.name} />
              <AvatarFallback className="rounded-full bg-neutral-100 text-sm font-semibold text-neutral-500">
                {account.name.slice(0, 2).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
                  {account.name}
                </h1>
                <Badge
                  className={cn(
                    "rounded-none",
                    isOrg
                      ? "bg-kenoo-sky/20 text-zinc-900 hover:bg-kenoo-sky/30"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-100",
                  )}
                >
                  {isOrg ? "Organization" : "Personal"}
                </Badge>
              </div>
              <p className="text-sm text-neutral-400 font-light mt-0.5">
                {account.slug ?? account.email ?? "No slug"}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-10">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            <SectionHeading>
              <span className="inline-flex items-center gap-1.5">
                {isOrg ? (
                  <Building2 className="h-3 w-3" />
                ) : (
                  <UserIcon className="h-3 w-3" />
                )}
                Account
              </span>
            </SectionHeading>
            <div className="rounded-xl bg-gray-50 px-5">
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
                <dl>
                  <DetailRow label="Name">{account.name}</DetailRow>
                  <DetailRow label="Type">
                    <span className="capitalize">{account.account_type}</span>
                  </DetailRow>
                  <DetailRow label="Slug">
                    {account.slug ?? (
                      <span className="text-neutral-300">—</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Members">{account.member_count}</DetailRow>
                </dl>
                <dl>
                  <DetailRow label="App access">
                    <div className="group/appaccess flex flex-wrap items-center gap-2">
                      {!(account.app_access ?? []).length ? (
                        <span className="text-neutral-300">—</span>
                      ) : (
                        (account.app_access ?? []).map((app) => (
                          <span
                            key={app.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700"
                            title={app.name}
                          >
                            {app.icon_url ? (
                              <Image
                                src={app.icon_url}
                                alt=""
                                width={16}
                                height={16}
                                className="h-4 w-4 shrink-0 rounded object-contain"
                              />
                            ) : (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-neutral-200 text-[9px] font-medium text-neutral-500">
                                {app.name.slice(0, 1)}
                              </span>
                            )}
                            <span className="truncate max-w-[120px]">
                              {app.name}
                            </span>
                          </span>
                        ))
                      )}
                      <button
                        type="button"
                        onClick={() => setAppAccessPopoutOpen(true)}
                        aria-label="Manage app access"
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center text-neutral-400 transition-all",
                          "opacity-0 group-hover/appaccess:opacity-100 hover:text-neutral-600",
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </DetailRow>
                  <DetailRow label="Created">
                    {formatDate(account.created_at)}
                  </DetailRow>
                  <DetailRow label="Account ID">
                    <code className="font-mono text-xs text-neutral-600">
                      {account.id}
                    </code>
                  </DetailRow>
                </dl>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SectionHeading>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                Contact
              </span>
            </SectionHeading>
            <div className="rounded-xl bg-gray-50 px-5">
              <dl className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
                <div>
                  <DetailRow label="Email">
                    {account.email ?? (
                      <span className="text-neutral-300">—</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Phone">
                    {account.phone ?? (
                      <span className="text-neutral-300">—</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Website">
                    {account.website ? (
                      <a
                        href={account.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-kenoo-sky underline decoration-dotted underline-offset-2"
                      >
                        {account.website}
                      </a>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </DetailRow>
                </div>
                <div>
                  <DetailRow label="Description">
                    {account.description ?? (
                      <span className="text-neutral-300">—</span>
                    )}
                  </DetailRow>
                </div>
              </dl>
            </div>
          </motion.section>
        </div>
      </div>

      <AppAccessPopout
        open={appAccessPopoutOpen}
        onOpenChange={setAppAccessPopoutOpen}
        title="Account app access"
      >
        <AppAccessPopoutContent
          accountId={account.id}
          initialAppIds={(account.app_access ?? []).map((a) => a.id)}
          onUpdated={() => router.refresh()}
        />
      </AppAccessPopout>
    </>
  );
}
