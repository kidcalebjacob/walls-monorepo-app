"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AppWindow, Loader2, Plus, Trash2, X } from "lucide-react";

import { wallsToast } from "@/components/ui/walls-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import type { AppAccessRecord } from "@/lib/app-access-shared";
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

function AppIcon({ app, size = 20 }: { app: AppAccessRecord; size?: number }) {
  if (app.iconUrl) {
    return (
      <Image
        src={app.iconUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded bg-neutral-200 text-[10px] font-medium text-neutral-600"
      style={{ width: size, height: size }}
    >
      {app.name.slice(0, 1)}
    </span>
  );
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
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<AccountRole>("member");
  const [inviting, setInviting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const [apps, setApps] = useState<AppAccessRecord[]>([]);
  const [organizationAppIds, setOrganizationAppIds] = useState<string[]>([]);
  const [memberAppIds, setMemberAppIds] = useState<Record<string, string[]>>(
    {},
  );
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const [togglingCatalogAppId, setTogglingCatalogAppId] = useState<
    string | null
  >(null);
  const [appAccessMember, setAppAccessMember] =
    useState<AccountMemberRecord | null>(null);
  const [togglingMemberAppId, setTogglingMemberAppId] = useState<string | null>(
    null,
  );

  const canManage = canEdit && canManageAccountMembers(actorRole);

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteRole("member");
    setShowInviteForm(false);
  };

  const loadAppAccess = useCallback(async () => {
    const response = await fetch(
      `/api/organizations/${organizationId}/app-access`,
      { cache: "no-store" },
    );
    if (!response.ok) return;

    const payload = (await response.json()) as {
      apps?: AppAccessRecord[];
      organizationAppIds?: string[];
      memberAppIds?: Record<string, string[]>;
    };
    setApps(payload.apps ?? []);
    setOrganizationAppIds(payload.organizationAppIds ?? []);
    setMemberAppIds(payload.memberAppIds ?? {});
  }, [organizationId]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResponse] = await Promise.all([
        fetch(`/api/organizations/${organizationId}/members`, {
          cache: "no-store",
        }),
        loadAppAccess(),
      ]);
      if (!membersResponse.ok) return;

      const payload = (await membersResponse.json()) as {
        members?: AccountMemberRecord[];
      };
      setMembers(payload.members ?? []);
    } finally {
      setLoading(false);
    }
  }, [organizationId, loadAppAccess]);

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
            ...(inviteFirstName.trim()
              ? { firstName: inviteFirstName.trim() }
              : {}),
            ...(inviteLastName.trim()
              ? { lastName: inviteLastName.trim() }
              : {}),
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
      void loadAppAccess();

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
        `/api/organizations/${organizationId}/members`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
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
        `/api/organizations/${organizationId}/members`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
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
      setMemberAppIds((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      wallsToast.success(
        "Member removed",
        "User was removed from this organization",
      );
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleToggleCatalogApp(appId: string, enabled: boolean) {
    if (!canManage) return;
    setTogglingCatalogAppId(appId);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/app-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId, enabled }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error(
          "Error",
          payload.error || "Failed to update organization apps",
        );
        return;
      }
      const payload = (await response.json()) as {
        organizationAppIds?: string[];
        memberAppIds?: Record<string, string[]>;
      };
      setOrganizationAppIds(payload.organizationAppIds ?? []);
      if (payload.memberAppIds) setMemberAppIds(payload.memberAppIds);
    } finally {
      setTogglingCatalogAppId(null);
    }
  }

  async function handleToggleMemberApp(appId: string, enabled: boolean) {
    if (!appAccessMember) return;
    setTogglingMemberAppId(appId);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/app-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId,
            enabled,
            userId: appAccessMember.userId,
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error("Error", payload.error || "Failed to update app access");
        return;
      }
      const payload = (await response.json()) as {
        memberAppIds?: Record<string, string[]>;
      };
      if (payload.memberAppIds) {
        setMemberAppIds(payload.memberAppIds);
      }
    } finally {
      setTogglingMemberAppId(null);
    }
  }

  const canEditAppAccessFor = (member: AccountMemberRecord) =>
    canManage && (actorRole === "owner" || member.role !== "owner");

  const catalogApps = apps.filter((app) =>
    organizationAppIds.includes(app.id),
  );
  const dialogMemberIds = new Set(
    appAccessMember ? (memberAppIds[appAccessMember.userId] ?? []) : [],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-dotted border-neutral-300 bg-transparent px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-800">
              Organization apps
            </p>
            <p className="mt-0.5 text-xs font-light text-neutral-500">
              Apps available to assign to members of this organization
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              onClick={() => setCatalogExpanded((value) => !value)}
              className={cn(secondaryButtonClass, "px-3 py-1 text-[11px]")}
            >
              {catalogExpanded ? "Done" : "Manage"}
            </Button>
          ) : null}
        </div>

        {!catalogExpanded ? (
          <div className="flex flex-wrap gap-1.5">
            {catalogApps.length > 0 ? (
              catalogApps.map((app) => (
                <span
                  key={app.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/60 px-2 py-0.5 text-[11px] font-medium tracking-tight text-neutral-600"
                >
                  <AppIcon app={app} size={14} />
                  {app.name}
                </span>
              ))
            ) : (
              <p className="text-[11px] font-light text-neutral-400">
                No apps enabled for this organization yet
                {canManage ? " — click Manage to add some" : ""}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {apps.map((app) => {
              const enabled = organizationAppIds.includes(app.id);
              const isToggling = togglingCatalogAppId === app.id;
              return (
                <button
                  key={app.id}
                  type="button"
                  disabled={togglingCatalogAppId !== null}
                  onClick={() => void handleToggleCatalogApp(app.id, !enabled)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50",
                    enabled
                      ? "border-kenoo-yellow/80 bg-kenoo-yellow/5"
                      : "border-neutral-200/60 bg-transparent",
                    "disabled:opacity-60",
                  )}
                >
                  <AppIcon app={app} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {app.name}
                  </span>
                  {isToggling ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
                  ) : (
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                        enabled
                          ? "border-kenoo-yellow bg-kenoo-yellow text-neutral-800"
                          : "border-neutral-200 bg-white text-transparent",
                      )}
                      aria-hidden
                    >
                      {enabled ? "✓" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

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

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">
                  First name
                </span>
                <Input
                  type="text"
                  value={inviteFirstName}
                  onChange={(event) => setInviteFirstName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleInvite();
                    }
                  }}
                  placeholder="Jane"
                  className="rounded-xl border border-neutral-200 bg-kenoo-white px-3 py-2.5 font-light text-sm"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Last name
                </span>
                <Input
                  type="text"
                  value={inviteLastName}
                  onChange={(event) => setInviteLastName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleInvite();
                    }
                  }}
                  placeholder="Doe"
                  className="rounded-xl border border-neutral-200 bg-kenoo-white px-3 py-2.5 font-light text-sm"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">Email</span>
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
            const grantedApps = catalogApps.filter((app) =>
              (memberAppIds[member.userId] ?? []).includes(app.id),
            );

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

                  <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      disabled={isRemoving || isUpdating}
                      aria-label={
                        canEditAppAccessFor(member)
                          ? "Manage app access"
                          : "View app access"
                      }
                      className={cn(
                        secondaryButtonClass,
                        "inline-flex items-center gap-1.5 px-3 py-1 text-[11px] disabled:opacity-50",
                      )}
                      onClick={() => setAppAccessMember(member)}
                    >
                      <AppWindow className="h-3.5 w-3.5" />
                      Apps
                    </button>
                    {canEditMember ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-11">
                  {grantedApps.length > 0 ? (
                    grantedApps.map((app) => (
                      <span
                        key={app.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/60 px-2 py-0.5 text-[11px] font-medium tracking-tight text-neutral-600"
                      >
                        <AppIcon app={app} size={14} />
                        {app.name}
                      </span>
                    ))
                  ) : (
                    <button
                      type="button"
                      className="text-[11px] font-light text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline"
                      onClick={() => setAppAccessMember(member)}
                    >
                      {canEditAppAccessFor(member)
                        ? catalogApps.length > 0
                          ? "Assign apps"
                          : "Enable organization apps first"
                        : "No apps assigned"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog
        open={appAccessMember != null}
        onOpenChange={(open) => {
          if (!open) setAppAccessMember(null);
        }}
      >
        <DialogContent
          className="max-h-[85vh] max-w-md overflow-hidden rounded-2xl border-neutral-200 p-0"
          showCloseButton
        >
          {appAccessMember ? (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-neutral-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-foreground">
                  App access
                </h2>
                <p className="mt-1 text-sm font-light text-neutral-500">
                  Apps {displayName(appAccessMember)} can use in this
                  organization
                </p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {catalogApps.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm font-light text-neutral-500">
                    Enable apps for the organization first, then assign them to
                    members.
                  </p>
                ) : (
                  catalogApps.map((app) => {
                    const enabled = dialogMemberIds.has(app.id);
                    const canToggle = canEditAppAccessFor(appAccessMember);
                    const isToggling = togglingMemberAppId === app.id;

                    return (
                      <button
                        key={app.id}
                        type="button"
                        disabled={
                          !canToggle ||
                          isToggling ||
                          togglingMemberAppId !== null
                        }
                        onClick={() => {
                          if (!canToggle) return;
                          void handleToggleMemberApp(app.id, !enabled);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                          enabled
                            ? "border-kenoo-yellow/80 bg-kenoo-yellow/5"
                            : "border-neutral-200/60 bg-transparent",
                          canToggle
                            ? "hover:bg-neutral-50"
                            : "cursor-default",
                          "disabled:opacity-90",
                        )}
                      >
                        <AppIcon app={app} size={36} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {app.name}
                        </span>
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
                        ) : (
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                              enabled
                                ? "border-kenoo-yellow bg-kenoo-yellow text-neutral-800"
                                : "border-neutral-200 bg-white text-transparent",
                            )}
                            aria-hidden
                          >
                            {enabled ? "✓" : ""}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <p className="border-t border-neutral-100 px-6 py-3 text-[11px] font-light text-neutral-400">
                Members only see these apps when this organization is the active
                account in the portal.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
