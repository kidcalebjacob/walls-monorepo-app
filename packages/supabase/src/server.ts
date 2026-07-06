import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

import { mergeSupabaseCookieOptions } from "./cookies";
import { getSupabaseEnv } from "./env";

export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookieOptions: mergeSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, mergeSupabaseCookieOptions(options));
          });
        } catch {
          // Called from a Server Component — middleware handles session refresh.
        }
      },
    },
  });
}
