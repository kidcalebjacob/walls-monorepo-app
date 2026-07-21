"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Users } from "lucide-react";

import { OrganizationMembers } from "@/components/admin/adminOrganizations/organization-members";
import { useActiveAccount } from "@/components/active-account-context";
import type { AccountRole } from "@/lib/accounts-shared";
import { canManageAccountMembers } from "@/lib/accounts-shared";
import { Toaster } from "@/components/ui/toaster";

function UsersPageContent() {
  const searchParams = useSearchParams();
  const { activeAccount, activeAccountId, loading } = useActiveAccount();
  const showInvite = searchParams.get("invite") === "1";

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 py-2">
        <div className="h-8 w-40 rounded-lg bg-neutral-200/80" />
        <div className="h-4 w-64 rounded bg-neutral-100" />
        <div className="mt-6 h-72 rounded-xl bg-white" />
      </div>
    );
  }

  if (!activeAccountId || !activeAccount) {
    return (
      <div className="mx-auto max-w-6xl rounded-xl border border-neutral-200/80 bg-white px-6 py-16 text-center">
        <Building2 className="mx-auto h-10 w-10 text-neutral-300" />
        <p className="mt-4 text-sm font-medium text-neutral-800">
          No account selected
        </p>
        <p className="mt-1 text-sm font-light text-neutral-500">
          Choose an account from the header to manage users.
        </p>
      </div>
    );
  }

  const actorRole = (activeAccount.role as AccountRole) || "member";
  const canEdit = canManageAccountMembers(actorRole);
  const isOrganization = activeAccount.accountType === "organization";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <Toaster />

      {!isOrganization ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white px-6 py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-medium text-neutral-800">
            User directory is available for organizations
          </p>
          <p className="mt-1 text-sm font-light text-neutral-500">
            Switch to an organization account in the header to manage members.
          </p>
        </div>
      ) : (
        <OrganizationMembers
          organizationId={activeAccountId}
          actorRole={actorRole}
          canEdit={canEdit}
          initialShowInvite={showInvite}
        />
      )}
    </div>
  );
}

export function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl animate-pulse space-y-4 py-2">
          <div className="h-8 w-40 rounded-lg bg-neutral-200/80" />
          <div className="h-72 rounded-xl bg-white" />
        </div>
      }
    >
      <UsersPageContent />
    </Suspense>
  );
}
