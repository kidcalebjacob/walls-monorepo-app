export type OrganizationRole = "owner" | "admin" | "member";

export type OrganizationMembership = {
  id: string;
  role: OrganizationRole;
  isDefault: boolean;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  website: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  countryCode: string | null;
  role: OrganizationRole;
  isDefault: boolean;
};

export type OrganizationUpdateInput = {
  name?: string;
  slug?: string;
  iconUrl?: string | null;
  website?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

export function canEditOrganization(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteOrganization(role: OrganizationRole): boolean {
  return role === "owner";
}

export function slugifyOrganizationName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeOrganizationSlug(slug: string): string | null {
  const normalized = slugifyOrganizationName(slug);
  if (!normalized || normalized.length < 2) {
    return null;
  }
  return normalized;
}
