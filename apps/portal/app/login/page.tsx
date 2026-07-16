"use client";

import * as React from "react";
import { useLoadingCallback } from "react-loading-hook";
import { Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";

import {
  getSupabaseClient,
  getVerifiedTotpFactor,
  isMfaSecondFactorPending,
  isTotpMfaSecondFactorPending,
  sanitizePostLoginRedirect,
} from "@walls/auth";
import { Button } from "@walls/ui/button";
import { Input } from "@walls/ui/input";

import { AppOrbitLauncher } from "@/components/app-orbit-launcher";
import {
  authGhostLinkClassName,
  authInputClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/components/kenoo/auth-field";
import { AuthHeading, AuthShell } from "@/components/kenoo/auth-shell";
import { useRedirectAfterLogin } from "@/hooks/useRedirectAfterLogin";
import { useRedirectParam } from "@/hooks/useRedirectParam";
import {
  fetchUserLauncherApps,
  type PortalLauncherApp,
} from "@/lib/user-apps";
import { publicSitePath } from "@/lib/urls";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

async function assertActivePortalUser(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: statusRow, error } = await supabase
    .from("users")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: "Unable to verify your account. Please try again.",
    };
  }

  if (!statusRow) {
    return {
      ok: false,
      message:
        "No Kenoo account found for this login. Ask an admin for an invite first.",
    };
  }

  if (statusRow.status !== "active") {
    return {
      ok: false,
      message: "Your account is not active. Please contact support.",
    };
  }

  return { ok: true };
}

function LoginPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kenoo-canvas">
      <Loader2 className="h-8 w-8 animate-spin text-kenoo-muted" />
    </div>
  );
}

function LoginPageContent() {
  const [hasLogged, setHasLogged] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [userData, setUserData] = React.useState<{
    avatar_url: string | null;
    first_name: string | null;
  } | null>(null);
  const [isLoadingUserData, setIsLoadingUserData] = React.useState(false);
  const [launcherApps, setLauncherApps] = React.useState<PortalLauncherApp[]>(
    [],
  );
  const [appsLoading, setAppsLoading] = React.useState(false);
  const [needsMfaVerification, setNeedsMfaVerification] = React.useState(false);
  const [mfaCode, setMfaCode] = React.useState("");
  const [mfaError, setMfaError] = React.useState<string | null>(null);
  const [mfaVerifying, setMfaVerifying] = React.useState(false);
  const [mfaInputFocused, setMfaInputFocused] = React.useState(false);

  const redirectParam = useRedirectParam();
  const redirectAfterLogin = useRedirectAfterLogin();
  const completeLoginSuccessRef = React.useRef<
    (
      supabase: ReturnType<typeof getSupabaseClient>,
      sessionFromSignIn?: { access_token?: string } | null,
    ) => Promise<void>
  >(async () => {});
  const hasRedirectParam = Boolean(redirectParam);
  const mfaInputRef = React.useRef<HTMLInputElement>(null);
  const mfaFactorIdRef = React.useRef<string | null>(null);
  const mfaFlowActiveRef = React.useRef(false);
  const autoRedirectStartedRef = React.useRef(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("redirect");
    if (!raw) return;

    const sanitized = sanitizePostLoginRedirect(raw);
    if (sanitized === raw) return;

    if (sanitized) {
      params.set("redirect", sanitized);
    } else {
      params.delete("redirect");
    }

    const query = params.toString();
    window.history.replaceState({}, "", `/login${query ? `?${query}` : ""}`);
  }, []);

  const beginMfaVerification = React.useCallback((factorId: string) => {
    const alreadyActive =
      mfaFlowActiveRef.current && mfaFactorIdRef.current === factorId;

    mfaFlowActiveRef.current = true;
    mfaFactorIdRef.current = factorId;
    setNeedsMfaVerification(true);

    if (!alreadyActive) {
      setMfaError(null);
      setMfaCode("");
    }
  }, []);

  const resetMfaVerification = React.useCallback(() => {
    mfaFlowActiveRef.current = false;
    mfaFactorIdRef.current = null;
    setNeedsMfaVerification(false);
    setMfaCode("");
    setMfaError(null);
  }, []);

  React.useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();

      if (window.location.search.includes("logout")) {
        localStorage.removeItem("authToken");
        await supabase.auth.signOut();
        window.history.replaceState({}, "", "/login");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();
      if (error || !authUser) return;

      const access = await assertActivePortalUser(supabase, authUser.id);
      if (!access.ok) {
        localStorage.removeItem("authToken");
        await supabase.auth.signOut();
        setError(access.message);
        return;
      }

      if (isTotpMfaSecondFactorPending(authUser, session.access_token)) {
        const totpFactor = getVerifiedTotpFactor(authUser);
        if (totpFactor?.id) {
          beginMfaVerification(totpFactor.id);
        }
        return;
      }

      if (isMfaSecondFactorPending(authUser, session.access_token)) {
        localStorage.removeItem("authToken");
        await supabase.auth.signOut();
        return;
      }

      if (autoRedirectStartedRef.current) return;
      autoRedirectStartedRef.current = true;

      await completeLoginSuccessRef.current(supabase, session);
    };

    void checkAuth();
    // Only run once on mount — success handler is read via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (hasLogged || needsMfaVerification || mfaFlowActiveRef.current) return;

    let cancelled = false;

    const clearIncompleteMfaSession = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled || mfaFlowActiveRef.current) return;

      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();
      if (error || !authUser || cancelled || mfaFlowActiveRef.current) return;

      if (isMfaSecondFactorPending(authUser, session.access_token)) {
        localStorage.removeItem("authToken");
        await supabase.auth.signOut();
      }
    };

    void clearIncompleteMfaSession();

    return () => {
      cancelled = true;
    };
  }, [hasLogged, needsMfaVerification]);

  const completeLoginSuccess = React.useCallback(
    async (
      supabase: ReturnType<typeof getSupabaseClient>,
      sessionFromSignIn?: { access_token?: string } | null,
    ) => {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !authUser?.id) return;

      if (sessionFromSignIn?.access_token) {
        localStorage.setItem("authToken", sessionFromSignIn.access_token);
      }

      setHasLogged(true);
      setIsLoadingUserData(true);
      setAppsLoading(!hasRedirectParam);
      setLauncherApps([]);

      try {
        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("avatar_url, first_name")
          .eq("id", authUser.id)
          .single();

        if (!userError && userRow) {
          setUserData({
            avatar_url: userRow.avatar_url,
            first_name: userRow.first_name,
          });
        }

        if (!hasRedirectParam) {
          const apps = await fetchUserLauncherApps(authUser.id);
          setLauncherApps(apps);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setIsLoadingUserData(false);
        setAppsLoading(false);
      }

      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("loginRedirect", "true");
      window.history.replaceState({}, "", currentUrl.toString());

      // Deep-link redirect: brief splash then leave. Otherwise stay on launcher.
      if (hasRedirectParam) {
        setTimeout(() => {
          redirectAfterLogin();
        }, 2000);
      }
    },
    [hasRedirectParam, redirectAfterLogin],
  );

  React.useEffect(() => {
    completeLoginSuccessRef.current = completeLoginSuccess;
  }, [completeLoginSuccess]);

  const [handleLogin, isLoading] = useLoadingCallback(async () => {
    try {
      setHasLogged(false);
      setError(null);
      const supabase = getSupabaseClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data.user) {
        setError("Login failed. Please try again.");
        return;
      }

      const access = await assertActivePortalUser(supabase, data.user.id);
      if (!access.ok) {
        await supabase.auth.signOut();
        setError(access.message);
        return;
      }

      if (isTotpMfaSecondFactorPending(data.user, data.session?.access_token)) {
        const totpFactor = getVerifiedTotpFactor(data.user);
        if (!totpFactor?.id) {
          setError("Two-factor authentication is required but no authenticator is configured.");
          await supabase.auth.signOut();
          return;
        }

        beginMfaVerification(totpFactor.id);
        return;
      }

      await completeLoginSuccess(supabase, data.session);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
      setHasLogged(false);
    }
  });

  const [handleGoogleLogin, isGoogleLoading] = useLoadingCallback(async () => {
    try {
      setError(null);
      const supabase = getSupabaseClient();

      const redirectTo = new URL("/login", window.location.origin);
      if (redirectParam) {
        redirectTo.searchParams.set("redirect", redirectParam);
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start Google sign-in. Please try again.",
      );
    }
  });

  const handleMfaVerify = React.useCallback(
    async (codeOverride?: string) => {
      const code = (codeOverride ?? mfaCode).replace(/\D/g, "").trim();
      if (!code || code.length !== 6) {
        setMfaError("Please enter the 6-digit code from your authenticator app.");
        return;
      }

      setMfaError(null);
      setMfaVerifying(true);

      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          resetMfaVerification();
          setMfaError("Your session expired. Please sign in again.");
          return;
        }

        let factorId = mfaFactorIdRef.current;
        if (!factorId) {
          const totpFactor = getVerifiedTotpFactor(
            (await supabase.auth.getUser()).data.user ?? {},
          );
          factorId = totpFactor?.id ?? null;
        }

        if (!factorId) {
          const { data: factorsData, error: factorsError } =
            await supabase.auth.mfa.listFactors();

          if (factorsError || !factorsData?.totp?.length) {
            resetMfaVerification();
            setMfaError("Unable to verify. Please sign in again.");
            return;
          }

          factorId = factorsData.totp[0]?.id ?? null;
        }

        if (!factorId) {
          resetMfaVerification();
          setMfaError("Unable to verify. Please sign in again.");
          return;
        }

        const { data: verifyData, error: verifyError } =
          await supabase.auth.mfa.challengeAndVerify({
            factorId,
            code,
          });

        if (verifyError) {
          setMfaError(verifyError.message);
          return;
        }

        mfaFlowActiveRef.current = false;
        mfaFactorIdRef.current = null;
        setNeedsMfaVerification(false);
        await completeLoginSuccess(
          supabase,
          verifyData
            ? { access_token: verifyData.access_token }
            : session,
        );
      } catch (err) {
        setMfaError(
          err instanceof Error
            ? err.message
            : "Verification failed. Please try again.",
        );
      } finally {
        setMfaVerifying(false);
      }
    },
    [completeLoginSuccess, mfaCode, resetMfaVerification],
  );

  return (
    <AuthShell
      wide={hasLogged}
      topRight={
        needsMfaVerification ? (
          <Button
            onClick={() => {
              resetMfaVerification();
              void getSupabaseClient().auth.signOut();
            }}
            variant="ghost"
            className={authGhostLinkClassName}
          >
            <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>Back</span>
          </Button>
        ) : !hasLogged ? (
          <Button asChild variant="ghost" className={authGhostLinkClassName}>
            <a href={publicSitePath("/")}>
              <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Back home</span>
            </a>
          </Button>
        ) : undefined
      }
    >
      {!hasLogged && !needsMfaVerification && (
        <AuthHeading
          title="Sign in"
          description="Enter your credentials to open your workspace."
        />
      )}

      {needsMfaVerification ? (
        <div className="w-full space-y-6">
          <AuthHeading
            title="Verify"
            description="Enter the 6-digit code from your authenticator app."
          />
          {mfaError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {mfaError}
            </div>
          )}
          <div
            className="flex justify-center gap-2"
            role="group"
            aria-label="Verification code"
          >
            <input
              ref={mfaInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={mfaCode}
              onFocus={() => setMfaInputFocused(true)}
              onBlur={() => setMfaInputFocused(false)}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setMfaCode(next);
                if (next.length === 6 && !mfaVerifying) handleMfaVerify(next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !mfaVerifying) handleMfaVerify();
              }}
              disabled={mfaVerifying}
              className="sr-only"
              aria-label="6-digit verification code"
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => mfaInputRef.current?.focus()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  mfaInputRef.current?.focus();
                }
              }}
              className="flex cursor-text items-center justify-center gap-2"
            >
              {[0, 1, 2].map((i) => {
                const isCursorHere = mfaInputFocused && i === mfaCode.length;
                return (
                  <div
                    key={i}
                    className="flex h-16 w-12 flex-shrink-0 items-center justify-center gap-0.5 rounded-xl border border-kenoo-border bg-kenoo-surface font-mono text-xl text-kenoo-ink"
                  >
                    <span>{mfaCode[i] ?? ""}</span>
                    {isCursorHere && (
                      <span
                        className="inline-block h-6 w-1 flex-shrink-0 animate-caret-blink bg-kenoo-ink"
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
              <span className="mx-0.5 text-lg font-light text-kenoo-muted" aria-hidden>
                -
              </span>
              {[3, 4, 5].map((i) => {
                const isCursorHere = mfaInputFocused && i === mfaCode.length;
                return (
                  <div
                    key={i}
                    className="flex h-16 w-12 flex-shrink-0 items-center justify-center gap-0.5 rounded-xl border border-kenoo-border bg-kenoo-surface font-mono text-xl text-kenoo-ink"
                  >
                    <span>{mfaCode[i] ?? ""}</span>
                    {isCursorHere && (
                      <span
                        className="inline-block h-6 w-1 flex-shrink-0 animate-caret-blink bg-kenoo-ink"
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : hasLogged ? (
        <AppOrbitLauncher
          firstName={userData?.first_name ?? null}
          avatarUrl={userData?.avatar_url ?? null}
          isLoadingUserData={isLoadingUserData}
          apps={launcherApps}
          appsLoading={appsLoading}
          redirectMode={hasRedirectParam}
        />
      ) : (
        <div className="w-full space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || isGoogleLoading}
              className={authInputClassName}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && !isGoogleLoading) {
                  handleLogin();
                }
              }}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || isGoogleLoading}
              className={authInputClassName}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && !isGoogleLoading) {
                  handleLogin();
                }
              }}
            />
          </div>

          <div className="flex justify-center">
            <Link
              href="/reset-password"
              className="text-xs text-kenoo-muted transition-colors hover:text-kenoo-ink"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            onClick={handleLogin}
            className={authPrimaryButtonClassName}
            disabled={
              isLoading ||
              isGoogleLoading ||
              !email.trim() ||
              !password.trim()
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-kenoo-border" />
            <span className="text-xs text-kenoo-muted">or</span>
            <div className="h-px flex-1 bg-kenoo-border" />
          </div>

          <Button
            type="button"
            onClick={handleGoogleLogin}
            className={authSecondaryButtonClassName}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <GoogleIcon className="mr-2 h-4 w-4" />
                Continue with Google
              </>
            )}
          </Button>

          <p className="text-xs text-kenoo-muted">
            By continuing, you agree to our{" "}
            <a
              href={publicSitePath("/terms-and-conditions")}
              className="text-kenoo-ink underline hover:opacity-70"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href={publicSitePath("/privacy-policy")}
              className="text-kenoo-ink underline hover:opacity-70"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </React.Suspense>
  );
}
