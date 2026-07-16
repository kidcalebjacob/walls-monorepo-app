"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/auth";
import { Plus, MoreVertical, LayoutGrid, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

type App = {
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

export function AdminApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const { data: appsData, error: appsError } = await supabase
          .from("apps")
          .select(
            "id, slug, name, description, icon_url, is_active, created_at, updated_at, url_redirect, subdomain",
          )
          .order("name", { ascending: true });

        if (!isMounted) return;
        if (appsError) {
          setError(appsError.message);
          setApps([]);
          return;
        }
        setApps((appsData as App[]) ?? []);
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load apps");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  async function setAppActive(appId: string, isActive: boolean) {
    setTogglingId(appId);
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase
      .from("apps")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", appId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, is_active: isActive } : a)),
      );
      setError(null);
    }
    setTogglingId(null);
  }

  const searchLower = search.trim().toLowerCase();
  const filteredApps =
    searchLower === ""
      ? apps
      : apps.filter(
          (app) =>
            app.name.toLowerCase().includes(searchLower) ||
            app.slug.toLowerCase().includes(searchLower) ||
            (app.description ?? "").toLowerCase().includes(searchLower),
        );
  const sortedApps = [...filteredApps].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  return (
    <>
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Admin</span>
            <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Apps</span>
          </div>,
          headerEl
        )}

      <div className="space-y-6 mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps…"
              aria-label="Search apps"
              className={cn(
                "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                search ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                "focus:border-b-[var(--kenoo-sky)]"
              )}
            />
          </div>
          <button
            type="button"
            aria-label="Add app"
            className="group flex items-center justify-center h-10 w-10 shrink-0 rounded-full text-zinc-600 transition-[box-shadow,border-color,background-color] duration-200 hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border hover:border-neutral-200/50"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-square max-w-[200px] rounded-2xl border border-zinc-200 bg-zinc-50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <section className="overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedApps.map((app) => (
                <div
                  key={app.id}
                  className="group relative aspect-square max-w-[200px] w-full rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-[box-shadow,background-color,border-color] duration-200 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:bg-neutral-50 hover:border hover:border-neutral-200/50"
                >
                  <Link
                    href={`/apps/${app.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`View ${app.name}`}
                  />
                  <div className="flex-1 flex flex-col items-center justify-center p-4 min-w-0 relative z-10 pointer-events-none">
                    <div className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden shrink-0 mb-3">
                      {app.icon_url ? (
                        <Image
                          src={app.icon_url}
                          alt=""
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <LayoutGrid className="w-10 h-10 text-zinc-400" />
                      )}
                    </div>
                    <span className="text-[13px] text-black/75 text-center truncate w-full">
                      {app.name}
                    </span>
                  </div>
                  <div
                    className={`absolute top-2 right-2 z-20 pointer-events-auto transition-opacity ${
                      openMenuId === app.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <div
                      ref={openMenuId === app.id ? menuRef : undefined}
                      className="relative"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenMenuId(openMenuId === app.id ? null : app.id);
                        }}
                        aria-label="App actions"
                        aria-expanded={openMenuId === app.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === app.id && (
                        <div
                          className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
                          role="menu"
                        >
                          <Link
                            href={`/apps/${app.id}`}
                            onClick={() => setOpenMenuId(null)}
                            className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                            role="menuitem"
                          >
                            View app
                          </Link>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setAppActive(app.id, !app.is_active);
                              setOpenMenuId(null);
                            }}
                            disabled={togglingId === app.id}
                            className={
                              app.is_active
                                ? "block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                                : "block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
                            }
                          >
                            {app.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sortedApps.length === 0 && !isLoading && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
                <p className="text-zinc-500 text-sm">No apps found.</p>
                <p className="text-zinc-400 text-xs mt-1">
                  Add an app to get started.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
