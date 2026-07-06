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
} from "./post-login-redirect";
