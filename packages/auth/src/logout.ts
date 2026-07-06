import { getSupabaseClient } from "./supabase-client";
import { buildPortalLoginUrl } from "./portal-url";

export async function logoutToPortal(): Promise<void> {
  const supabase = getSupabaseClient();
  localStorage.removeItem("authToken");
  await supabase.auth.signOut();

  const loginUrl = buildPortalLoginUrl(
    typeof window !== "undefined" ? window.location.origin : undefined,
    { logout: true },
  );
  window.location.assign(loginUrl);
}
