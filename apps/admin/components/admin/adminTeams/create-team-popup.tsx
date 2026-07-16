"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/auth";
import { Plus, Save, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AgentSearch } from "@/components/ui/searches/agent-search";

const popupButtonOuterClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";
const popupButtonInnerClass =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";

export interface CreateTeamPopupProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function CreateTeamPopup({ open, onClose, onSaved }: CreateTeamPopupProps) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadLabel, setLeadLabel] = useState<string | null>(null);
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setObjective("");
    setLeadId(null);
    setLeadLabel(null);
    setError(null);
    setLeadPopoverOpen(false);
    setAvatarFile(null);
    setAvatarPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setError(null);
    setAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    e.target.value = "";
  };

  useEffect(() => {
    if (!leadId) {
      setLeadLabel(null);
      return;
    }
    const fetchName = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("users")
        .select("first_name, last_name, email")
        .eq("id", leadId)
        .maybeSingle();
      if (!data) {
        setLeadLabel(null);
        return;
      }
      const n = `${(data.first_name ?? "").trim()} ${(data.last_name ?? "").trim()}`.trim();
      setLeadLabel(n || data.email || "Lead");
    };
    fetchName();
  }, [leadId]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Team name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data: row, error: insertErr } = await supabase
        .from("team_groups")
        .insert({
          name: trimmed,
          objective: objective.trim() || null,
          lead_team_member_id: leadId,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      if (!row?.id) throw new Error("No team id returned");

      if (avatarFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", avatarFile);
        uploadForm.append("teamGroupId", row.id);
        const uploadRes = await fetch("/api/upload-team-group-avatar", {
          method: "POST",
          body: uploadForm,
        });
        const uploadJson = (await uploadRes.json().catch(() => ({}))) as {
          error?: string;
          downloadUrl?: string;
        };
        if (!uploadRes.ok) {
          throw new Error(uploadJson.error || "Failed to upload team avatar");
        }
        if (uploadJson.downloadUrl) {
          const { error: updateErr } = await supabase
            .from("team_groups")
            .update({ avatar_url: uploadJson.downloadUrl })
            .eq("id", row.id);
          if (updateErr) throw updateErr;
        }
      }

      onSaved();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to create team.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-[720px] [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:focus-visible:ring-0 [&>button]:ring-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader />

        <div className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-[2fr,1fr] sm:divide-x sm:divide-gray-200">
          <div className="space-y-4 sm:pr-6">
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <p className="w-full text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Team avatar
              </p>
              <input
                id="team-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={saving}
              />
              <label
                htmlFor="team-avatar-upload"
                className={cn(
                  "cursor-pointer relative group block",
                  saving && "pointer-events-none opacity-50",
                )}
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob preview
                  <img
                    src={avatarPreview}
                    alt=""
                    className="h-24 w-24 rounded-full object-cover border border-neutral-200/80 shadow-sm"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-neutral-100/90 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center">
                    <Plus className="h-8 w-8 text-neutral-500" strokeWidth={1.5} />
                  </div>
                )}
                {avatarPreview ? (
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <Plus className="h-8 w-8 text-white" strokeWidth={1.5} />
                  </div>
                ) : null}
              </label>
              <p className="text-xs font-light text-neutral-400 text-center sm:text-left">
                Optional · PNG or JPG · max 5MB
              </p>
            </div>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team name"
              disabled={saving}
              className="border-0 border-b-2 rounded-none bg-transparent focus:ring-0 focus-visible:ring-0 px-0 border-b-[var(--kenoo-sky)] focus:border-b-[var(--kenoo-sky)] placeholder:text-neutral-300"
            />
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Objective (optional)"
              disabled={saving}
              rows={8}
              className={cn(
                "min-h-[140px] resize-y rounded-xl border border-neutral-200/80 bg-white/60 px-3 py-2 text-sm",
                "placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-[var(--kenoo-sky)]/40 focus-visible:border-[var(--kenoo-sky)]",
              )}
            />
          </div>

          <div className="space-y-2 sm:pl-6 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Lead
            </p>
            <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="w-full flex items-center gap-2 rounded-full px-4 py-2 hover:bg-gray-100 focus:outline-none text-sm text-left disabled:opacity-50"
                >
                  <User className="h-4 w-4 text-gray-500 shrink-0" />
                  <span
                    className={cn(
                      "flex-1 truncate",
                      leadId && leadLabel ? "text-foreground" : "text-gray-500",
                    )}
                  >
                    {leadId && leadLabel ? leadLabel : "No lead"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[320px] p-0 overflow-hidden rounded-2xl border border-neutral-200/60 shadow-xl bg-white/80 backdrop-blur-xl"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="border-b border-neutral-100 px-3 py-2">
                  <button
                    type="button"
                    className="text-xs text-neutral-500 hover:text-neutral-800 underline-offset-2 hover:underline"
                    onClick={() => {
                      setLeadId(null);
                      setLeadPopoverOpen(false);
                    }}
                  >
                    Clear lead
                  </button>
                </div>
                <AgentSearch
                  value={leadId ?? ""}
                  onSelect={(agentId) => {
                    setLeadId(agentId);
                    setLeadPopoverOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 -mt-2">{error}</p>}

        <DialogFooter>
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
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
