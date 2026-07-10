/** Settings app origin — used for OAuth redirect URIs and post-connect redirects. */
export function getSettingsOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SETTINGS_URL?.replace(/\/$/, "") ??
    "http://localhost:3004"
  );
}

export function getGmailOAuthRedirectUri(): string {
  return `${getSettingsOrigin()}/api/google/gmail/callback`;
}

export function getCalendarOAuthRedirectUri(): string {
  return `${getSettingsOrigin()}/api/google/calendar/callback`;
}

export function getConnectPageUrl(): string {
  return `${getSettingsOrigin()}/connect`;
}
