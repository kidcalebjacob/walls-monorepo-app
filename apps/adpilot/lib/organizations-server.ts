import { cookies } from "next/headers";

import { createAdminClient } from "@walls/supabase/admin";
import { createClient } from "@walls/supabase/server";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  PERSONAL_WORKSPACE_COOKIE_VALUE,
  type AdDataScope,
  type OrganizationRole,
  type OrganizationSummary,
} from "@/lib/ad-scope";
import { getCurrentUserId } from "@/lib/connections-server";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  website: string | null;
};

type MembershipRow = {
  role: OrganizationRole;
  is_default: boolean;
  organizations: OrganizationRow | OrganizationRow[] | null;
};

function mapMembership(row: MembershipRow): OrganizationSummary | null {
  const organization = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;

  if (!organization) return null;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    iconUrl: organization.icon_url,
    website: organization.website,
    role: row.role,
    isDefault: row.is_default,
  };
}

export async function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_organizations")
    .select(
      "role, is_default, organizations ( id, name, slug, icon_url, website )",
    )
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[adpilot] list organizations:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => mapMembership(row as MembershipRow))
    .filter((row): row is OrganizationSummary => row !== null);
}

export async function userBelongsToOrganization(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_organizations")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("[adpilot] verify organization membership:", error);
    return false;
  }

  return Boolean(data?.id);
}

export async function getActiveOrganizationIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null;
}

export async function resolveActiveOrganizationId(
  userId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;

  if (cookieValue === PERSONAL_WORKSPACE_COOKIE_VALUE) {
    return null;
  }

  if (cookieValue) {
    const allowed = await userBelongsToOrganization(userId, cookieValue);
    if (allowed) return cookieValue;
  }

  const organizations = await listOrganizationsForUser(userId);
  const defaultOrganization =
    organizations.find((organization) => organization.isDefault) ??
    organizations[0];

  return defaultOrganization?.id ?? null;
}

export async function getAdDataScope(): Promise<AdDataScope | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const organizationId = await resolveActiveOrganizationId(userId);
  return { userId, organizationId };
}

export async function setActiveOrganizationCookie(
  organizationId: string | null,
) {
  const cookieStore = await cookies();

  cookieStore.set(
    ACTIVE_ORGANIZATION_COOKIE,
    organizationId ?? PERSONAL_WORKSPACE_COOKIE_VALUE,
    {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    },
  );
}

export async function createOrganizationForUser(input: {
  userId: string;
  name: string;
  slug: string;
  iconUrl?: string | null;
  website?: string | null;
}): Promise<OrganizationSummary | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({
      name: input.name,
      slug: input.slug.toLowerCase(),
      icon_url: input.iconUrl ?? null,
      website: input.website ?? null,
      updated_at: now,
    })
    .select("id, name, slug, icon_url, website")
    .single();

  if (organizationError || !organization) {
    console.error("[adpilot] create organization:", organizationError);
    return null;
  }

  const { error: membershipError } = await admin.from("user_organizations").insert({
    user_id: input.userId,
    organization_id: organization.id,
    role: "owner",
    is_default: true,
    updated_at: now,
  });

  if (membershipError) {
    console.error("[adpilot] create organization membership:", membershipError);
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    iconUrl: organization.icon_url,
    website: organization.website,
    role: "owner",
    isDefault: true,
  };
}
