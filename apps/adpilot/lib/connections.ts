export type SafeAccountConnection = {
  id: string;
  provider: string | null;
  service: string | null;
  /** Provider-side account id (e.g. Meta `act_123`). */
  provider_account_id: string | null;
  token_expiry: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string | null;
  token_payload?: {
    account_name?: string | null;
    account_status?: number | null;
  } | null;
};

export const META_PROVIDER = "meta";
export const META_SERVICE = "meta_ads";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_ADS_SERVICE = "google_ads";

/** Meta Marketing API uses long-lived tokens - no OAuth refresh token. */
export const META_EMPTY_REFRESH_TOKEN = "";

export type MetaConnectionRecord = {
  id: string;
  /** WALLS account that owns this connection. */
  account_id: string;
  /** Provider-side account id (e.g. Meta `act_123`). */
  provider_account_id: string | null;
  access_token: string;
  token_payload: {
    account_name?: string | null;
    account_status?: number | null;
  } | null;
};

export type GoogleAdsConnectionRecord = {
  id: string;
  account_id: string;
  /** Google Ads customer id (digits only). */
  provider_account_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
  token_payload: {
    account_name?: string | null;
    manager?: boolean | null;
    currency_code?: string | null;
  } | null;
};
