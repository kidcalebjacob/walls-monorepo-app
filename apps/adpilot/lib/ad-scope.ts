import { getCurrentUserId } from "@/lib/connections-server";

export type AdDataScope = {
  userId: string;
};

type ScopedQuery = {
  eq: (column: string, value: unknown) => ScopedQuery;
};

export async function getAdDataScope(): Promise<AdDataScope | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return { userId };
}

export function withAdScope<T>(query: T, scope: AdDataScope): T {
  const scoped = query as ScopedQuery;
  return scoped.eq("user_id", scope.userId) as T;
}

export function adScopeFields(scope: AdDataScope) {
  return {
    user_id: scope.userId,
  };
}

export function entityBelongsToScope(
  row: { user_id: string },
  scope: AdDataScope,
): boolean {
  return row.user_id === scope.userId;
}
