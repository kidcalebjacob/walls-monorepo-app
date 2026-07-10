import type { SupabaseClient } from "@supabase/supabase-js";

const WISE_API_BASE = "https://api.transferwise.com";
const EXCHANGE_API_BASE = "https://api.frankfurter.dev/v1";

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

interface FrankfurterRates {
  base?: string;
  rates?: Record<string, number>;
}

async function fetchUsdRatesForWallets(
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

/** v1 borderless-accounts response: array of accounts, each with balances[] */
interface BorderlessAccount {
  id: number;
  profileId: number;
  balances: Array<{
    id?: number;
    balanceType?: string;
    currency: string;
    amount?: { value: number; currency: string };
    reservedAmount?: { value: number; currency: string };
  }>;
}

/** Wise recipient account as returned by GET /v1/accounts */
interface WiseRecipientAccount {
  id: number;
  profile: number;
  accountHolderName: string;
  currency: string;
  country: string | null;
  type: string;
  details: Record<string, unknown>;
  active?: boolean;
  ownedByCustomer?: boolean;
}

export type ReconcileSliceResult =
  | { ok: true; synced: number }
  | { ok: false; error: string };

/**
 * Fetches borderless balances from Wise and upserts `wise_wallets` (same behaviour as POST /api/wise/sync-wallets).
 */
export async function syncWiseWalletsFromBorderless(
  supabase: SupabaseClient
): Promise<ReconcileSliceResult> {
  const token = process.env.WISE_API_TOKEN;
  const profileId = process.env.WISE_PROFILE_ID?.trim();
  if (!token || !profileId) {
    return { ok: false, error: "WISE_API_TOKEN or WISE_PROFILE_ID not configured" };
  }

  try {
    const url = `${WISE_API_BASE}/v1/borderless-accounts?profileId=${encodeURIComponent(profileId)}`;
    const res = await fetch(url, { headers: authHeaders(token) });
    const text = await res.text();

    if (!res.ok) {
      let errorMessage = "Failed to fetch Wise borderless accounts";
      try {
        const parsed = JSON.parse(text);
        const msg = parsed.errors?.[0]?.message ?? parsed.message ?? parsed.error;
        if (msg) errorMessage = typeof msg === "string" ? msg : String(msg);
      } catch {
        if (text) errorMessage = text.slice(0, 200);
      }
      return { ok: false, error: errorMessage };
    }

    const data = JSON.parse(text) as BorderlessAccount[];
    const accounts = Array.isArray(data) ? data : [];

    const now = new Date().toISOString();
    const rows: Array<{
      currency: string;
      wise_profile_id: string;
      wise_account_id: string;
      wise_balance_id: string;
      is_active: boolean;
      last_synced_at: string;
      updated_at: string;
      available_balance: number | null;
      reserved_balance: number | null;
      total_balance: number | null;
      balance_usd: number | null;
    }> = [];

    const currencySet = new Set<string>();

    for (const acc of accounts) {
      const wiseProfileId = String(acc.profileId);
      const wiseAccountId = String(acc.id);
      const balances = acc.balances ?? [];

      for (const b of balances) {
        const currency = (b.currency ?? b.amount?.currency ?? "USD").toUpperCase();
        currencySet.add(currency);
        const wiseBalanceId =
          b.id != null ? String(b.id) : `${wiseAccountId}-${currency}`;

        const availableVal =
          b.amount?.value != null ? Number(b.amount.value) : null;
        const reservedVal =
          b.reservedAmount?.value != null ? Number(b.reservedAmount.value) : null;
        const totalVal =
          availableVal != null && reservedVal != null
            ? Math.round((availableVal + reservedVal) * 100) / 100
            : availableVal != null
              ? Math.round(availableVal * 100) / 100
              : null;

        rows.push({
          currency,
          wise_profile_id: wiseProfileId,
          wise_account_id: wiseAccountId,
          wise_balance_id: wiseBalanceId,
          is_active: true,
          last_synced_at: now,
          updated_at: now,
          available_balance:
            availableVal != null
              ? Math.round(availableVal * 100) / 100
              : null,
          reserved_balance:
            reservedVal != null ? Math.round(reservedVal * 100) / 100 : null,
          total_balance: totalVal,
          balance_usd: null,
        });
      }
    }

    if (rows.length > 0) {
      const currencies = Array.from(currencySet);
      const usdRates = await fetchUsdRatesForWallets(currencies);

      if (usdRates !== null) {
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
            row.balance_usd = null;
            continue;
          } else {
            usdValue = value / rateFromUsd;
          }

          row.balance_usd = Math.round(usdValue * 100) / 100;
        }
      }
    }

    if (rows.length === 0) {
      return { ok: true, synced: 0 };
    }

    const { error } = await supabase.from("wise_wallets").upsert(rows, {
      onConflict: "currency",
      ignoreDuplicates: false,
    });

    if (error) {
      return { ok: false, error: error.message || "Failed to upsert wise_wallets" };
    }

    return { ok: true, synced: rows.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Wallet sync failed",
    };
  }
}

/**
 * Fetches recipient accounts from Wise and merges into `wise_recipients` (same behaviour as POST /api/wise/sync-recipients).
 */
export async function syncWiseRecipientsFromAccounts(
  supabase: SupabaseClient
): Promise<ReconcileSliceResult> {
  const token = process.env.WISE_API_TOKEN;
  const profileId = process.env.WISE_PROFILE_ID?.trim();
  if (!token || !profileId) {
    return { ok: false, error: "WISE_API_TOKEN or WISE_PROFILE_ID not configured" };
  }

  try {
    const url = `${WISE_API_BASE}/v1/accounts?profile=${encodeURIComponent(profileId)}&size=100`;
    const res = await fetch(url, { headers: authHeaders(token) });
    const text = await res.text();

    if (!res.ok) {
      let errorMessage = "Failed to fetch Wise recipients";
      try {
        const parsed = JSON.parse(text);
        const msg = parsed.errors?.[0]?.message ?? parsed.message ?? parsed.error;
        if (msg) errorMessage = typeof msg === "string" ? msg : String(msg);
      } catch {
        if (text) errorMessage = text.slice(0, 200);
      }
      return { ok: false, error: errorMessage };
    }

    let accounts: WiseRecipientAccount[];
    try {
      const parsed = JSON.parse(text) as unknown;
      accounts = Array.isArray(parsed)
        ? (parsed as WiseRecipientAccount[])
        : Array.isArray((parsed as { content?: unknown })?.content)
          ? ((parsed as { content: WiseRecipientAccount[] }).content)
          : [];
    } catch {
      return { ok: false, error: "Failed to parse Wise response" };
    }

    if (accounts.length === 0) {
      return { ok: true, synced: 0 };
    }

    const wiseIds = accounts.map((a) => a.id);
    const { data: existingRows, error: fetchError } = await supabase
      .from("wise_recipients")
      .select("wise_recipient_id")
      .in("wise_recipient_id", wiseIds);

    if (fetchError) {
      return {
        ok: false,
        error: fetchError.message || "Failed to fetch existing recipients",
      };
    }

    const existingIds = new Set(
      (existingRows ?? []).map((r) => r.wise_recipient_id as number)
    );

    const toInsert = accounts.filter((acc) => !existingIds.has(acc.id));
    const toUpdate = accounts.filter((acc) => existingIds.has(acc.id));

    if (toInsert.length > 0) {
      const insertRows = toInsert.map((acc) => {
        const country = acc.country ?? null;
        return {
          user_id: null,
          wise_recipient_id: acc.id,
          recipient_name: acc.accountHolderName ?? null,
          payout_currency: (acc.currency ?? "").toUpperCase() || null,
          payout_country: country,
          payout_type: acc.type ?? null,
          bank_details: acc.details ?? null,
          legal_type: "PRIVATE" as const,
          country: country ?? "US",
        };
      });
      const { error: insertError } = await supabase
        .from("wise_recipients")
        .insert(insertRows);

      if (insertError) {
        return {
          ok: false,
          error: insertError.message || "Failed to insert new recipients",
        };
      }
    }

    for (const acc of toUpdate) {
      const country = acc.country ?? null;
      const { error: updateError } = await supabase
        .from("wise_recipients")
        .update({
          recipient_name: acc.accountHolderName ?? null,
          payout_currency: (acc.currency ?? "").toUpperCase() || null,
          payout_country: country,
          payout_type: acc.type ?? null,
          bank_details: acc.details ?? null,
          legal_type: "PRIVATE",
          country: country ?? "US",
        })
        .eq("wise_recipient_id", acc.id);

      if (updateError) {
        return {
          ok: false,
          error: updateError.message || `Failed to update recipient ${acc.id}`,
        };
      }
    }

    return { ok: true, synced: accounts.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Recipient sync failed",
    };
  }
}

export type ReconcileProfileResult = {
  wallets: ReconcileSliceResult;
  recipients: ReconcileSliceResult;
};

/**
 * Pulls latest borderless balances and recipient accounts from Wise into Supabase.
 * Call after verified webhooks so UI stays aligned without manual sync.
 */
export async function reconcileWiseProfileFromApi(
  supabase: SupabaseClient
): Promise<ReconcileProfileResult> {
  const wallets = await syncWiseWalletsFromBorderless(supabase);
  const recipients = await syncWiseRecipientsFromAccounts(supabase);
  return { wallets, recipients };
}
