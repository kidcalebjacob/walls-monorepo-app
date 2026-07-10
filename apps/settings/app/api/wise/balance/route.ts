import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EXCHANGE_API_BASE = "https://api.frankfurter.dev/v1";

/** Frankfurter latest rates: base=USD gives 1 USD = rates[XYZ] in each currency */
interface FrankfurterRates {
  base?: string;
  rates?: Record<string, number>;
}

async function fetchUsdRates(
  currencies: string[]
): Promise<Record<string, number> | null> {
  const list = currencies.filter((c) => c !== "USD").join(",");
  if (!list) return {};
  const url = `${EXCHANGE_API_BASE}/latest?base=USD&symbols=${encodeURIComponent(list)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as FrankfurterRates & { message?: string };
  if (!data?.rates || typeof data.rates !== "object") return null;
  return data.rates as Record<string, number>;
}

/**
 * GET /api/wise/balance
 * Returns total balance in USD from public.wise_wallets (no Wise API call).
 */
export async function GET() {
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

  try {
    const { data: wallets, error } = await supabase
      .from("wise_wallets")
      .select("currency, total_balance, available_balance")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch wise_wallets" },
        { status: 500 }
      );
    }

    const rows = Array.isArray(wallets) ? wallets : [];
    if (rows.length === 0) {
      return NextResponse.json({
        totalUsd: 0,
        total: { value: 0, currency: "USD" },
      });
    }

    const currencies = Array.from(
      new Set(
        rows.map((r) => (r.currency || "USD").toUpperCase())
      )
    );
    const usdRates = await fetchUsdRates(currencies);
    if (usdRates === null) {
      return NextResponse.json(
        { error: "Could not fetch exchange rates" },
        { status: 502 }
      );
    }

    let totalUsd = 0;
    for (const row of rows) {
      const value =
        row.total_balance != null
          ? Number(row.total_balance)
          : row.available_balance != null
            ? Number(row.available_balance)
            : 0;
      const currency = (row.currency || "USD").toUpperCase();
      const rateFromUsd =
        currency === "USD"
          ? 1
          : usdRates[currency] ?? usdRates[currency.toLowerCase()];
      let usdValue: number;
      if (currency === "USD") {
        usdValue = value;
      } else if (rateFromUsd == null || rateFromUsd <= 0) {
        continue;
      } else {
        usdValue = value / rateFromUsd;
      }
      totalUsd += usdValue;
    }

    totalUsd = Math.round(totalUsd * 100) / 100;

    return NextResponse.json({
      totalUsd,
      total: { value: totalUsd, currency: "USD" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
