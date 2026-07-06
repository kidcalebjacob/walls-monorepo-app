export type SafeUserConnection = {
  id: string;
  provider: string | null;
  service: string | null;
  account_id: string | null;
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

/** Meta Marketing API uses long-lived tokens — no OAuth refresh token. */
export const META_EMPTY_REFRESH_TOKEN = "";

export type MetaConnectionRecord = {
  id: string;
  user_id: string;
  account_id: string | null;
  access_token: string;
  token_payload: {
    account_name?: string | null;
    account_status?: number | null;
  } | null;
};
