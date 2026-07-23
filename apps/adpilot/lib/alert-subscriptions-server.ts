import { createClient } from "@walls/supabase/server";

import type { AdDataScope } from "@/lib/ad-scope";
import { ADPILOT_APP_SLUG } from "@/lib/account-context";
import { ADPILOT_ROAS_FLOOR_ALERT_KEY } from "@/lib/spend-automation-settings";

export type AlertSubscription = {
  id: string;
  accountId: string;
  userId: string;
  alertKey: string;
  appSlug: string;
  notifyEmail: boolean;
  notifySms: boolean;
  enabled: boolean;
  scope: Record<string, unknown>;
};

export type AdpilotAlertType = {
  key: string;
  label: string;
  description: string;
};

export type AccountMember = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  role: string;
  displayName: string;
};

export type MemberAlertSubscription = {
  userId: string;
  alertKey: string;
  notifyEmail: boolean;
  notifySms: boolean;
  enabled: boolean;
  subscriptionId: string | null;
};

export const ADPILOT_ALERT_TYPES: AdpilotAlertType[] = [
  {
    key: ADPILOT_ROAS_FLOOR_ALERT_KEY,
    label: "ROAS floor breach",
    description:
      "When campaign ROAS drops below the floor and Email alert is enabled on the preset or entity.",
  },
];

const SUBSCRIPTION_SELECT =
  "id, account_id, user_id, alert_key, app_slug, notify_email, notify_sms, enabled, scope";

function mapSubscription(row: Record<string, unknown>): AlertSubscription {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    userId: row.user_id as string,
    alertKey: row.alert_key as string,
    appSlug: row.app_slug as string,
    notifyEmail: Boolean(row.notify_email),
    notifySms: Boolean(row.notify_sms),
    enabled: Boolean(row.enabled),
    scope:
      row.scope && typeof row.scope === "object" && !Array.isArray(row.scope)
        ? (row.scope as Record<string, unknown>)
        : {},
  };
}

function isEmptyScope(scope: unknown): boolean {
  return (
    !!scope &&
    typeof scope === "object" &&
    !Array.isArray(scope) &&
    Object.keys(scope as object).length === 0
  );
}

function displayNameFor(member: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const name = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
  return name || member.email;
}

export async function listAccountMembers(
  scope: AdDataScope,
): Promise<AccountMember[]> {
  const supabase = await createClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("account_users")
    .select("user_id, role")
    .eq("account_id", scope.accountId);

  if (membershipError) throw membershipError;

  const userIds = (memberships ?? []).map((row) => row.user_id as string);
  if (userIds.length === 0) return [];

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, phone_number")
    .in("id", userIds);

  if (usersError) throw usersError;

  const roleByUserId = new Map(
    (memberships ?? []).map((row) => [row.user_id as string, row.role as string]),
  );

  return (users ?? [])
    .map((user) => {
      const member: AccountMember = {
        userId: user.id as string,
        email: (user.email as string) ?? "",
        firstName: (user.first_name as string | null) ?? null,
        lastName: (user.last_name as string | null) ?? null,
        phoneNumber: (user.phone_number as string | null) ?? null,
        role: roleByUserId.get(user.id as string) ?? "member",
        displayName: "",
      };
      member.displayName = displayNameFor(member);
      return member;
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function listAdpilotAlertSubscriptions(
  scope: AdDataScope,
): Promise<AlertSubscription[]> {
  const supabase = await createClient();
  const alertKeys = ADPILOT_ALERT_TYPES.map((type) => type.key);

  const { data, error } = await supabase
    .from("alert_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("account_id", scope.accountId)
    .eq("app_slug", ADPILOT_APP_SLUG)
    .in("alert_key", alertKeys);

  if (error) throw error;

  return (data ?? [])
    .filter((row) => isEmptyScope(row.scope))
    .map((row) => mapSubscription(row));
}

export async function getAdpilotAlertsPageData(scope: AdDataScope): Promise<{
  alertTypes: AdpilotAlertType[];
  members: AccountMember[];
  subscriptions: MemberAlertSubscription[];
}> {
  const [members, subscriptions] = await Promise.all([
    listAccountMembers(scope),
    listAdpilotAlertSubscriptions(scope),
  ]);

  const memberSubs: MemberAlertSubscription[] = subscriptions.map((sub) => ({
    userId: sub.userId,
    alertKey: sub.alertKey,
    notifyEmail: sub.notifyEmail,
    notifySms: sub.notifySms,
    enabled: sub.enabled,
    subscriptionId: sub.id,
  }));

  return {
    alertTypes: ADPILOT_ALERT_TYPES,
    members,
    subscriptions: memberSubs,
  };
}

export type UpsertMemberAlertInput = {
  scope: AdDataScope;
  userId: string;
  alertKey: string;
  notifyEmail: boolean;
  notifySms: boolean;
};

/**
 * Upsert a workspace-scoped AdPilot alert subscription for an account member.
 * When both channels are off, disables the subscription (keeps the row).
 */
export async function upsertMemberAlertSubscription(
  input: UpsertMemberAlertInput,
): Promise<AlertSubscription> {
  const { scope, userId, alertKey, notifyEmail, notifySms } = input;

  if (!ADPILOT_ALERT_TYPES.some((type) => type.key === alertKey)) {
    throw new Error("Unsupported alert key");
  }

  const members = await listAccountMembers(scope);
  if (!members.some((member) => member.userId === userId)) {
    throw new Error("User is not a member of this account");
  }

  const enabled = notifyEmail || notifySms;
  const supabase = await createClient();

  const { data: rows, error: listError } = await supabase
    .from("alert_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("account_id", scope.accountId)
    .eq("user_id", userId)
    .eq("alert_key", alertKey)
    .eq("app_slug", ADPILOT_APP_SLUG);

  if (listError) throw listError;

  const existing = (rows ?? []).find((row) => isEmptyScope(row.scope));
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from("alert_subscriptions")
      .update({
        notify_email: notifyEmail,
        notify_sms: notifySms,
        enabled,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(SUBSCRIPTION_SELECT)
      .single();

    if (error) throw error;
    return mapSubscription(data);
  }

  const { data, error } = await supabase
    .from("alert_subscriptions")
    .insert({
      account_id: scope.accountId,
      user_id: userId,
      alert_key: alertKey,
      app_slug: ADPILOT_APP_SLUG,
      notify_email: notifyEmail,
      notify_sms: notifySms,
      enabled,
      scope: {},
    })
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error) throw error;
  return mapSubscription(data);
}

/**
 * Ensure the current user is subscribed to AdPilot ROAS floor email alerts
 * for the active account. Idempotent.
 */
export async function ensureRoasFloorEmailSubscription(
  scope: AdDataScope,
): Promise<AlertSubscription> {
  return upsertMemberAlertSubscription({
    scope,
    userId: scope.userId,
    alertKey: ADPILOT_ROAS_FLOOR_ALERT_KEY,
    notifyEmail: true,
    notifySms: false,
  });
}
