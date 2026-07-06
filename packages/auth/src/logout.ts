import { getSupabaseClient } from "./supabase-client";

export async function logoutToPortal(): Promise<void> {
  const supabase = getSupabaseClient();
  localStorage.removeItem("authToken");
  await supabase.auth.signOut();

  const portalBase =
    process.env.NEXT_PUBLIC_WALLS_AGENCY_URL ?? "http://localhost:3002";
  const loginUrl = new URL("/login", portalBase);
  loginUrl.searchParams.set("logout", "1");
  window.location.assign(loginUrl.toString());
}
