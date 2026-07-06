/**
 * Replicates getAuthenticatorAssuranceLevel without reading session.user
 * (avoids Supabase insecure-session warning on server).
 */

export type MfaFactor = {
  id: string;
  factor_type?: string;
  status?: string;
};

export type MfaAssuranceUser = {
  factors?: MfaFactor[] | null;
};

export function getVerifiedTotpFactor(
  user: MfaAssuranceUser,
): MfaFactor | undefined {
  return user.factors?.find(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const base64url = parts[1];
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    if (typeof atob !== "function") return null;
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getAuthenticatorAssuranceFromVerifiedUser(
  user: MfaAssuranceUser,
  accessToken: string | null | undefined,
): { currentLevel: string | null; nextLevel: string | null } | null {
  if (!accessToken) {
    return { currentLevel: null, nextLevel: null };
  }
  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    return null;
  }
  const currentLevel =
    typeof payload.aal === "string" ? payload.aal : null;
  let nextLevel: string | null = currentLevel;
  const factors = user.factors ?? [];
  const verifiedFactors = factors.filter((f) => f.status === "verified");
  if (verifiedFactors.length > 0) {
    nextLevel = "aal2";
  }
  return { currentLevel, nextLevel };
}

export function isMfaSecondFactorPending(
  user: MfaAssuranceUser,
  accessToken: string | null | undefined,
): boolean {
  const aal = getAuthenticatorAssuranceFromVerifiedUser(user, accessToken);
  if (!aal) return false;
  return aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}

/** True when the user must complete TOTP before the session reaches aal2. */
export function isTotpMfaSecondFactorPending(
  user: MfaAssuranceUser,
  accessToken: string | null | undefined,
): boolean {
  if (!getVerifiedTotpFactor(user)) return false;
  return isMfaSecondFactorPending(user, accessToken);
}
