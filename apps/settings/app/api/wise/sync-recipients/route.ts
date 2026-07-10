import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncWiseRecipientsFromAccounts } from "../lib/reconcile-profile";

/**
 * POST /api/wise/sync-recipients
 * Fetches all recipient accounts from Wise for the configured profile (WISE_PROFILE_ID)
 * and syncs them into public.wise_recipients.
 * - New recipients: inserted with user_id = null. Existing rows: Wise fields updated; user_id is never overwritten.
 */
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const result = await syncWiseRecipientsFromAccounts(supabase);
  if (result.ok === false) {
    const isConfig =
      result.error.includes("WISE_API_TOKEN") ||
      result.error.includes("WISE_PROFILE_ID");
    return NextResponse.json(
      { error: result.error },
      { status: isConfig ? 503 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      result.synced === 0
        ? "No recipients to sync"
        : `Synced ${result.synced} recipient(s)`,
    synced: result.synced,
  });
}
