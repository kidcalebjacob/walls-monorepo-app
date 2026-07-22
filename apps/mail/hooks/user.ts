import type { User as SupabaseUser } from "@supabase/supabase-js";

export type User = {
  id: string;
  email: string | null;
};

export const toUser = (supabaseUser: SupabaseUser): User => ({
  id: supabaseUser.id,
  email: supabaseUser.email ?? null,
});
