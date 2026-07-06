const META_GRAPH_VERSION = "v21.0";

export const META_AD_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
] as const;

export function getAdpilotBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_ADPILOT_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return "http://localhost:3001";
}

export function getMetaAppId(): string {
  const appId =
    process.env.NEXT_PUBLIC_META_ANALYTICS_APP_ID ??
    process.env.META_ANALYTICS_APP_ID;
  if (!appId) {
    throw new Error("Missing META_ANALYTICS_APP_ID configuration.");
  }
  return appId;
}

export function getMetaAppSecret(): string {
  const secret = process.env.META_ANALYTICS_APP_SECRET;
  if (!secret) {
    throw new Error("Missing META_ANALYTICS_APP_SECRET configuration.");
  }
  return secret;
}

export function getMetaRedirectUri(): string {
  return `${getAdpilotBaseUrl()}/api/oauth/meta/callback`;
}

/** OAuth login entry registered in the Meta app (e.g. adpilot.walls.agency). */
export function getMetaLoginUri(): string {
  return `${getAdpilotBaseUrl()}/api/oauth/meta/login`;
}

export function buildMetaAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getMetaAppId(),
    redirect_uri: getMetaRedirectUri(),
    scope: META_AD_SCOPES.join(","),
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCodeForToken(code: string): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const params = new URLSearchParams({
    client_id: getMetaAppId(),
    client_secret: getMetaAppSecret(),
    redirect_uri: getMetaRedirectUri(),
    code,
  });

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta token exchange failed: ${body}`);
  }

  return response.json();
}

export async function exchangeMetaForLongLivedToken(
  shortLivedToken: string,
): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: getMetaAppId(),
    client_secret: getMetaAppSecret(),
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta long-lived token exchange failed: ${body}`);
  }

  return response.json();
}

export async function fetchMetaAdAccounts(accessToken: string): Promise<
  Array<{ id: string; name?: string; account_status?: number }>
> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,account_status",
  });

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts?${params.toString()}`,
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    data?: Array<{ id: string; name?: string; account_status?: number }>;
  };

  return payload.data ?? [];
}
