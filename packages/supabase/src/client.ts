import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAuthCookieOptions } from "./cookies";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieOptions = getSupabaseAuthCookieOptions();

  return createBrowserClient(
    url,
    anonKey,
    cookieOptions ? { cookieOptions } : undefined,
  );
}
