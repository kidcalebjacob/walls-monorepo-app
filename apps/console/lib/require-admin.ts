import { createClient } from "@walls/supabase/server";
import { createAdminClient } from "@walls/supabase/admin";

export async function requireAdminCaller() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthenticated" as const, status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, is_admin, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[console] Failed to load caller profile:", profileError);
    return { error: "Failed to verify access" as const, status: 500 as const };
  }

  if (!profile || profile.status !== "active" || profile.is_admin !== true) {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  return {
    user,
    supabase,
    admin: createAdminClient(),
  };
}

export function generateTempPassword(length = 16): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
