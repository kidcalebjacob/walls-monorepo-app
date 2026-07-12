const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";

export const STRAVA_SCOPES = ["read", "activity:read_all"] as const;

export type StravaTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: StravaAthlete;
};

export type StravaAthlete = {
  id: number;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  profile?: string | null;
  profile_medium?: string | null;
  city?: string | null;
  country?: string | null;
};

export function getStravaClientId(): string {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing STRAVA_CLIENT_ID configuration.");
  }
  return clientId;
}

export function getStravaClientSecret(): string {
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing STRAVA_CLIENT_SECRET configuration.");
  }
  return secret;
}

export function getHealthBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_HEALTH_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return "http://localhost:3005";
}

/**
 * Redirect URI registered with the Strava app. Honors STRAVA_REDIRECT_URI so
 * production and local can differ; falls back to the health base URL.
 */
export function getStravaRedirectUri(): string {
  const configured = process.env.STRAVA_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${getHealthBaseUrl()}/api/strava/callback`;
}

export function buildStravaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getStravaClientId(),
    redirect_uri: getStravaRedirectUri(),
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPES.join(","),
    state,
  });

  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeStravaCodeForToken(
  code: string,
): Promise<StravaTokenResponse> {
  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getStravaClientId(),
      client_secret: getStravaClientSecret(),
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava token exchange failed: ${body}`);
  }

  return response.json();
}

/** Refreshes an expired access token. Strava rotates refresh tokens. */
export async function refreshStravaToken(
  refreshToken: string,
): Promise<StravaTokenResponse> {
  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getStravaClientId(),
      client_secret: getStravaClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava token refresh failed: ${body}`);
  }

  return response.json();
}
