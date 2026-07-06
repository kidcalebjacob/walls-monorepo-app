import { createClient } from "@walls/supabase/client";

export function getSupabaseClient() {
  return createClient();
}
