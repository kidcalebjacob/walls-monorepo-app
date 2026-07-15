"use client";

import * as React from "react";
import { useLoadingCallback } from "react-loading-hook";
import { Loader2, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
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
import { Separator } from "@walls/ui/separator";

import { AppOrbitLauncher } from "@/components/app-orbit-launcher";
import { useRedirectAfterLogin } from "@/hooks/useRedirectAfterLogin";
import { useRedirectParam } from "@/hooks/useRedirectParam";
import {
  fetchUserLauncherApps,
  type PortalLauncherApp,
} from "@/lib/user-apps";
import { publicSitePath } from "@/lib/urls";

function LoginPageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-walls-white">
      <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
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
  const [shouldSlideOut, setShouldSlideOut] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);
  const [needsMfaVerification, setNeedsMfaVerification] = React.useState(false);
  const [mfaCode, setMfaCode] = React.useState("");
  const [mfaError, setMfaError] = React.useState<string | null>(null);
  const [mfaVerifying, setMfaVerifying] = React.useState(false);
  const [mfaInputFocused, setMfaInputFocused] = React.useState(false);

  const redirectParam = useRedirectParam();
  const redirectAfterLogin = useRedirectAfterLogin();
  const redirectAfterLoginRef = React.useRef(redirectAfterLogin);
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

  React.useEffect(() => {
    redirectAfterLoginRef.current = redirectAfterLogin;
  }, [redirectAfterLogin]);

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

      setTimeout(() => {
        redirectAfterLoginRef.current();
      }, 100);
    };

    void checkAuth();
    // Only run once on mount — redirectAfterLogin is read via ref.
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

  React.useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  React.useEffect(() => {
    if (hasLogged && !isLoadingUserData && userData?.first_name && isDesktop) {
      // Slide yellow panel out once greeting has played (launcher or redirect).
      const timer = setTimeout(() => {
        setShouldSlideOut(true);
      }, hasRedirectParam ? 2000 : 2200);
      return () => clearTimeout(timer);
    }
  }, [
    hasLogged,
    isLoadingUserData,
    userData?.first_name,
    isDesktop,
    hasRedirectParam,
  ]);

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

      const { data: statusRow } = await supabase
        .from("users")
        .select("status")
        .eq("id", data.user.id)
        .single();

      if (statusRow?.status && statusRow.status !== "active") {
        await supabase.auth.signOut();
        setError("Your account is not active. Please contact support.");
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
    <div className="flex h-screen bg-walls-white">
      {!hasLogged && !needsMfaVerification && (
        <div className="absolute top-4 right-4 pr-6">
          <Button
            asChild
            variant="ghost"
            className="group flex items-center gap-2 text-black hover:bg-transparent hover:text-black transition-colors"
          >
            <a href={publicSitePath("/")}>
              <ChevronLeft className="w-4 h-4 text-black group-hover:-translate-x-1 transition-transform duration-200" />
              <span className="text-black font-light">Back home</span>
            </a>
          </Button>
        </div>
      )}

      {needsMfaVerification && (
        <div className="absolute top-4 left-4 pl-6">
          <Button
            onClick={() => {
              resetMfaVerification();
              void getSupabaseClient().auth.signOut();
            }}
            variant="ghost"
            className="group flex items-center gap-2 text-black hover:bg-transparent hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-black group-hover:-translate-x-1 transition-transform duration-200" />
            <span className="text-black font-light">Back</span>
          </Button>
        </div>
      )}

      <motion.div
        className="hidden md:flex relative bg-walls-yellow rounded-r-[150px] items-center justify-center shadow-inner border border-neutral-200/50 overflow-hidden"
        initial={false}
        animate={{
          width: shouldSlideOut ? "0%" : "50%",
          x: shouldSlideOut ? "-100%" : 0,
          opacity: shouldSlideOut ? 0 : 1,
        }}
        transition={{
          duration: shouldSlideOut ? 1.2 : 0,
          ease: [0.4, 0, 0.2, 1],
        }}
        style={{ zIndex: shouldSlideOut ? 0 : 10 }}
      >
        <motion.div
          initial={false}
          animate={{
            opacity: shouldSlideOut ? 0 : 1,
            scale: shouldSlideOut ? 0.8 : 1,
          }}
          transition={{
            duration: shouldSlideOut ? 0.4 : 0,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <Image
            src="https://assets.wallsentertainment.com/logo-variations/black-logo.png"
            alt="WALLS Logo"
            width={400}
            height={400}
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <div className="md:hidden flex justify-center">
        <Separator orientation="horizontal" className="w-full bg-border/50" />
      </div>

      <motion.div
        className={`w-full flex items-center justify-center ${
          hasLogged ? "p-4 sm:p-8" : "p-8"
        }`}
        initial={false}
        animate={{
          width: isDesktop ? (shouldSlideOut ? "100%" : "50%") : "100%",
        }}
        transition={{
          duration: shouldSlideOut ? 1.2 : 0,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <div
          className={`w-full text-center ${
            hasLogged ? "max-w-3xl space-y-0" : "max-w-md space-y-8"
          }`}
        >
          {!hasLogged && !needsMfaVerification && (
            <div className="space-y-2 flex items-center justify-center">
              <Image
                src="https://assets.wallsentertainment.com/logo-variations/black-gradient-indented.png"
                alt="WALLS Logo"
                width={65}
                height={65}
                className="mr-4 mt-2 md:hidden"
              />
              <h1 className="text-6xl font-bold tracking-tight">Login.</h1>
            </div>
          )}

          {needsMfaVerification ? (
            <div className="space-y-4 w-full">
              <div className="space-y-2 flex items-center justify-center">
                <Image
                  src="https://assets.wallsentertainment.com/logo-variations/black-gradient-indented.png"
                  alt="WALLS Logo"
                  width={65}
                  height={65}
                  className="mr-4 mt-2 md:hidden"
                />
                <h1 className="text-6xl font-bold tracking-tight">Verify.</h1>
              </div>
              <p className="text-sm font-light text-neutral-500 text-center">
                Enter the 6-digit code from your authenticator app.
              </p>
              {mfaError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {mfaError}
                </div>
              )}
              <div
                className="flex gap-2 justify-center"
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
                  className="flex gap-2 justify-center items-center cursor-text"
                >
                  {[0, 1, 2].map((i) => {
                    const isCursorHere = mfaInputFocused && i === mfaCode.length;
                    return (
                      <div
                        key={i}
                        className="w-12 h-16 flex-shrink-0 flex items-center justify-center gap-0.5 rounded-xl bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-xl font-mono text-foreground"
                      >
                        <span>{mfaCode[i] ?? ""}</span>
                        {isCursorHere && (
                          <span
                            className="inline-block w-1 h-6 bg-foreground animate-caret-blink flex-shrink-0"
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                  <span
                    className="text-neutral-400 font-light text-lg mx-0.5"
                    aria-hidden
                  >
                    -
                  </span>
                  {[3, 4, 5].map((i) => {
                    const isCursorHere = mfaInputFocused && i === mfaCode.length;
                    return (
                      <div
                        key={i}
                        className="w-12 h-16 flex-shrink-0 flex items-center justify-center gap-0.5 rounded-xl bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-xl font-mono text-foreground"
                      >
                        <span>{mfaCode[i] ?? ""}</span>
                        {isCursorHere && (
                          <span
                            className="inline-block w-1 h-6 bg-foreground animate-caret-blink flex-shrink-0"
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
            <div className="space-y-4 w-full">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-12 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 transition-all duration-300 placeholder:text-neutral-400/80"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading) handleLogin();
                  }}
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-12 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 transition-all duration-300 placeholder:text-neutral-400/80"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading) handleLogin();
                  }}
                />
              </div>

              <div className="flex justify-start">
                <Link
                  href="/reset-password"
                  className="text-xs text-muted-foreground hover:text-walls-light transition-colors underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                onClick={handleLogin}
                className="w-full rounded-full font-bold text-xl h-16 bg-walls-yellow/80 hover:bg-walls-yellow/90 text-black transition-all duration-300 shadow-inner border border-neutral-200/50 relative z-10"
                disabled={isLoading || !email.trim() || !password.trim()}
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

              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <a
                  href={publicSitePath("/terms-and-conditions")}
                  className="underline hover:text-walls-blue text-walls-light"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href={publicSitePath("/privacy-policy")}
                  className="underline hover:text-walls-blue text-walls-light"
                >
                  Privacy Policy
                </a>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </React.Suspense>
  );
}
