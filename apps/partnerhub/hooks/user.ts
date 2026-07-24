import type { User as SupabaseUser } from "@supabase/supabase-js";

/** Minimal compatibility shim for legacy PartnerHub auth wrappers. */
export function toUser(user: SupabaseUser | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
  };
}
