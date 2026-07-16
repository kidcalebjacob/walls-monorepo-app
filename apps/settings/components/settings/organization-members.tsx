"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { wallsToast } from "@/components/ui/walls-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AccountMemberRecord, AccountRole } from "@/lib/accounts-shared";
import { canManageAccountMembers } from "@/lib/accounts-shared";

const secondaryButtonClass =
  "rounded-full border border-neutral-200/80 bg-white/50 px-5 font-medium tracking-tight text-neutral-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 ease-in-out hover:bg-white/70 hover:border-neutral-300/80 hover:text-neutral-700 active:scale-[0.98]";

const primaryButtonClass =
  "rounded-full border border-neutral-300/80 bg-white/70 px-5 font-medium tracking-tight text-neutral-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 ease-in-out hover:bg-white/90 hover:border-neutral-400/80 active:scale-[0.98]";

function roleMeta(role: AccountRole): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  switch (role) {
    case "owner":
      return {
        label: "Owner",
        dotClass: "bg-kenoo-yellow",
        textClass: "text-neutral-700",
      };
    case "admin":
      return {
        label: "Admin",
        dotClass: "bg-kenoo-sky",
        textClass: "text-neutral-600",
      };
    case "member":
    default:
      return {
        label: "Member",
        dotClass: "bg-neutral-300",
        textClass: "text-neutral-500",
      };
  }
}

function MemberAvatar({
  firstName,
  lastName,
  email,
}: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const initials = `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`
    .trim()
    .toUpperCase();

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-700">
      {initials || email.charAt(0).toUpperCase()}
    </div>
  );
}

function displayName(member: AccountMemberRecord): string {
  const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
  return fullName || member.email;
}

type OrganizationMembersProps = {
  organizationId: string;
  actorRole: AccountRole;
  canEdit: boolean;
};

export function OrganizationMembers({
  organizationId,
  actorRole,
  canEdit,
}: OrganizationMembersProps) {
  const [members, setMembers] = useState<AccountMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AccountRole>("member");
  const [inviting, setInviting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const canManage = canEdit && canManageAccountMembers(actorRole);

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteRole("member");
    setShowInviteForm(false);
  };

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members`,
        { cache: "no-store" },
      );
      if (!response.ok) return;

      const payload = (await response.json()) as {
        members?: AccountMemberRecord[];
      };
      setMembers(payload.members ?? []);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      wallsToast.error("Missing email", "Enter an email to invite");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error("Error", payload.error || "Failed to invite member");
        return;
      }

      const payload = (await response.json()) as {
        members?: AccountMemberRecord[];
        invited?: boolean;
        created?: boolean;
      };
      setMembers(payload.members ?? []);
      resetInviteForm();

      if (payload.invited) {
        wallsToast.success(
          "Invite sent",
          "They will get an email to create their password and join this organization",
        );
      } else if (payload.created) {
        wallsToast.success(
          "Member added",
          "User was created and added to this organization",
        );
      } else {
        wallsToast.success(
          "Member added",
          "Existing user was added to this organization",
        );
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: AccountRole) {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error("Error", payload.error || "Failed to update role");
        return;
      }

      const payload = (await response.json()) as {
        members?: AccountMemberRecord[];
      };
      setMembers(payload.members ?? []);
      wallsToast.success("Role updated", "Member role was updated");
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleRemove(userId: string) {
    setRemovingUserId(userId);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members/${userId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error("Error", payload.error || "Failed to remove member");
        return;
      }

      const payload = (await response.json()) as {
        members?: AccountMemberRecord[];
      };
      setMembers(payload.members ?? []);
      wallsToast.success("Member removed", "User was removed from this organization");
    } finally {
      setRemovingUserId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {canManage ? (
        showInviteForm ? (
          <div className="space-y-4 rounded-2xl border border-dotted border-neutral-300 bg-transparent px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-800">
                Invite user
              </p>
              <button
                type="button"
                onClick={resetInviteForm}
                aria-label="Cancel"
                className={cn(secondaryButtonClass, "p-1.5")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Email</span>
                <p className="text-xs font-light text-neutral-500">
                  We&apos;ll send an invite if they don&apos;t have a WALLS account
                  yet.
                </p>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleInvite();
                    }
                  }}
                  placeholder="user@example.com"
                  className="rounded-xl border border-neutral-200 bg-kenoo-white px-3 py-2.5 font-light text-sm"
                />
              </label>

              <label className="block space-y-2 sm:w-40">
                <span className="text-sm font-medium text-foreground">Role</span>
                <p className="text-xs font-light text-neutral-500">
                  Access level for this org.
                </p>
                <Select
                  value={inviteRole}
                  onValueChange={(value) => setInviteRole(value as AccountRole)}
                >
                  <SelectTrigger className="rounded-full border-neutral-200 bg-kenoo-white font-light shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {actorRole === "owner" ? (
                      <SelectItem value="owner">Owner</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                onClick={resetInviteForm}
                className={cn(secondaryButtonClass, "px-4")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={inviting}
                onClick={() => void handleInvite()}
                className={cn(
                  primaryButtonClass,
                  "inline-flex items-center gap-2",
                )}
              >
                {inviting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Inviting…
                  </>
                ) : (
                  "Send invite"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => setShowInviteForm(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-kenoo-white px-5 font-medium tracking-tight text-neutral-400 transition-all duration-300 ease-in-out hover:border-neutral-300 hover:bg-kenoo-white hover:text-neutral-400 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Invite user
          </Button>
        )
      ) : null}

      {members.length === 0 && !showInviteForm ? (
        <p className="text-sm font-light text-neutral-500">
          No members yet. Invite someone to give them access to this
          organization.
        </p>
      ) : null}

      {members.length > 0 ? (
        <div className="space-y-3">
          {members.map((member) => {
            const meta = roleMeta(member.role);
            const isUpdating = updatingUserId === member.userId;
            const isRemoving = removingUserId === member.userId;
            const canEditMember =
              canManage && (actorRole === "owner" || member.role !== "owner");
            const isOwner = member.role === "owner";

            return (
              <div
                key={member.id}
                className={cn(
                  "group rounded-2xl border border-dotted bg-transparent px-4 py-3.5",
                  isOwner ? "border-neutral-400/70" : "border-neutral-300",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar
                      firstName={member.firstName}
                      lastName={member.lastName}
                      email={member.email}
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {displayName(member)}
                        </p>
                        <span className="text-neutral-300" aria-hidden>
                          ·
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[11px] font-medium tracking-tight",
                            meta.textClass,
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              meta.dotClass,
                            )}
                            aria-hidden
                          />
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-light text-neutral-500">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {canEditMember ? (
                    <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      <Select
                        value={member.role}
                        disabled={isUpdating || isRemoving}
                        onValueChange={(value) =>
                          void handleRoleChange(
                            member.userId,
                            value as AccountRole,
                          )
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            secondaryButtonClass,
                            "h-auto w-auto gap-1.5 px-3 py-1 text-[11px] shadow-none disabled:opacity-50",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {actorRole === "owner" ? (
                            <SelectItem value="owner">Owner</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        disabled={isRemoving || isUpdating}
                        aria-label="Remove member"
                        className={cn(
                          secondaryButtonClass,
                          "p-1.5 text-rose-600 disabled:opacity-50",
                        )}
                        onClick={() => void handleRemove(member.userId)}
                      >
                        {isRemoving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
