import {
  buildPortalInviteRedirectUrl,
  buildPortalLoginUrl,
} from "@walls/auth/portal-url";
import { createAdminClient } from "@walls/supabase/admin";

import {
  type AccountMemberRecord,
  type AccountRecord,
  type AccountRole,
} from "./accounts-shared";
import { sendOrganizationInviteEmail } from "./email/org-invite-email";

export type {
  AccountMemberRecord,
  AccountRecord,
  AccountRole,
  AccountType,
} from "./accounts-shared";

export {
  canChangeAccountMemberRole,
  canManageAccountMembers,
  canRemoveAccountMember,
} from "./accounts-shared";

type AccountRow = {
  id: string;
  account_type: "personal" | "organization";
  name: string;
  personal_owner_id: string | null;
};

type AccountMemberRow = {
  id: string;
  user_id: string;
  role: AccountRole;
  is_default: boolean;
  users:
    | {
        first_name: string | null;
        last_name: string | null;
        email: string;
        avatar_url: string | null;
      }
    | {
        first_name: string | null;
        last_name: string | null;
        email: string;
        avatar_url: string | null;
      }[]
    | null;
};

function mapAccount(row: AccountRow): AccountRecord {
  return {
    id: row.id,
    accountType: row.account_type,
    name: row.name,
    personalOwnerId: row.personal_owner_id,
  };
}

function mapAccountMember(row: AccountMemberRow): AccountMemberRecord | null {
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  if (!user) return null;

  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    isDefault: row.is_default,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    avatarUrl: user.avatar_url,
  };
}

export async function getOrganizationAccount(
  accountId: string,
): Promise<AccountRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("accounts")
    .select("id, account_type, name, personal_owner_id")
    .eq("id", accountId)
    .eq("account_type", "organization")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapAccount(data as AccountRow);
}

export async function getAccountMembershipForUser(
  userId: string,
  accountId: string,
): Promise<{ role: AccountRole; isDefault: boolean } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_users")
    .select("role, is_default")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    role: data.role as AccountRole,
    isDefault: data.is_default,
  };
}

export async function listAccountMembers(
  accountId: string,
): Promise<AccountMemberRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_users")
    .select(
      `id, user_id, role, is_default, users (
        first_name, last_name, email, avatar_url
      )`,
    )
    .eq("account_id", accountId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin] list account members:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => mapAccountMember(row as AccountMemberRow))
    .filter((row): row is AccountMemberRecord => row !== null);
}

export async function findUserByEmail(
  email: string,
): Promise<{
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
} | null> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin
    .from("users")
    .select("id, email, first_name, last_name")
    .ilike("email", normalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
  };
}

async function getUserDisplayName(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return "Someone at Kenoo";
  }

  const fullName = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
  return fullName || data.email || "Someone at Kenoo";
}

type OrganizationInviteContext = {
  organizationName: string;
  inviterName: string;
};

async function sendExistingMemberInviteEmail(input: {
  email: string;
  firstName?: string | null;
  organizationName: string;
  inviterName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await sendOrganizationInviteEmail({
    to: input.email,
    firstName: input.firstName,
    organizationName: input.organizationName,
    inviterName: input.inviterName,
    ctaUrl: buildPortalLoginUrl(process.env.NEXT_PUBLIC_PORTAL_URL),
    ctaLabel: "Open Kenoo",
    bodyText: `You now have access to the apps available to ${input.organizationName}. Sign in to get started.`,
  });

  if (!result.ok) {
    console.error("[admin] existing-member SES invite failed:", result.error);
  }

  return result;
}

function emailLocalPart(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "User";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

async function upsertInvitedUserProfile(input: {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const firstName =
    input.firstName?.trim() || emailLocalPart(email);
  const lastName = input.lastName?.trim() || null;

  const { error } = await admin.from("users").upsert(
    {
      id: input.userId,
      email,
      first_name: firstName,
      last_name: lastName,
      status: "active",
      is_admin: false,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[admin] upsert invited user profile:", error);
    return { ok: false, error: "Failed to create user profile" };
  }

  return { ok: true };
}

async function inviteAuthUserByEmail(input: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  organizationName: string;
  inviterName: string;
}): Promise<
  | { ok: true; userId: string; invited: boolean }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const redirectTo = buildPortalInviteRedirectUrl();
  const metadata = {
    first_name: input.firstName?.trim() || emailLocalPart(email),
    last_name: input.lastName?.trim() || null,
    organization_name: input.organizationName,
    inviter_name: input.inviterName,
  };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: metadata,
  });

  if (!error && data.user) {
    return { ok: true, userId: data.user.id, invited: true };
  }

  const message = error?.message?.toLowerCase() ?? "";
  const alreadyRegistered =
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists");

  if (!alreadyRegistered) {
    console.error("[admin] inviteUserByEmail:", error);
    return {
      ok: false,
      error: error?.message ?? "Failed to invite user",
    };
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: metadata },
    });

  if (linkError || !linkData.user) {
    console.error("[admin] generateLink after invite conflict:", linkError);
    return {
      ok: false,
      error: linkError?.message ?? "User already exists but could not be resolved",
    };
  }

  const existingUser = linkData.user;
  const isUnconfirmed = !existingUser.email_confirmed_at;

  if (isUnconfirmed) {
    await admin.auth.admin.deleteUser(existingUser.id);
    const retry = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: metadata,
    });

    if (retry.error || !retry.data.user) {
      console.error("[admin] re-invite after delete:", retry.error);
      return {
        ok: false,
        error: retry.error?.message ?? "Failed to re-invite user",
      };
    }

    return { ok: true, userId: retry.data.user.id, invited: true };
  }

  return { ok: true, userId: existingUser.id, invited: false };
}

/**
 * Adds an existing Kenoo user to an organization, or creates + invites them
 * via Supabase Auth email (create-password portal link) when they do not exist.
 *
 * Email is mutually exclusive:
 * - New / unconfirmed users → Supabase invite template (auth email)
 * - Existing confirmed users → SES organization notification
 */
export async function inviteOrAddAccountMember(input: {
  accountId: string;
  email: string;
  role?: AccountRole;
  firstName?: string | null;
  lastName?: string | null;
  inviterUserId: string;
}): Promise<
  | {
      ok: true;
      userId: string;
      invited: boolean;
      created: boolean;
      emailSent: boolean;
      emailError?: string;
    }
  | { ok: false; error: string }
> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "A valid email is required" };
  }

  const account = await getOrganizationAccount(input.accountId);
  if (!account) {
    return { ok: false, error: "Organization not found" };
  }

  const inviteContext: OrganizationInviteContext = {
    organizationName: account.name,
    inviterName: await getUserDisplayName(input.inviterUserId),
  };

  const existing = await findUserByEmail(email);
  if (existing) {
    const added = await addAccountMember({
      accountId: input.accountId,
      userId: existing.id,
      role: input.role,
    });
    if (!added.ok) return added;

    const emailResult = await sendExistingMemberInviteEmail({
      email,
      firstName: existing.firstName ?? input.firstName,
      organizationName: inviteContext.organizationName,
      inviterName: inviteContext.inviterName,
    });

    return {
      ok: true,
      userId: existing.id,
      invited: false,
      created: false,
      emailSent: emailResult.ok,
      ...(!emailResult.ok ? { emailError: emailResult.error } : {}),
    };
  }

  const invited = await inviteAuthUserByEmail({
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    organizationName: inviteContext.organizationName,
    inviterName: inviteContext.inviterName,
  });
  if (!invited.ok) return invited;

  const profile = await upsertInvitedUserProfile({
    userId: invited.userId,
    email,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (!profile.ok) {
    if (invited.invited) {
      const admin = createAdminClient();
      await admin.auth.admin.deleteUser(invited.userId);
    }
    return profile;
  }

  const added = await addAccountMember({
    accountId: input.accountId,
    userId: invited.userId,
    role: input.role,
  });
  if (!added.ok) {
    return added;
  }

  if (invited.invited) {
    return {
      ok: true,
      userId: invited.userId,
      invited: true,
      created: true,
      emailSent: true,
    };
  }

  const emailResult = await sendExistingMemberInviteEmail({
    email,
    firstName: input.firstName,
    organizationName: inviteContext.organizationName,
    inviterName: inviteContext.inviterName,
  });

  return {
    ok: true,
    userId: invited.userId,
    invited: false,
    created: true,
    emailSent: emailResult.ok,
    ...(!emailResult.ok ? { emailError: emailResult.error } : {}),
  };
}

export async function addAccountMember(input: {
  accountId: string;
  userId: string;
  role?: AccountRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const role = input.role ?? "member";

  const { error } = await admin.from("account_users").insert({
    account_id: input.accountId,
    user_id: input.userId,
    role,
    is_default: false,
    updated_at: now,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This user is already a member of the account" };
    }
    console.error("[admin] add account member:", error);
    return { ok: false, error: "Failed to add account member" };
  }

  return { ok: true };
}

export async function updateAccountMemberRole(input: {
  accountId: string;
  userId: string;
  role: AccountRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("account_users")
    .update({ role: input.role, updated_at: new Date().toISOString() })
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId);

  if (error) {
    console.error("[admin] update account member role:", error);
    return { ok: false, error: "Failed to update member role" };
  }

  return { ok: true };
}

export async function removeAccountMember(input: {
  accountId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("account_users")
    .delete()
    .eq("account_id", input.accountId)
    .eq("user_id", input.userId);

  if (error) {
    console.error("[admin] remove account member:", error);
    return { ok: false, error: "Failed to remove account member" };
  }

  return { ok: true };
}
