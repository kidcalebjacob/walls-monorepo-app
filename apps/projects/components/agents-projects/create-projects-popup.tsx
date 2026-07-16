"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@walls/auth";
import { useAuth } from "@walls/auth";
import { Plus, Save, Trash2, X } from "lucide-react";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { format, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Project,
  ProjectStatus,
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_OPTIONS,
  PRIORITY_CONFIG,
} from "./types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SimpleMarkdownEditor } from "@/components/agents-projects/simple-markdown-editor";
import {
  UserSearch,
  UserSearchUser,
  mapDbUserToUserSearchUser,
} from "@/components/ui/searches/userSearch/user-search";
import { useActiveAccount } from "@/components/active-account-context";
import {
  notifyProjectMembersAdded,
  resolveActorDisplayName,
} from "@/lib/user-notifications";

/* ─── Form config ────────────────────────────────────────────────────────── */
const popupButtonOuterClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";
const popupButtonInnerClass =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-kenoo-white group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";
const fieldLabelClass =
  "text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500";
const fieldValueClass = "truncate text-[15px] font-light text-neutral-900";
const fieldPlaceholderClass = "text-neutral-300";

const PRESET_COLORS = [
  "#ceff00", "#a3e635", "#84cc16", "#65a30d", "#22c55e", "#10b981", "#059669", "#0d9488", "#06b6d4", "#0891b2",
  "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#ef4444", "#dc2626",
  "#b91c1c", "#f97316", "#f59e0b", "#eab308", "#ca8a04", "#84cc16", "#65a30d", "#4ade80", "#2dd4bf", "#22d3ee",
  "#38bdf8", "#818cf8", "#c084fc", "#e879f9", "#f472b6", "#fb7185", "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#34d399", "#5eead4", "#67e8f9", "#93c5fd", "#a5b4fc", "#c4b5fd", "#d8b4fe", "#f0abfc", "#f9a8d4", "#fda4af",
  "#fca5a5", "#fdba74", "#fde047", "#bef264", "#86efac", "#6ee7b7", "#a5f3fc", "#bae6fd", "#c7d2fe", "#ddd6fe",
  "#e9d5ff", "#f5d0fe", "#fbcfe8", "#fecdd3", "#fecaca", "#fed7aa", "#fef08a", "#d9f99d", "#bbf7d0", "#99f6e4",
  "#cffafe", "#e0e7ff", "#ede9fe", "#f3e8ff", "#fae8ff", "#fce7f3", "#ffe4e6", "#fff1f2", "#ffedd5", "#fef9c3",
  "#ecfccb", "#ccfbf1", "#e0f2fe", "#eef2ff", "#f5f3ff", "#faf5ff", "#fdf2f8", "#fdf4ff", "#f5f5f4", "#78716c",
  "#57534e", "#44403c", "#292524", "#1c1917",
];

interface ProjectFormState {
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  due_date: string;
  priority: string;
  color: string;
}

const EMPTY_FORM: ProjectFormState = {
  name: "",
  description: "",
  status: "planning",
  start_date: "",
  due_date: "",
  priority: "3",
  color: "#ceff00",
};

/** Ensures the project owner is always included in the member list. */
function withOwnerAsMember(memberIds: string[], ownerId: string | null | undefined): string[] {
  if (!ownerId) return memberIds;
  if (memberIds.includes(ownerId)) return memberIds;
  return [ownerId, ...memberIds];
}

/** Clean project name into a URL-safe slug (lowercase, spaces → hyphens, strip non-alphanumeric). */
function nameToSlug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return s || "project";
}

/* ─── Props ───────────────────────────────────────────────────────────────── */
export interface CreateProjectsPopupProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Project | null;
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export function CreateProjectsPopup({
  open,
  onClose,
  onSaved,
  existing,
}: CreateProjectsPopupProps) {
  const { user: authUser } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [duePopoverOpen, setDuePopoverOpen] = useState(false);
  const [membersPopoverOpen, setMembersPopoverOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [originalMembers, setOriginalMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserSearchUser[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  const projectOwnerId = existing?.owner_id ?? ownerUserId;

  const parseDateValue = (value: string): Date | undefined => {
    if (!value) return undefined;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        description: existing.description ?? "",
        status: existing.status,
        start_date: existing.start_date ?? "",
        due_date: existing.due_date ?? "",
        priority: existing.priority?.toString() ?? "3",
        color: existing.color ?? "#ceff00",
      });
    } else {
      setForm(EMPTY_FORM);
      setSelectedMembers([]);
      setOriginalMembers([]);
    }
    setError(null);
  }, [existing, open]);

  useEffect(() => {
    if (!authUser?.id || !open) {
      setOwnerUserId(null);
      return;
    }
    const resolveOwner = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, avatar_url, email, user_platform(name, code)")
        .eq("id", authUser.id)
        .maybeSingle();
      const id = data?.id ?? null;
      setOwnerUserId(id);
      if (data) {
        setAllUsers((prev) => {
          const map = new Map(prev.map((u) => [u.id, u]));
          map.set(data.id, mapDbUserToUserSearchUser(data));
          return Array.from(map.values());
        });
      }
    };
    resolveOwner();
  }, [authUser?.id, open]);

  useEffect(() => {
    if (!open || !projectOwnerId) return;
    setSelectedMembers((prev) => withOwnerAsMember(prev, projectOwnerId));
  }, [open, projectOwnerId, existing?.id]);

  useEffect(() => {
    if (!existing?.id || !open) return;
    const loadMembers = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: membersData } = await supabase
          .from("project_members")
          .select("user_id")
          .eq("project_id", existing.id);

        if (!membersData) return;
        const ids = withOwnerAsMember(
          membersData.map((m: { user_id: string }) => m.user_id),
          existing.owner_id
        );
        setSelectedMembers(ids);
        setOriginalMembers(ids);

        if (ids.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select(
              "id, first_name, last_name, avatar_url, email, user_platform(name, code)"
            )
            .in("id", ids);
          if (usersData) {
            setAllUsers((prev) => {
              const map = new Map(prev.map((u) => [u.id, u]));
              usersData.forEach((row) => {
                map.set(row.id, mapDbUserToUserSearchUser(row));
              });
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.error("Error loading project members:", err);
      }
    };
    loadMembers();
  }, [existing?.id, open]);

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase
        .from("projects")
        .delete()
        .eq("id", existing.id);
      if (err) throw err;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to delete project.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!existing && !activeAccountId) {
      setError("Select an account before creating a project.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const actorUserId = authUser?.id ?? null;
      const actorName = await resolveActorDisplayName(supabase, actorUserId);
      const projectName = form.name.trim();
      let slug = nameToSlug(projectName);
      let slugCounter = 1;
      const accountIdForSlug = existing?.account_id ?? activeAccountId;

      while (true) {
        let query = supabase
          .from("projects")
          .select("id")
          .eq("slug", slug);
        if (accountIdForSlug) {
          query = query.eq("account_id", accountIdForSlug);
        }
        if (existing) {
          query = query.neq("id", existing.id);
        }
        const { data: existingRow } = await query.maybeSingle();
        if (!existingRow) break;
        slug = `${nameToSlug(form.name.trim())}-${slugCounter}`;
        slugCounter++;
      }

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        priority: form.priority ? parseInt(form.priority, 10) : null,
        color: form.color || null,
        slug,
      };

      if (existing) {
        const { error: err } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", existing.id);
        if (err) throw err;

        // Sync members (owner always stays a member)
        const effectiveMembers = withOwnerAsMember(selectedMembers, existing.owner_id);
        const toAdd = effectiveMembers.filter((id) => !originalMembers.includes(id));
        const toRemove = originalMembers.filter(
          (id) => !effectiveMembers.includes(id) && id !== existing.owner_id
        );
        if (toAdd.length > 0) {
          const { error: addErr } = await supabase.from("project_members").insert(
            toAdd.map((userId) => ({ project_id: existing.id, user_id: userId, role: "member" }))
          );
          if (addErr) throw addErr;
          await notifyProjectMembersAdded(supabase, {
            userIds: toAdd,
            projectId: existing.id,
            projectName,
            actorUserId,
            actorName,
          });
        }
        if (toRemove.length > 0) {
          const { error: removeErr } = await supabase
            .from("project_members")
            .delete()
            .eq("project_id", existing.id)
            .in("user_id", toRemove);
          if (removeErr) throw removeErr;
        }
      } else {
        let newOwnerId: string | null = null;
        if (authUser?.id) {
          const { data: userRow } = await supabase
            .from("users")
            .select("id")
            .eq("id", authUser.id)
            .maybeSingle();
          if (userRow?.id) {
            newOwnerId = userRow.id;
            payload.owner_id = userRow.id;
          }
        }
        payload.account_id = activeAccountId;
        const { data: newProject, error: err } = await supabase
          .from("projects")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;

        const membersToSave = withOwnerAsMember(selectedMembers, newOwnerId);
        if (membersToSave.length > 0 && newProject?.id) {
          const { error: membersErr } = await supabase.from("project_members").insert(
            membersToSave.map((userId) => ({
              project_id: newProject.id,
              user_id: userId,
              role: "member",
            }))
          );
          if (membersErr) throw membersErr;
          await notifyProjectMembersAdded(supabase, {
            userIds: membersToSave,
            projectId: newProject.id,
            projectName,
            actorUserId,
            actorName,
          });
        }
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  const parsedStartDate = form.start_date ? parseISO(form.start_date) : null;
  const startDate = parsedStartDate && isValid(parsedStartDate) ? parsedStartDate : null;
  const parsedDueDate = form.due_date ? parseISO(form.due_date) : null;
  const dueDate = parsedDueDate && isValid(parsedDueDate) ? parsedDueDate : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[900px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader />

        <div className="grid grid-cols-[2fr_1fr] divide-x divide-gray-200 gap-6 py-4">
          {/* Left Column */}
          <div className="space-y-4 pr-6">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Add project name"
              disabled={saving}
              className="border-0 border-b-2 rounded-none bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 px-0 border-b-[var(--kenoo-sky)] focus:border-b-[var(--kenoo-sky)] placeholder:text-neutral-300"
            />

            <SimpleMarkdownEditor
              value={form.description}
              onChange={(text) => setForm((f) => ({ ...f, description: text }))}
              placeholder="Description"
              disabled={saving}
              aiConfig={{ name: form.name, type: "project" }}
              onAIGenerate={(text) => setForm((f) => ({ ...f, description: text }))}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-2 pl-6">
            {/* Status */}
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, status: v as ProjectStatus }))
              }
              disabled={saving}
            >
              <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                <div className="flex items-center gap-2">
                  <span className={fieldLabelClass}>Status:</span>
                  <span className={cn(fieldValueClass, "[&_[data-placeholder]]:text-neutral-300")}>
                    <SelectValue />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PROJECT_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Priority */}
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              disabled={saving}
            >
              <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                <div className="flex items-center gap-2">
                  <span className={fieldLabelClass}>Priority:</span>
                  <span className={cn(fieldValueClass, "[&_[data-placeholder]]:text-neutral-300")}>
                    <SelectValue />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Start date */}
            <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50"
                >
                  <span className={cn("shrink-0", fieldLabelClass)}>Start:</span>
                  <span
                    className={cn(
                      fieldValueClass,
                      !form.start_date && fieldPlaceholderClass
                    )}
                  >
                    {form.start_date ? format(parseDateValue(form.start_date) ?? new Date(), "MMM d, yyyy") : "Select date"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                align="start"
              >
                <MiniCalendar
                  showClearButton
                  selected={parseDateValue(form.start_date)}
                  onSelect={(date) => {
                    setForm((f) => ({
                      ...f,
                      start_date: date ? format(date, "yyyy-MM-dd") : "",
                    }));
                    setStartPopoverOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Due date */}
            <Popover open={duePopoverOpen} onOpenChange={setDuePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50"
                >
                  <span className={cn("shrink-0", fieldLabelClass)}>Due:</span>
                  <span
                    className={cn(
                      fieldValueClass,
                      !form.due_date && fieldPlaceholderClass
                    )}
                  >
                    {form.due_date ? format(parseDateValue(form.due_date) ?? new Date(), "MMM d, yyyy") : "Select date"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 border-0 rounded-3xl shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
                align="start"
              >
                <MiniCalendar
                  showClearButton
                  selected={parseDateValue(form.due_date)}
                  onSelect={(date) => {
                    setForm((f) => ({
                      ...f,
                      due_date: date ? format(date, "yyyy-MM-dd") : "",
                    }));
                    setDuePopoverOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Members */}
            <Popover open={membersPopoverOpen} onOpenChange={setMembersPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="w-full h-10 flex items-center gap-2 rounded-full px-4 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50"
                >
                  <span className={cn("shrink-0", fieldLabelClass)}>Members:</span>
                  {selectedMembers.length > 0 ? (
                    <div className="flex items-center -space-x-1.5">
                      {allUsers
                        .filter((u) => selectedMembers.includes(u.id))
                        .slice(0, 5)
                        .map((u) => (
                          <div
                            key={u.id}
                            className="relative w-5 h-5 rounded-full overflow-hidden border-2 border-white flex-shrink-0"
                          >
                            {u.avatarUrl ? (
                              <Image
                                src={u.avatarUrl}
                                alt={u.displayName}
                                fill
                                className="object-cover"
                                sizes="20px"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <span className="text-[9px] text-gray-600">
                                  {u.displayName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      {selectedMembers.length > 5 && (
                        <div className="relative w-5 h-5 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] text-gray-600">+{selectedMembers.length - 5}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className={cn(fieldValueClass, fieldPlaceholderClass)}>Add members</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                collisionPadding={16}
                className="flex w-[340px] max-h-[min(500px,var(--radix-popover-content-available-height,calc(100dvh-2rem)))] flex-col overflow-hidden p-0 rounded-2xl border border-neutral-200/60 shadow-xl bg-white/80 backdrop-blur-xl"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <UserSearch
                  className="min-h-0 flex-1"
                  accountId={existing?.account_id ?? activeAccountId}
                  values={selectedMembers}
                  onToggle={(userId) => {
                    if (userId === projectOwnerId) return;
                    setSelectedMembers((prev) =>
                      prev.includes(userId)
                        ? prev.filter((id) => id !== userId)
                        : [...prev, userId]
                    );
                  }}
                  onUsersLoaded={setAllUsers}
                />
              </PopoverContent>
            </Popover>

            {/* Color */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-full px-4 py-2 hover:bg-gray-100 focus:outline-none text-left disabled:opacity-50 w-full"
                >
                  <span className={cn("shrink-0", fieldLabelClass)}>Color:</span>
                  {form.color ? (
                    <span
                      className="w-5 h-5 rounded-full shrink-0 flex-shrink-0"
                      style={{ backgroundColor: form.color }}
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 flex-shrink-0 text-gray-400">
                      <Plus className="h-3 w-3" />
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-3 rounded-2xl border border-neutral-200/60 shadow-xl bg-white/80 backdrop-blur-xl"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-1.5 flex-wrap max-w-[220px]">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: "" }))}
                    title="No color"
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-all shrink-0 flex items-center justify-center text-muted-foreground hover:bg-neutral-100",
                      !form.color
                        ? "border-neutral-900 bg-neutral-100"
                        : "border-neutral-200 bg-neutral-50"
                    )}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 transition-all shrink-0 hover:scale-105",
                        form.color === c
                          ? "border-neutral-900 scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 -mt-2">{error}</p>}

        <DialogFooter>
          <div className="flex items-center justify-end gap-2 w-full">
            {existing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className={popupButtonOuterClass}
              >
                <div className={popupButtonInnerClass}>
                  <Trash2 className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className={popupButtonOuterClass}
            >
              <div className={popupButtonInnerClass}>
                {saving ? (
                  <div className="h-[18px] w-[18px] border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                )}
              </div>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
