"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft,
  LayoutGrid,
  Package,
  Calendar,
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SequenceSwitch } from "@/components/ui/sequence-switch";
import { getSupabaseClient } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type AppDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  url_redirect: string | null;
  subdomain: string | null;
};

interface AdminAppDetailProps {
  app: AppDetail;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
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
  value,
  icon: Icon,
  valueClassName,
}: {
  label: string;
  value: string | null | number;
  icon?: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : String(value);
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <p className={cn("mt-0.5 text-sm break-words", valueClassName ?? "text-zinc-900")}>
          {display}
        </p>
      </div>
    </div>
  );
}

export function AdminAppDetail({ app: initialApp }: AdminAppDetailProps) {
  const [app, setApp] = useState(initialApp);
  const [mounted, setMounted] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  async function setActive(checked: boolean) {
    setError(null);
    setToggling(true);
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase
      .from("apps")
      .update({ is_active: checked, updated_at: new Date().toISOString() })
      .eq("id", app.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setApp((prev) => ({ ...prev, is_active: checked }));
    }
    setToggling(false);
  }

  return (
    <>
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Admin</span>
            <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Apps</span>
            <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">{app.name}</span>
          </div>,
          headerEl
        )}

      <div className="space-y-6 pb-10">
        <div>
          <Button variant="ghost" size="sm" asChild className="group hover:bg-transparent">
            <Link
              href="/apps"
              className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
              <span className="font-light">Back to apps</span>
            </Link>
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* App overview */}
        <Card className="overflow-hidden rounded-2xl border-zinc-200 bg-white shadow-sm">
          <CardHeader className="bg-zinc-50/50 pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                  {app.icon_url ? (
                    <Image
                      src={app.icon_url}
                      alt=""
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <LayoutGrid className="h-8 w-8 text-zinc-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <SequenceSwitch
                      checked={app.is_active}
                      onCheckedChange={setActive}
                      disabled={toggling}
                      aria-label={app.is_active ? "Deactivate app" : "Activate app"}
                    />
                    <CardTitle className="text-xl text-zinc-900">{app.name}</CardTitle>
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">{app.id}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid gap-0 sm:grid-cols-2">
              <div className="p-4 sm:p-6">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <Package className="h-3.5 w-3.5" />
                  Details
                </h3>
                <DetailRow label="Slug" value={app.slug} />
                <DetailRow label="Description" value={app.description} />
                <DetailRow
                  label="Subdomain"
                  value={
                    app.subdomain
                      ? `${app.subdomain}.walls.agency`
                      : null
                  }
                  valueClassName="text-kenoo-sky underline decoration-dotted underline-offset-2"
                />
                <DetailRow
                  label="Redirect path (legacy)"
                  value={app.url_redirect}
                  valueClassName="text-kenoo-sky underline decoration-dotted underline-offset-2"
                />
              </div>
              <div className="p-4 sm:p-6">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <Calendar className="h-3.5 w-3.5" />
                  Timestamps
                </h3>
                <DetailRow
                  label="Created"
                  value={formatDate(app.created_at)}
                />
                <DetailRow
                  label="Updated"
                  value={formatDate(app.updated_at)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
