export {
  AuthContext,
  useAuth,
  type AuthContextValue,
  type User,
  type UserProfile,
  type UserProfileApp,
} from "./AuthContext";
export { AuthProvider, type AuthProviderProps } from "./AuthProvider";
export { getSupabaseClient } from "./supabase-client";
export { logoutToPortal } from "./logout";
export {
  ACTIVE_ACCOUNT_COOKIE,
  accountUserHasAppAccess,
  getActiveAccountCookieOptions,
  readActiveAccountIdFromDocumentCookie,
  writeActiveAccountIdToDocumentCookie,
  resolveActiveAccountId,
  userHasAccountAppGrants,
  userHasAppAccessForActiveAccount,
  userHasLegacyAppAccess,
} from "./active-account";
export {
  buildPortalCreatePasswordUrl,
  buildPortalLoginUrl,
  normalizePortalOrigin,
  resolvePortalLoginOrigin,
} from "./portal-url";
export {
  getAuthenticatorAssuranceFromVerifiedUser,
  getVerifiedTotpFactor,
  isMfaSecondFactorPending,
  isTotpMfaSecondFactorPending,
  type MfaAssuranceUser,
  type MfaFactor,
} from "./mfa-assurance";
export {
  handleProtectedAppRequest,
  protectedAppMiddlewareMatcher,
  type ProtectedAppMiddlewareOptions,
} from "./protected-app-middleware";
export {
  isAllowedPostLoginRedirect,
  navigateAfterLogin,
  resolvePostLoginRedirect,
  sanitizePostLoginRedirect,
} from "./post-login-redirect";
export {
  buildSubdomainOrigin,
  originForAppSlug,
  resolveAppHref,
  type ResolveAppHrefOptions,
} from "./app-url";
