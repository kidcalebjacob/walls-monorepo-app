"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, Linkedin, Plus, Search, Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  title: string;
  email: string | null;
  phone_extension: number | null;
  is_admin: boolean;
  linkedin_url: string | null;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type TeamGroupDetail = {
  id: string;
  name: string;
  objective: string | null;
  created_at: string;
  avatar_url: string | null;
  lead_name: string | null;
  members: TeamMember[];
};

interface AdminViewTeamProps {
  group: TeamGroupDetail;
}

function displayName(member: TeamMember) {
  const first = member.first_name?.trim() ?? "";
  const last = member.last_name?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
}

export function AdminViewTeam({ group }: AdminViewTeamProps) {
  const [mounted, setMounted] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    group.avatar_url ?? null,
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return group.members;
    return group.members.filter((m) => {
      const name = displayName(m).toLowerCase();
      const email = (m.email ?? "").toLowerCase();
      const title = (m.title ?? "").toLowerCase();
      const ext =
        m.phone_extension != null ? String(m.phone_extension) : "";
      return (
        name.includes(q) ||
        email.includes(q) ||
        title.includes(q) ||
        ext.includes(q)
      );
    });
  }, [group.members, memberSearch]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setAvatarUrl(group.avatar_url ?? null);
  }, [group.id, group.avatar_url]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be under 5MB.");
      e.target.value = "";
      return;
    }
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("teamGroupId", group.id);
      const uploadRes = await fetch("/api/upload-team-group-avatar", {
        method: "POST",
        body: uploadForm,
      });
      const uploadJson = (await uploadRes.json().catch(() => ({}))) as {
        error?: string;
        downloadUrl?: string;
      };
      if (!uploadRes.ok) {
        throw new Error(uploadJson.error || "Failed to upload image");
      }
      if (!uploadJson.downloadUrl) {
        throw new Error("No image URL returned");
      }
      const supabase = getSupabaseClient();
      const { error: updateErr } = await supabase
        .from("team_groups")
        .update({ avatar_url: uploadJson.downloadUrl })
        .eq("id", group.id);
      if (updateErr) throw updateErr;
      setAvatarUrl(uploadJson.downloadUrl);
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "Failed to update team photo",
      );
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  const headerEl =
    mounted && typeof document !== "undefined"
      ? document.getElementById("admin-header-left")
      : null;

  return (
    <>
      {headerEl &&
        createPortal(
          <div className="flex items-center gap-3">
            <input
              id="team-detail-avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              disabled={uploadingAvatar}
            />
            <label
              htmlFor="team-detail-avatar-upload"
              className={cn(
                "relative group block shrink-0 cursor-pointer rounded-lg",
                uploadingAvatar && "pointer-events-none opacity-60",
              )}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- R2 / CDN URL
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-lg bg-zinc-100 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                  <Users className="h-3.5 w-3.5 text-zinc-300" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {uploadingAvatar ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Plus className="h-4 w-4 text-white" strokeWidth={1.5} />
                )}
              </div>
            </label>
            <div className="flex items-center gap-x-1.5">
              <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Admin</span>
              <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
              <span className="text-sm font-light uppercase tracking-wider text-neutral-800">Teams</span>
              <span className="text-sm font-light text-neutral-400 select-none" aria-hidden>/</span>
              <span className="text-sm font-light uppercase tracking-wider text-neutral-800">{group.name}</span>
            </div>
          </div>,
          headerEl,
        )}

      <div className="space-y-6 pb-10">
        <div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="group hover:bg-transparent"
          >
            <Link
              href="/teams"
              className="inline-flex items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-900"
            >
              <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              <span className="font-light">Back to teams</span>
            </Link>
          </Button>
        </div>

        {avatarError && (
          <p className="text-sm text-red-600">{avatarError}</p>
        )}

        {/* Objective — own section (no card chrome) */}
        <section className="space-y-2">
          <p className="text-xs font-light text-zinc-500">Objective</p>
          <p className="text-sm font-light leading-relaxed text-zinc-900 whitespace-pre-wrap">
            {group.objective?.trim()
              ? group.objective
              : "No objective added yet."}
          </p>
        </section>

        <div className="flex flex-1 items-center gap-4">
          <Button
            variant="ghost"
            className="group relative flex h-10 w-10 flex-shrink-0 items-center justify-center p-0 text-slate-600 shadow-none hover:bg-transparent"
            aria-label="Add team member"
            asChild
          >
            <Link href={`/teams/${group.id}/create-member`}>
              <div className="relative">
                <div
                  className={cn(
                    "relative z-10 rounded-full p-3 transition-all duration-300 ease-in-out",
                    "group-hover:scale-95 group-hover:border group-hover:border-neutral-200 group-hover:bg-gray-50 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
                  )}
                >
                  <Plus className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                </div>
              </div>
            </Link>
          </Button>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members…"
              className={cn(
                "w-full border-0 border-b bg-transparent py-2 pl-6 pr-3 text-sm font-light transition-colors placeholder:text-neutral-300 focus:outline-none focus-visible:outline-none",
                memberSearch.trim()
                  ? "border-b-[var(--kenoo-sky)]"
                  : "border-neutral-200",
                "rounded-none focus:border-b-[var(--kenoo-sky)]",
              )}
              aria-label="Search members"
            />
          </div>
        </div>

        {/* Team members — pill rows (aligned with admin teams list styling) */}
        <section className="space-y-3">
          <p className="text-xs font-light text-zinc-500">Team members</p>
          <div className="flex flex-col gap-3">
            {group.members.length === 0 && (
              <p className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm font-light text-zinc-500">
                No members in this team yet.
              </p>
            )}
            {group.members.length > 0 && filteredMembers.length === 0 && (
              <p className="py-8 text-center text-sm font-light text-zinc-500">
                No members match your search.
              </p>
            )}
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className={cn(
                  "w-full rounded-full border border-transparent bg-transparent p-4 shadow-none",
                  "transition-all duration-300 ease-in-out",
                  "hover:border hover:border-neutral-200 hover:bg-gray-50 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
                )}
              >
                <div
                  className={cn(
                    "grid w-full grid-cols-1 gap-4",
                    "sm:grid-cols-5 sm:items-center sm:gap-x-6 sm:gap-y-0 lg:gap-x-10",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user avatar CDN / storage URL
                      <img
                        src={member.avatar_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                        <Users className="h-5 w-5" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-sm font-light text-zinc-900">
                        {displayName(member)}
                      </p>
                      <p className="text-xs font-light text-zinc-500">Member</p>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5 text-sm font-light">
                    <p className="truncate text-zinc-900">
                      {member.title?.trim() || "—"}
                    </p>
                    <p className="text-xs font-light text-zinc-500">Title</p>
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5 text-sm font-light">
                    <p className="truncate text-zinc-900">{member.email ?? "—"}</p>
                    <p className="text-xs font-light text-zinc-500">Email</p>
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5 text-sm font-light">
                    <p className="tabular-nums text-zinc-900">
                      {member.phone_extension ?? "—"}
                    </p>
                    <p className="text-xs font-light text-zinc-500">Ext.</p>
                  </div>

                  <div className="flex min-h-6 min-w-0 items-center sm:justify-center">
                    {member.linkedin_url ? (
                      <a
                        href={member.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label="LinkedIn profile"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-sm font-light text-zinc-300">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
