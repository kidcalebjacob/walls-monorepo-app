export type AppAccessRecord = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
};

/** Platform admin is never grantable from organization settings. */
export const ORG_MANAGED_APP_EXCLUDED_SLUGS = ["admin"] as const;

export function isOrgManagedAppSlug(slug: string): boolean {
  return !(ORG_MANAGED_APP_EXCLUDED_SLUGS as readonly string[]).includes(slug);
}
