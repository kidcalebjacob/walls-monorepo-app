import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WISE_API_BASE = "https://api.transferwise.com";
const EXCHANGE_API_BASE = "https://api.frankfurter.dev/v1";

/** Frankfurter latest: base=USD gives 1 USD = rates[XYZ] in each currency. To get USD from amount in XYZ: amount / rates[XYZ]. */
interface FrankfurterRates {
  base?: string;
  rates?: Record<string, number>;
}

async function fetchUsdRates(currencies: string[]): Promise<Record<string, number> | null> {
  const list = currencies.filter((c) => c !== "USD").join(",");
  if (!list) return {};
  const url = `${EXCHANGE_API_BASE}/latest?base=USD&symbols=${encodeURIComponent(list)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as FrankfurterRates & { message?: string };
  if (!data?.rates || typeof data.rates !== "object") return null;
  return data.rates as Record<string, number>;
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

/** Balance statement JSON response: transactions array */
interface StatementTransaction {
  type?: string;
  date?: string;
  amount?: { value: number; currency: string };
  totalFees?: { value: number; currency: string };
  details?: {
    type?: string;
    description?: string;
    paymentReference?: string;
    senderName?: string;
    amount?: { value?: number; currency?: string };
    merchant?: { name?: string; city?: string; country?: string; [key: string]: unknown };
    recipient?: { name?: string; bankAccount?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  referenceNumber?: string;
  runningBalance?: { value: number; currency: string };
  [key: string]: unknown;
}

interface StatementResponse {
  transactions?: StatementTransaction[];
  query?: { intervalStart?: string; intervalEnd?: string; accountId?: number };
  [key: string]: unknown;
}

interface WiseWalletRow {
  id: string;
  currency: string | null;
  wise_balance_id: string;
}

/**
 * POST /api/wise/sync-transactions
 * Fetches balance statements from Wise for each wallet and upserts into public.wise_transactions.
 */
export async function POST() {
  const token = process.env.WISE_API_TOKEN;
  const profileId = process.env.WISE_PROFILE_ID?.trim();

  if (!token || !profileId) {
    return NextResponse.json(
      { error: "WISE_API_TOKEN or WISE_PROFILE_ID not configured" },
      { status: 503 }
    );
  }

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
    const { data: wallets, error: walletsError } = await supabase
      .from("wise_wallets")
      .select("id, currency, wise_balance_id")
      .eq("is_active", true);

    if (walletsError) {
      return NextResponse.json(
        { error: walletsError.message || "Failed to fetch wise_wallets" },
        { status: 500 }
      );
    }

    const walletList = (Array.isArray(wallets) ? wallets : []) as WiseWalletRow[];
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    const intervalEnd = end.toISOString();
    const intervalStart = start.toISOString();

    const allRows: Array<{
      wise_transaction_id: string;
      wallet_id: string;
      type: string;
      amount: number;
      currency: string;
      reference_type: string | null;
      reference_id: string | null;
      wise_created_at: string;
      raw: Record<string, unknown>;
      merchant_name: string | null;
      usd_amount: number | null;
      fx_rate: number | null;
    }> = [];

    for (const wallet of walletList) {
      const balanceIdNum = parseInt(wallet.wise_balance_id, 10);
      if (Number.isNaN(balanceIdNum)) continue;

      const currency = (wallet.currency || "USD").toUpperCase();
      const url = `${WISE_API_BASE}/v1/profiles/${encodeURIComponent(profileId)}/balance-statements/${balanceIdNum}/statement.json?currency=${encodeURIComponent(currency)}&intervalStart=${encodeURIComponent(intervalStart)}&intervalEnd=${encodeURIComponent(intervalEnd)}&type=COMPACT`;
      const res = await fetch(url, { headers: authHeaders(token) });
      const text = await res.text();

      if (!res.ok) {
        if (res.status === 404 || res.status >= 500) continue;
        try {
          const parsed = JSON.parse(text);
          const msg = parsed.errors?.[0]?.message ?? parsed.message ?? parsed.error;
          console.warn(`[sync-transactions] Statement failed for wallet ${wallet.id}:`, msg || text.slice(0, 200));
        } catch {
          console.warn(`[sync-transactions] Statement failed for wallet ${wallet.id}:`, text.slice(0, 200));
        }
        continue;
      }

      let data: StatementResponse;
      try {
        data = JSON.parse(text) as StatementResponse;
      } catch {
        continue;
      }

      const transactions = Array.isArray(data?.transactions) ? data.transactions : [];
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const dateStr = tx.date ?? new Date().toISOString();
        // Use top-level amount (signed: negative for DEBIT, positive for CREDIT), not details.amount
        const amountObj = tx.amount;
        const amountVal = amountObj?.value != null ? Number(amountObj.value) : 0;
        const amount = Math.round(amountVal * 100) / 100;
        const currencyCode = (amountObj?.currency ?? tx.details?.amount?.currency ?? currency).toUpperCase();
        const typeRaw = tx.details?.type ?? tx.type ?? "UNKNOWN";
        const type = String(typeRaw).toUpperCase().replace(/\s/g, "_");
        const refNum = tx.referenceNumber ?? `stmt-${dateStr}-${i}`;
        const wiseTransactionId = `${balanceIdNum}-${String(refNum).replace(/\s/g, "-")}`;
        const merchantName = (
          tx.details?.merchant?.name ??
          tx.details?.senderName ??
          tx.details?.recipient?.name ??
          tx.details?.description ??
          null
        ) as string | null;

        allRows.push({
          wise_transaction_id: wiseTransactionId,
          wallet_id: wallet.id,
          type,
          amount,
          currency: currencyCode,
          reference_type: null,
          reference_id: null,
          wise_created_at: dateStr,
          raw: tx as Record<string, unknown>,
          merchant_name: merchantName && String(merchantName).trim() ? String(merchantName).trim() : null,
          usd_amount: null,
          fx_rate: null,
        });
      }
    }

    if (allRows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No transactions to sync",
        synced: 0,
      });
    }

    const uniqueCurrencies = Array.from(new Set(allRows.map((r) => r.currency.toUpperCase())));
    const usdRates = await fetchUsdRates(uniqueCurrencies);
    const rateMap: Record<string, number> = { USD: 1 };
    if (usdRates && typeof usdRates === "object") {
      for (const [cur, rate] of Object.entries(usdRates)) {
        const key = cur.toUpperCase();
        if (rate != null && Number.isFinite(rate) && rate > 0) rateMap[key] = rate;
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    for (const row of allRows) {
      const currency = row.currency.toUpperCase();
      const rate = rateMap[currency] ?? null;
      if (rate != null && rate > 0) {
        row.fx_rate = rate;
        row.usd_amount = round2(row.amount / rate);
      }
    }

    const { error: upsertError } = await supabase
      .from("wise_transactions")
      .upsert(allRows, {
        onConflict: "wise_transaction_id",
        ignoreDuplicates: true,
      });

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message || "Failed to upsert wise_transactions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Synced ${allRows.length} transaction(s) into wise_transactions`,
      synced: allRows.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
