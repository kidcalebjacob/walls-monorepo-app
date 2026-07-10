export const ACTIVE_ORGANIZATION_COOKIE = "walls_active_organization_id";
export const PERSONAL_WORKSPACE_COOKIE_VALUE = "personal";

export type OrganizationRole = "owner" | "admin" | "member";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  website: string | null;
  role: OrganizationRole;
  isDefault: boolean;
};

export type AdDataScope = {
  userId: string;
  organizationId: string | null;
};

type ScopedQuery = {
  eq: (column: string, value: unknown) => ScopedQuery;
  is: (column: string, value: null) => ScopedQuery;
};

export function withAdScope<T>(query: T, scope: AdDataScope): T {
  const scoped = query as ScopedQuery;

  if (scope.organizationId) {
    return scoped.eq("organization_id", scope.organizationId) as T;
  }

  return scoped.eq("user_id", scope.userId).is("organization_id", null) as T;
}

export function adScopeFields(scope: AdDataScope) {
  return {
    user_id: scope.userId,
    organization_id: scope.organizationId,
  };
}

export function entityBelongsToScope(
  row: { user_id: string; organization_id: string | null },
  scope: AdDataScope,
): boolean {
  if (scope.organizationId) {
    return row.organization_id === scope.organizationId;
  }

  return row.user_id === scope.userId && row.organization_id == null;
}
