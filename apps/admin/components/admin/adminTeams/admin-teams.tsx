"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CreateTeamPopup } from "@/components/admin/adminTeams/create-team-popup";
import { cn } from "@/lib/utils";

type TeamGroup = {
  id: string;
  created_at: string;
  name: string;
  objective: string | null;
  lead_team_member_id: string | null;
  avatar_url: string | null;
  lead_name: string | null;
  lead_avatar_url: string | null;
  member_count: number;
  /** Up to four member avatar URLs (ordered like team detail: title), for overlapping stack */
  member_preview_avatars: (string | null)[];
};

function TeamMembersStack({
  count,
  avatars,
}: {
  count: number;
  avatars: (string | null)[];
}) {
  if (count <= 0) {
    return <span className="text-sm font-light text-zinc-400">—</span>;
  }

  const overflow = count > 4 ? count - 4 : 0;
  const stack = avatars.slice(0, 4);

  if (count === 1) {
    const url = stack[0];
    return (
      <div className="relative flex h-6 w-6 shrink-0 overflow-hidden rounded-full bg-zinc-100">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user avatar CDN / storage URL
          <img
            src={url}
            alt=""
            className="h-6 w-6 object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-400">
            <Users className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center -space-x-2">
      {stack.map((url, i) => (
        <div
          key={i}
          className="relative shrink-0 overflow-hidden rounded-full bg-zinc-100"
          style={{ zIndex: 4 - i }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user avatar CDN / storage URL
            <img
              src={url}
              alt=""
              className="h-6 w-6 object-cover"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center text-zinc-400">
              <Users className="h-3 w-3" />
            </span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-700"
          style={{ zIndex: 5 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

export function AdminTeams() {
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const { data: groupsData, error: groupsError } = await supabase
          .from("team_groups")
          .select("id, created_at, name, objective, lead_team_member_id, avatar_url")
          .order("name", { ascending: true });

        if (groupsError) throw groupsError;
        if (!isMounted) return;

        const groupIds = (groupsData ?? []).map((g) => g.id);

        const rowsByGroup = new Map<
          string,
          { team_group_id: string; user_id: string | null; title: string | null }[]
        >();
        if (groupIds.length > 0) {
          const { data: membersData } = await supabase
            .from("team")
            .select("team_group_id, user_id, title")
            .in("team_group_id", groupIds);

          (membersData ?? []).forEach((m) => {
            if (!m.team_group_id) return;
            const list = rowsByGroup.get(m.team_group_id) ?? [];
            list.push({
              team_group_id: m.team_group_id,
              user_id: m.user_id ?? null,
              title: m.title ?? null,
            });
            rowsByGroup.set(m.team_group_id, list);
          });
          rowsByGroup.forEach((list) => {
            list.sort((a, b) =>
              (a.title ?? "").localeCompare(b.title ?? "", undefined, {
                sensitivity: "base",
              }),
            );
          });
        }

        const memberUserIds = Array.from(
          new Set(
            Array.from(rowsByGroup.values())
              .flat()
              .map((r) => r.user_id)
              .filter(Boolean) as string[],
          ),
        );

        const memberAvatarByUserId = new Map<string, string | null>();
        if (memberUserIds.length > 0) {
          const { data: memberUsersData } = await supabase
            .from("users")
            .select("id, avatar_url")
            .in("id", memberUserIds);
          (memberUsersData ?? []).forEach((u) => {
            memberAvatarByUserId.set(u.id, u.avatar_url ?? null);
          });
        }

        const previewAvatarsForGroup = (groupId: string): (string | null)[] => {
          const rows = rowsByGroup.get(groupId) ?? [];
          const preview: (string | null)[] = [];
          for (const row of rows) {
            if (preview.length >= 4) break;
            if (!row.user_id) {
              preview.push(null);
              continue;
            }
            preview.push(memberAvatarByUserId.get(row.user_id) ?? null);
          }
          return preview;
        };

        const leadIds = (groupsData ?? [])
          .map((g) => g.lead_team_member_id)
          .filter(Boolean) as string[];

        const leadNameById = new Map<string, string>();
        const leadAvatarById = new Map<string, string | null>();
        if (leadIds.length > 0) {
          const { data: leadsData } = await supabase
            .from("users")
            .select("id, first_name, last_name, avatar_url")
            .in("id", leadIds);
          (leadsData ?? []).forEach((u) => {
            const name =
              [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
            leadNameById.set(u.id, name);
            leadAvatarById.set(u.id, u.avatar_url ?? null);
          });
        }

        const merged: TeamGroup[] = (groupsData ?? []).map((g) => ({
          id: g.id,
          created_at: g.created_at,
          name: g.name,
          objective: g.objective ?? null,
          lead_team_member_id: g.lead_team_member_id ?? null,
          avatar_url: g.avatar_url ?? null,
          lead_name: g.lead_team_member_id
            ? (leadNameById.get(g.lead_team_member_id) ?? null)
            : null,
          lead_avatar_url: g.lead_team_member_id
            ? (leadAvatarById.get(g.lead_team_member_id) ?? null)
            : null,
          member_count: rowsByGroup.get(g.id)?.length ?? 0,
          member_preview_avatars: previewAvatarsForGroup(g.id),
        }));

        if (isMounted) setGroups(merged);
      } catch (e) {
        if (isMounted)
          setError(e instanceof Error ? e.message : "Failed to load teams");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  function formatDate(iso: string) {
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

  const searchLower = search.trim().toLowerCase();
  const filtered =
    searchLower === ""
      ? groups
      : groups.filter(
          (g) =>
            g.name.toLowerCase().includes(searchLower) ||
            (g.objective ?? "").toLowerCase().includes(searchLower),
        );

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  return (
    <>
      <CreateTeamPopup
        open={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      {headerEl &&
        createPortal(
          <div className="flex items-center gap-x-1.5">
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Admin</span>
            <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
            <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Teams</span>
          </div>,
          headerEl,
        )}

      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-1">
          <Button
            type="button"
            variant="ghost"
            className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
            onClick={() => setCreateTeamOpen(true)}
            aria-label="Create team"
          >
            <div className="relative">
              <div
                className={cn(
                  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
                  "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
                )}
              >
                <Plus className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
              </div>
            </div>
          </Button>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams…"
              className={cn(
                "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                search.trim()
                  ? "border-b-[var(--kenoo-sky)]"
                  : "border-neutral-200",
                "focus:border-b-[var(--kenoo-sky)]",
              )}
              aria-label="Search teams"
            />
          </div>
        </div>

        <section className="max-h-[min(70vh,720px)] overflow-y-auto pr-1 -mr-1">
          {isLoading && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Loading teams…
            </p>
          )}
          {!isLoading && error && (
            <p className="py-10 text-center text-sm text-red-500">{error}</p>
          )}
          {!isLoading && !error && groups.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              No teams yet.
            </p>
          )}
          {!isLoading && !error && groups.length > 0 && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              No teams match your search.
            </p>
          )}
          {!isLoading && !error && filtered.length > 0 && (
            <div className="flex w-full flex-col gap-4">
              {filtered.map((group) => (
                <Link
                  key={group.id}
                  href={`/teams/${group.id}`}
                  className={cn(
                    "grid w-full grid-cols-1 gap-4 rounded-full border border-transparent bg-transparent p-4 shadow-none",
                    "sm:grid-cols-4 sm:items-center sm:gap-x-6 sm:gap-y-0 lg:gap-x-10",
                    "transition-all duration-300 ease-in-out",
                    "hover:bg-gray-50 hover:border hover:border-neutral-200 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kenoo-sky)]/40 focus-visible:ring-offset-2",
                  )}
                >
                  {/* Team name — affinity-style: value on top, label below */}
                  <div className="flex min-w-0 items-center gap-3">
                    {group.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- R2 / arbitrary CDN URL
                      <img
                        src={group.avatar_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-zinc-300">
                        <Users className="h-5 w-5" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-sm font-light text-zinc-900">
                        {group.name}
                      </p>
                      <p className="text-xs font-light text-zinc-500">Team</p>
                    </div>
                  </div>

                  {/* Team lead */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-h-6 items-center gap-2">
                      {group.lead_team_member_id && group.lead_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user avatar CDN / storage URL
                        <img
                          src={group.lead_avatar_url}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                      ) : group.lead_team_member_id ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400">
                          <Users className="h-3 w-3" />
                        </span>
                      ) : null}
                      <p className="text-sm font-light text-zinc-900 truncate">
                        {group.lead_name ?? "—"}
                      </p>
                    </div>
                    <p className="text-xs font-light text-zinc-500">Team lead</p>
                  </div>

                  {/* Members — overlapping avatars (same pattern as deals contacts column) */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-h-6 items-center">
                      <TeamMembersStack
                        count={group.member_count}
                        avatars={group.member_preview_avatars}
                      />
                    </div>
                    <p className="text-xs font-light text-zinc-500">Members</p>
                  </div>

                  {/* Created */}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="flex min-h-6 items-center text-sm font-light text-zinc-900 tabular-nums">
                      {formatDate(group.created_at)}
                    </p>
                    <p className="text-xs font-light text-zinc-500">
                      Created at
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
