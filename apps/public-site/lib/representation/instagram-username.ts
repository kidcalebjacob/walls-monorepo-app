/** Normalize a route segment or handle into a canonical Instagram username (lowercase, no @). */
export function normalizeInstagramUsername(raw: string): string {
  let value = raw.trim();
  if (!value) return "";

  value = value.replace(/^@/, "");

  const fromUrl = value.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
  if (fromUrl?.[1]) {
    value = fromUrl[1];
  }

  return value.replace(/^@/, "").replace(/\/+$/, "").toLowerCase();
}

export function instagramUsernameFromUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  return normalizeInstagramUsername(url);
}

type SocialAccountLike = {
  platform: string;
  username?: string | null;
  url?: string | null;
};

/** Resolve Instagram handle from linked social account rows. */
export function getInstagramUsernameFromAccounts(
  accounts: SocialAccountLike[] | null | undefined
): string | null {
  if (!accounts?.length) return null;

  const ig = accounts.find(
    (a) => a.platform?.toLowerCase() === "instagram"
  );
  if (!ig) return null;

  const fromUsername = normalizeInstagramUsername(ig.username || "");
  if (fromUsername) return fromUsername;

  const fromUrl = instagramUsernameFromUrl(ig.url);
  return fromUrl || null;
}

/**
 * Public URL path segment shown in links (`@handle`).
 * Middleware rewrites `/representation/@handle` → `/representation/handle` internally
 * because Next.js reserves `@` in paths for parallel routes.
 */
export function representationPathSegment(
  instagramUsername: string | null | undefined,
  fallback: string
): string {
  const handle = instagramUsername
    ? normalizeInstagramUsername(instagramUsername)
    : "";
  if (!handle) return fallback;
  return `@${handle}`;
}

/** Human-facing handle for copy, badges, and pitches (includes `@`). */
export function representationDisplayHandle(
  instagramUsername: string | null | undefined
): string | null {
  const handle = instagramUsername
    ? normalizeInstagramUsername(instagramUsername)
    : "";
  return handle ? `@${handle}` : null;
}
