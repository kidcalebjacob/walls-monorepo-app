"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AppWindow,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { wallsToast } from "@/components/ui/walls-toast";
import { Button } from "@/components/ui/button";
import { ChromeFrame } from "@/components/ui/chrome-frame";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@walls/ui/skeleton";
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

const inviteFieldClass =
  "w-full rounded-none border-0 border-b border-neutral-200 bg-transparent px-0 py-2 text-sm font-light text-neutral-800 shadow-none placeholder:text-neutral-300 focus-visible:border-b-[var(--kenoo-sky)] focus-visible:outline-none focus-visible:ring-0";

function roleMeta(role: AccountRole): {
  label: string;
  dotClass: string;
} {
  switch (role) {
    case "owner":
      return { label: "Owner", dotClass: "bg-kenoo-yellow" };
    case "admin":
      return { label: "Admin", dotClass: "bg-[var(--kenoo-sky)]" };
    case "member":
    default:
      return { label: "Member", dotClass: "bg-neutral-300" };
  }
}

function MemberAvatar({
  firstName,
  lastName,
  email,
  avatarUrl,
}: {
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const initials = `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`
    .trim()
    .toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

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
  initialShowInvite?: boolean;
};

export function OrganizationMembers({
  organizationId,
  actorRole,
  canEdit,
  initialShowInvite = false,
}: OrganizationMembersProps) {
  const [members, setMembers] = useState<AccountMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(initialShowInvite);
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

  useEffect(() => {
    if (initialShowInvite && canManage) {
      setShowInviteForm(true);
    }
  }, [initialShowInvite, canManage]);

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      wallsToast.error("Missing email", "Enter an email to add a user");
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
        wallsToast.error("Error", payload.error || "Failed to create user");
        return;
      }

      const payload = (await response.json()) as {
        members?: AccountMemberRecord[];
        invited?: boolean;
        created?: boolean;
        emailSent?: boolean;
      };
      setMembers(payload.members ?? []);
      resetInviteForm();
      void loadAppAccess();

      if (payload.emailSent) {
        wallsToast.success(
          "User added",
          payload.invited
            ? "They will get an email to create their password and join this organization"
            : "They will get an email letting them know they were added to this organization",
        );
      } else if (payload.created) {
        wallsToast.success(
          "User added",
          "User was created and added, but the notification email could not be sent",
        );
      } else {
        wallsToast.success(
          "User added",
          payload.emailSent === false
            ? "Existing user was added, but the notification email could not be sent"
            : "Existing user was added to this organization",
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
        "User removed",
        "User was removed from this organization",
      );
    } finally {
      setRemovingUserId(null);
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
        wallsToast.error(
          "Error",
          payload.error || "Failed to update app access",
        );
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

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const name = displayName(member).toLowerCase();
      return name.includes(q) || member.email.toLowerCase().includes(q);
    });
  }, [members, search]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
        <Skeleton className="h-72 w-full rounded-none" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 max-w-sm flex-1">
          <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search users"
            className={cn(
              "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-3 text-sm font-light transition-colors placeholder:text-neutral-300 focus:outline-none",
              search ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
              "focus:border-b-[var(--kenoo-sky)]",
            )}
          />
        </div>

        <p className="text-xs font-light text-neutral-400 tabular-nums">
          {filteredMembers.length}{" "}
          {filteredMembers.length === 1 ? "user" : "users"}
        </p>

        {canManage ? (
          <ChromeFrame className="ml-auto" contentClassName="rounded-[calc(0.75rem-1.5px)]">
            <Button
              type="button"
              onClick={() => setShowInviteForm(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border-0 bg-white px-4 text-sm font-medium text-neutral-800 shadow-none hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Add user
            </Button>
          </ChromeFrame>
        ) : null}
      </div>

      {catalogApps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-light text-neutral-400">
            Org apps
          </span>
          {catalogApps.map((app) => (
            <span
              key={app.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-2 py-0.5 text-[11px] font-medium tracking-tight text-neutral-600"
            >
              <AppIcon app={app} size={14} />
              {app.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <thead className="border-b border-neutral-100">
            <tr>
              <th className="w-[28%] py-3 pr-4 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                Name
              </th>
              <th className="w-[26%] py-3 pl-3 pr-4 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                Email
              </th>
              <th className="w-[14%] py-3 pl-3 pr-4 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                Role
              </th>
              <th className="w-[20%] py-3 pl-3 pr-4 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                Apps
              </th>
              <th className="w-[12%] py-3 pl-3 pr-4 text-right text-xs font-medium uppercase tracking-wide text-neutral-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-16 text-center text-sm font-light text-neutral-400"
                >
                  {members.length === 0
                    ? "No users yet. Add a user to get started."
                    : "No users match your search."}
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const meta = roleMeta(member.role);
                const isUpdating = updatingUserId === member.userId;
                const isRemoving = removingUserId === member.userId;
                const canEditMember =
                  canManage &&
                  (actorRole === "owner" || member.role !== "owner");
                const grantedApps = catalogApps.filter((app) =>
                  (memberAppIds[member.userId] ?? []).includes(app.id),
                );

                return (
                  <tr
                    key={member.id}
                    className="border-b border-neutral-50 transition-colors hover:bg-neutral-50/60"
                  >
                    <td className="overflow-hidden py-4 pr-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <MemberAvatar
                          firstName={member.firstName}
                          lastName={member.lastName}
                          email={member.email}
                          avatarUrl={member.avatarUrl}
                        />
                        <span className="truncate text-sm font-medium text-neutral-800">
                          {displayName(member)}
                        </span>
                      </div>
                    </td>
                    <td className="overflow-hidden py-4 pl-3 pr-4 text-xs font-light text-neutral-500">
                      <span className="block truncate">{member.email}</span>
                    </td>
                    <td className="py-4 pl-3 pr-4">
                      {canEditMember ? (
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
                          <SelectTrigger className="h-8 w-[7.5rem] rounded-lg border-neutral-200 bg-transparent px-2 text-xs font-light shadow-none disabled:opacity-50">
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
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-light text-neutral-500">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              meta.dotClass,
                            )}
                            aria-hidden
                          />
                          {meta.label}
                        </span>
                      )}
                    </td>
                    <td className="overflow-hidden py-4 pl-3 pr-4">
                      {grantedApps.length > 0 ? (
                        <div className="flex min-w-0 items-center gap-1">
                          {grantedApps.slice(0, 4).map((app) => (
                            <span
                              key={app.id}
                              title={app.name}
                              className="inline-flex"
                            >
                              <AppIcon app={app} size={18} />
                            </span>
                          ))}
                          {grantedApps.length > 4 ? (
                            <span className="text-[11px] font-light text-neutral-400">
                              +{grantedApps.length - 4}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-light text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline"
                          onClick={() => setAppAccessMember(member)}
                        >
                          {canEditAppAccessFor(member) ? "Assign" : "None"}
                        </button>
                      )}
                    </td>
                    <td className="py-4 pl-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={isRemoving || isUpdating}
                          aria-label={
                            canEditAppAccessFor(member)
                              ? "Manage app access"
                              : "View app access"
                          }
                          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
                          onClick={() => setAppAccessMember(member)}
                        >
                          <AppWindow className="h-4 w-4" />
                        </button>
                        {canEditMember ? (
                          <button
                            type="button"
                            disabled={isRemoving || isUpdating}
                            aria-label="Remove user"
                            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                            onClick={() => void handleRemove(member.userId)}
                          >
                            {isRemoving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={showInviteForm}
        onOpenChange={(open) => !open && resetInviteForm()}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[120] bg-kenoo-white"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="inset-0 left-0 top-0 z-[120] flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-kenoo-white p-0 shadow-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0"
        >
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-neutral-100 px-4 sm:px-6">
              <button
                type="button"
                onClick={resetInviteForm}
                aria-label="Close"
                className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-base font-medium tracking-tight text-neutral-900">
                Add user
              </h2>
            </header>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
              <div className="mx-auto w-full max-w-2xl">
                <div className="border-b border-neutral-100 pb-4">
                  <h3 className="text-base font-medium text-neutral-800">
                    User information
                  </h3>
                  <p className="mt-1 text-sm font-light text-neutral-500">
                    They’ll get an invite email to join this organization.
                  </p>
                </div>

                <div className="mt-6 space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                        First name
                      </span>
                      <Input
                        type="text"
                        value={inviteFirstName}
                        onChange={(event) =>
                          setInviteFirstName(event.target.value)
                        }
                        placeholder="Jane"
                        className={inviteFieldClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                        Last name
                      </span>
                      <Input
                        type="text"
                        value={inviteLastName}
                        onChange={(event) =>
                          setInviteLastName(event.target.value)
                        }
                        placeholder="Doe"
                        className={inviteFieldClass}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                      Email <span className="text-neutral-400">*</span>
                    </span>
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
                      className={inviteFieldClass}
                    />
                    <span className="mt-1.5 block text-xs font-light text-neutral-400">
                      We’ll send sign-in instructions to this address.
                    </span>
                  </label>

                  <label className="block max-w-xs">
                    <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                      Role
                    </span>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) =>
                        setInviteRole(value as AccountRole)
                      }
                    >
                      <SelectTrigger className="h-10 rounded-none border-0 border-b border-neutral-200 bg-transparent px-0 font-light shadow-none focus:ring-0 data-[state=open]:border-b-[var(--kenoo-sky)]">
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
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-100 bg-kenoo-white px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={resetInviteForm}
                className="px-3 py-2 text-sm font-medium tracking-wide text-neutral-500 transition-colors hover:text-neutral-800"
              >
                Cancel
              </button>
              <Button
                type="button"
                disabled={inviting || !inviteEmail.trim()}
                onClick={() => void handleInvite()}
                className="rounded-full bg-neutral-900 px-5 text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                {inviting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </span>
                ) : (
                  "Add user"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <h2 className="text-lg font-medium text-neutral-900">
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
                    This organization has no apps yet. Enable apps in Console,
                    then assign them to members here.
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
                          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                          enabled
                            ? "border-neutral-300 bg-neutral-50"
                            : "border-neutral-200/60 bg-transparent",
                          canToggle
                            ? "hover:bg-neutral-50"
                            : "cursor-default",
                          "disabled:opacity-90",
                        )}
                      >
                        <AppIcon app={app} size={36} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                          {app.name}
                        </span>
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
                        ) : (
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                              enabled
                                ? "border-neutral-800 bg-neutral-800 text-white"
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
