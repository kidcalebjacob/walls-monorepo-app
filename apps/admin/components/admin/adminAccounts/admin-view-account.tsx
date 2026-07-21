"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Building2,
  LayoutGrid,
  Mail,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  personal_owner_id: string | null;
  member_count: number;
  app_access?: { id: string; slug: string; name: string; icon_url: string | null }[];
};

interface AdminAccountDetailProps {
  account: AccountDetail;
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

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f1f3f4] py-3 last:border-0">
      <dt className="shrink-0 text-sm text-[#5f6368]">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-[#202124]">{children}</dd>
    </div>
  );
}

export function AdminAccountDetail({ account }: AdminAccountDetailProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  const isOrg = account.account_type === "organization";
  const apps = account.app_access ?? [];

  return (
    <>
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-normal text-[#5f6368]">Admin</span>
            <span className="text-sm text-[#dadce0]" aria-hidden>
              /
            </span>
            <span className="text-sm font-normal text-[#5f6368]">Apps</span>
            <span className="text-sm text-[#dadce0]" aria-hidden>
              /
            </span>
            <span className="truncate text-sm font-medium text-[#202124]">
              {account.name}
            </span>
          </div>,
          headerEl,
        )}

      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <div>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1.5 text-sm text-[#5f6368] transition-colors hover:text-[#202124]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>

        <header className="flex flex-wrap items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0 rounded-full">
            <AvatarImage src={account.icon_url ?? undefined} alt={account.name} />
            <AvatarFallback className="rounded-full bg-[#f1f3f4] text-sm font-medium text-[#5f6368]">
              {account.name.slice(0, 2).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-normal text-[#202124]">
                {account.name}
              </h1>
              <Badge
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  isOrg
                    ? "bg-[#e8f0fe] text-[#1967d2] hover:bg-[#e8f0fe]"
                    : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#f1f3f4]",
                )}
              >
                {isOrg ? "Organization" : "Personal"}
              </Badge>
            </div>
            <p className="text-sm text-[#5f6368]">
              {account.slug ?? account.email ?? "No slug"}
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-5">
          <section className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)] lg:col-span-3">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-[#202124]">Apps</h2>
                <p className="mt-0.5 text-sm text-[#5f6368]">
                  Apps enabled for this account
                </p>
              </div>
              <LayoutGrid className="h-5 w-5 text-[#5f6368]" />
            </div>

            {apps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dadce0] bg-[#f8f9fa] px-4 py-10 text-center">
                <LayoutGrid className="mx-auto h-8 w-8 text-[#dadce0]" />
                <p className="mt-3 text-sm font-medium text-[#202124]">
                  No apps yet
                </p>
                <p className="mt-1 text-sm text-[#5f6368]">
                  App access will show here once it is granted.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#f1f3f4]">
                {apps.map((app) => (
                  <li
                    key={app.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    {app.icon_url ? (
                      <Image
                        src={app.icon_url}
                        alt=""
                        width={36}
                        height={36}
                        className="h-9 w-9 shrink-0 rounded-lg object-contain"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f3f4] text-xs font-medium text-[#5f6368]">
                        {app.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#202124]">
                        {app.name}
                      </p>
                      <p className="truncate text-xs text-[#5f6368]">
                        {app.slug}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
              <div className="mb-4 flex items-center gap-2">
                {isOrg ? (
                  <Building2 className="h-4 w-4 text-[#5f6368]" />
                ) : (
                  <UserIcon className="h-4 w-4 text-[#5f6368]" />
                )}
                <h2 className="text-base font-medium text-[#202124]">
                  Details
                </h2>
              </div>
              <dl>
                <MetaRow label="Type">
                  <span className="capitalize">{account.account_type}</span>
                </MetaRow>
                <MetaRow label="Slug">
                  {account.slug ?? (
                    <span className="text-[#9aa0a6]">—</span>
                  )}
                </MetaRow>
                <MetaRow label="Members">{account.member_count}</MetaRow>
                <MetaRow label="Created">
                  {formatDate(account.created_at)}
                </MetaRow>
                <MetaRow label="ID">
                  <code className="break-all font-mono text-xs text-[#5f6368]">
                    {account.id}
                  </code>
                </MetaRow>
              </dl>
            </section>

            <section className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
              <div className="mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#5f6368]" />
                <h2 className="text-base font-medium text-[#202124]">
                  Contact
                </h2>
              </div>
              <dl>
                <MetaRow label="Email">
                  {account.email ?? (
                    <span className="text-[#9aa0a6]">—</span>
                  )}
                </MetaRow>
                <MetaRow label="Phone">
                  {account.phone ?? (
                    <span className="text-[#9aa0a6]">—</span>
                  )}
                </MetaRow>
                <MetaRow label="Website">
                  {account.website ? (
                    <a
                      href={account.website}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-[#1967d2] hover:underline"
                    >
                      {account.website}
                    </a>
                  ) : (
                    <span className="text-[#9aa0a6]">—</span>
                  )}
                </MetaRow>
                <MetaRow label="About">
                  {account.description ?? (
                    <span className="text-[#9aa0a6]">—</span>
                  )}
                </MetaRow>
              </dl>
              {isOrg ? (
                <Link
                  href="/account"
                  className="mt-4 inline-block text-sm text-[#1967d2] hover:underline"
                >
                  Edit account profile
                </Link>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
