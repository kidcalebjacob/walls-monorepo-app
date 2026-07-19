import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAuthCookieOptions } from "./cookies";
import { getSupabaseEnv } from "./env";

function browserHostname(): string | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const loc = (globalThis as { location?: { hostname?: string } }).location;
  return loc?.hostname;
}

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieOptions = getSupabaseAuthCookieOptions(browserHostname());

  return createBrowserClient(
    url,
    anonKey,
    cookieOptions ? { cookieOptions } : undefined,
  );
}
