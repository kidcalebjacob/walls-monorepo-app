import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncWiseWalletsFromBorderless } from "../lib/reconcile-profile";

/**
 * POST /api/wise/sync-wallets
 * Fetches all borderless account balances from Wise and upserts into public.wise_wallets.
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

  const result = await syncWiseWalletsFromBorderless(supabase);
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
        ? "No wallets to sync"
        : `Synced ${result.synced} wallet(s) into wise_wallets`,
    synced: result.synced,
  });
}
