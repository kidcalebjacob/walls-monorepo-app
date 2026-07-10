import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/wise/transactions
 * Returns wise_transactions from the last 30 days (or since/until query params).
 * Query: since (ISO), until (ISO). Defaults to last 30 days.
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const untilParam = searchParams.get("until");

  const now = new Date();
  const until = untilParam ? new Date(untilParam) : now;
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    return NextResponse.json(
      { error: "Invalid since or until date" },
      { status: 400 }
    );
  }

  try {
    const { data: rows, error } = await supabase
      .from("wise_transactions")
      .select("id, wise_transaction_id, type, amount, currency, merchant_name, wise_created_at, raw, usd_amount")
      .gte("wise_created_at", since.toISOString())
      .lte("wise_created_at", until.toISOString())
      .order("wise_created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    const list = Array.isArray(rows) ? rows : [];
    return NextResponse.json({ transactions: list });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
