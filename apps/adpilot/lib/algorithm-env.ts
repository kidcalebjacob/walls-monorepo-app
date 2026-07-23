/**
 * Auth for talking to the automation backend (the algorithm service).
 *
 * In this app the key is `ADPILOT_API_KEY`. On the backend service the same
 * value is stored as `TEST_RESPONSE_API_KEY`. It is sent as a bearer token when
 * AdPilot requests a test response from the algorithm.
 *
 * Server-only - never import this from client components.
 */
export function getAdpilotApiKey(): string {
  const key = process.env.ADPILOT_API_KEY;

  if (!key) {
    throw new Error(
      "Missing ADPILOT_API_KEY. Add it to the root .env.local (development) or " +
        ".env / Vercel env (production). It must match TEST_RESPONSE_API_KEY on " +
        "the automation backend.",
    );
  }

  return key;
}

/** Non-throwing variant for optional/feature-flagged code paths. */
export function getAdpilotApiKeyOrNull(): string | null {
  return process.env.ADPILOT_API_KEY ?? null;
}

/**
 * Base URL of the automation backend's dry-run (test-response) service.
 * Trailing slashes are stripped so callers can safely append `/dry-run`.
 * Server-only.
 */
export function getAdpilotApiUrl(): string {
  const url = process.env.ADPILOT_API_URL;

  if (!url) {
    throw new Error(
      "Missing ADPILOT_API_URL. Add it to the root .env.local (development) or " +
        ".env / Vercel env (production). It is the base URL of the AdPilot " +
        "test-response service, e.g. http://localhost:8787.",
    );
  }

  return url.replace(/\/+$/, "");
}
