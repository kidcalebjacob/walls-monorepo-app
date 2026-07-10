"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useCallback, useEffect, useState } from "react";
import { useAuth, getSupabaseClient } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { Copy, Eye, EyeOff, Loader2, Plug, Shield, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiFactorPopup } from "./ui/multi-factor-popup";

export default function SecurityPrivacyPage() {
  const { user } = useAuth();

  type TotpFactor = { id: string; status?: string; friendly_name?: string };

  // ── Talent key ─────────────────────────────────────────────────────────────
  const [talentKey, setTalentKey] = useState("");
  const [talentKeyLoading, setTalentKeyLoading] = useState(true);
  const [showTalentKey, setShowTalentKey] = useState(false);

  // ── 2FA state ──────────────────────────────────────────────────────────────
  const [mfaFactors, setMfaFactors] = useState<{ totp?: TotpFactor[] } | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaEnrollOpen, setMfaEnrollOpen] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState("");
  const [enrollQrCode, setEnrollQrCode] = useState("");
  const [enrollSecret, setEnrollSecret] = useState("");
  const [enrollTotpUri, setEnrollTotpUri] = useState("");
  const [enrollVerifyCode, setEnrollVerifyCode] = useState("");
  const [mfaEnrollError, setMfaEnrollError] = useState("");
  const [mfaEnrollVerifying, setMfaEnrollVerifying] = useState(false);
  const [mfaEnrollLoading, setMfaEnrollLoading] = useState(false);
  const [mfaUnenrollLoading, setMfaUnenrollLoading] = useState(false);

  // ── Password state ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // ── Fetch talent key on mount ──────────────────────────────────────────────
  useEffect(() => {
    const fetchTalentKey = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: keyData, error } = await supabase
          .from("access_keys")
          .select("raw_key")
          .eq("type", "talent_page")
          .is("user_id", null)
          .single();

        if (!error && keyData?.raw_key) {
          setTalentKey(keyData.raw_key);
        }
      } catch (error) {
        console.error("Error fetching talent key:", error);
        wallsToast.error("Error", "Failed to load talent key");
      } finally {
        setTalentKeyLoading(false);
      }
    };

    fetchTalentKey();
  }, []);

  // ── Fetch MFA factors on mount ─────────────────────────────────────────────
  useEffect(() => {
    const fetchMfaFactors = async () => {
      if (!user?.id) {
        setMfaLoading(false);
        return;
      }
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) {
          setMfaFactors({ totp: [] });
        } else {
          setMfaFactors(data ?? { totp: [] });
        }
      } catch {
        setMfaFactors({ totp: [] });
      } finally {
        setMfaLoading(false);
      }
    };
    fetchMfaFactors();
  }, [user?.id]);

  const totpFactors = mfaFactors?.totp ?? [];
  const verifiedTotpFactors = totpFactors.filter((f) => (f.status ?? "verified") === "verified");
  const hasMfaEnrolled = verifiedTotpFactors.length > 0;

  const refreshMfaFactors = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) setMfaFactors(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshAuthSession = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.refreshSession();
    } catch {
      // ignore
    }
  }, []);

  const openMfaEnroll = async () => {
    setMfaEnrollError("");
    setEnrollVerifyCode("");
    setEnrollFactorId("");
    setEnrollQrCode("");
    setEnrollSecret("");
    setEnrollTotpUri("");
    setMfaEnrollOpen(true);
    setMfaEnrollLoading(true);
    try {
      const supabase = getSupabaseClient();
      // Make sure we aren't working off a stale JWT / stale factor list after toggling MFA.
      await refreshAuthSession();
      await refreshMfaFactors();

      const { data: latestFactors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (!listErr && latestFactors) {
        setMfaFactors(latestFactors);
      }

      const latestTotp = (latestFactors?.totp ?? mfaFactors?.totp ?? []) as TotpFactor[];
      const latestVerified = latestTotp.filter((f) => (f.status ?? "verified") === "verified");
      if (latestVerified.length > 0) {
        setMfaEnrollError("You already have 2FA set up. Your account is protected.");
        wallsToast.success("Two-factor authentication", "You already have 2FA set up. Your account is protected.");
        return;
      }

      const baseFriendly = user?.email?.trim() || "WALLS";
      const friendlyCandidates = [
        baseFriendly,
        `${baseFriendly} (${new Date().getFullYear()})`,
        `${baseFriendly} (${crypto.randomUUID().slice(0, 8)})`,
      ];

      let data: Awaited<ReturnType<typeof supabase.auth.mfa.enroll>>["data"] | null = null;
      let lastError: { message?: string } | null = null;

      for (const friendlyName of friendlyCandidates) {
        const res = await supabase.auth.mfa.enroll({
          factorType: "totp",
          issuer: "WALLS",
          friendlyName,
        });
        lastError = res.error;
        if (!res.error) {
          data = res.data;
          break;
        }

        const msg = res.error.message ?? "";
        const duplicateName = /factor with the friendly name/i.test(msg);
        if (duplicateName) continue;

        const alreadyExists = /already exists/i.test(msg);
        if (alreadyExists) {
          await refreshMfaFactors();
          setMfaEnrollError("You already have 2FA set up. Your account is protected.");
          wallsToast.success("Two-factor authentication", "You already have 2FA set up. Your account is protected.");
          return;
        }

        setMfaEnrollError(msg);
        return;
      }

      const error = lastError;
      if (error) {
        const msg = error.message ?? "";
        if (/already exists|factor with the friendly name/i.test(msg)) {
          await refreshMfaFactors();
          setMfaEnrollError("You already have 2FA set up. Your account is protected.");
          wallsToast.success("Two-factor authentication", "You already have 2FA set up. Your account is protected.");
          return;
        }
        setMfaEnrollError(msg);
        return;
      }
      if (data?.type === "totp") {
        if (data.id) setEnrollFactorId(data.id);
        if (data.totp?.qr_code) setEnrollQrCode(data.totp.qr_code);
        if (data.totp?.secret) {
          setEnrollSecret(data.totp.secret);
          const label = `WALLS:${user?.email ?? "Account"}`;
          setEnrollTotpUri(
            `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(data.totp.secret)}&issuer=WALLS`
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start enrollment";
      if (/already exists|factor with the friendly name/i.test(msg)) {
        await refreshAuthSession();
        await refreshMfaFactors();
        setMfaEnrollError("You already have 2FA set up. Your account is protected.");
        wallsToast.success("Two-factor authentication", "You already have 2FA set up. Your account is protected.");
        return;
      }
      setMfaEnrollError(msg);
    } finally {
      setMfaEnrollLoading(false);
    }
  };

  const confirmMfaEnroll = async (submittedCode?: string) => {
    const code = (submittedCode ?? enrollVerifyCode).replace(/\D/g, "").trim();
    if (!enrollFactorId || !code) {
      setMfaEnrollError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setMfaEnrollError("");
    setMfaEnrollVerifying(true);
    try {
      const supabase = getSupabaseClient();
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (challengeError) {
        setMfaEnrollError(challengeError.message);
        return;
      }
      const challengeId = challengeData?.id;
      if (!challengeId) {
        setMfaEnrollError("Invalid challenge response.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId,
        code,
      });
      if (verifyError) {
        setMfaEnrollError(verifyError.message);
        return;
      }
      setMfaEnrollOpen(false);
      await refreshAuthSession();
      await refreshMfaFactors();
      wallsToast.success("Two-factor authentication enabled", "Your account is now protected with 2FA.");
    } catch (err) {
      setMfaEnrollError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setMfaEnrollVerifying(false);
    }
  };

  const handleMfaUnenroll = async () => {
    const totpFactor = verifiedTotpFactors[0] ?? totpFactors[0];
    if (!totpFactor?.id) return;
    setMfaUnenrollLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) {
        wallsToast.error("Error", error.message);
        return;
      }
      setMfaFactors((prev) => ({ ...prev, totp: (prev?.totp ?? []).filter((f) => f.id !== totpFactor.id) }));
      await refreshAuthSession();
      await refreshMfaFactors();
      wallsToast.success("Two-factor authentication disabled", "You can turn it back on anytime from this page.");
    } catch (err) {
      wallsToast.error("Error", err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setMfaUnenrollLoading(false);
    }
  };

  const handleMfaTileClick = async () => {
    if (mfaLoading || mfaEnrollLoading || mfaUnenrollLoading) return;
    if (hasMfaEnrolled) {
      if (
        !window.confirm(
          "Turn off two-factor authentication? You can set it up again anytime from this page."
        )
      ) {
        return;
      }
      await handleMfaUnenroll();
      return;
    }
    await openMfaEnroll();
  };

  // ── Password reset ─────────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Re-authenticate with current password before updating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError("Current password is incorrect.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
        return;
      }

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      wallsToast.success("Password updated", "Your password has been changed.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const copyTalentKey = () => {
    if (talentKeyLoading || !talentKey) return;
    navigator.clipboard
      .writeText(talentKey)
      .then(() => {
        wallsToast.success("", "Talent key copied to clipboard");
      })
      .catch(() => {
        wallsToast.error("Error", "Failed to copy talent key to clipboard");
      });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-none bg-gray-50">
      <div className="w-full">
        <div className="max-w-5xl mx-auto px-8 pb-8">
          <div className="mb-8 pt-8">
            <h1 className="text-3xl font-bold text-foreground">Security &amp; Privacy</h1>
            <p className="text-sm font-light text-neutral-500">
              Manage two-factor authentication, your password, and your talent key.
            </p>
          </div>

          <div className="space-y-8">

            {/* Talent key */}
            <div className="flex items-center mb-8">
              <span className="text-black font-black text-4xl mr-4">Talent key</span>
              <div className="flex-1 border-t border-black h-[1px]" />
            </div>

            <section className="space-y-4">
              <p className="text-sm font-light text-neutral-500">
                This key is required for accessing the talent roster. It changes on the first of every month.
              </p>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTalentKey(!showTalentKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-foreground transition-colors z-10"
                  disabled={talentKeyLoading}
                >
                  {showTalentKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <input
                  type={showTalentKey ? "text" : "password"}
                  value={talentKeyLoading ? "Loading..." : talentKey}
                  readOnly
                  className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-800 font-normal pl-10 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent cursor-not-allowed opacity-75"
                  disabled={talentKeyLoading}
                />
                <button
                  type="button"
                  onClick={copyTalentKey}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-foreground transition-colors z-10"
                  disabled={talentKeyLoading}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </section>

            {/* Two-factor authentication */}
            <div className="flex items-center mb-8 mt-8">
              <span className="text-black font-black text-4xl mr-4">Two-factor authentication</span>
              <div className="flex-1 border-t border-black h-[1px]" />
            </div>

            <section className="space-y-4">
              <p className="text-sm font-light text-neutral-500">
                Add an extra layer of security to your account using an authenticator app.
              </p>

              <div className="py-5 sm:py-6">
              {mfaLoading ? (
                <Skeleton className="mx-auto h-36 w-full max-w-[720px] rounded-[44px]" />
              ) : (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void handleMfaTileClick()}
                    disabled={mfaEnrollLoading || mfaUnenrollLoading}
                    className={cn(
                      "group w-full max-w-[720px] cursor-pointer select-none text-left",
                      "rounded-[44px] border border-dashed border-neutral-300/80 bg-transparent",
                      "px-8 py-9 transition-all duration-200 ease-out sm:px-10 sm:py-10",
                      "hover:bg-neutral-100/70 hover:backdrop-blur-md hover:border-neutral-300/70 hover:shadow-[inset_0_10px_24px_rgba(0,0,0,0.10)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--walls-sky)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50",
                      (mfaEnrollLoading || mfaUnenrollLoading) && "pointer-events-none opacity-75"
                    )}
                  >
                    <div className="flex w-full flex-col items-center justify-center gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                      <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
                        {hasMfaEnrolled ? (
                          <ShieldCheck className="h-6 w-6 shrink-0 text-green-700" strokeWidth={1.5} />
                        ) : (
                          <Shield className="h-6 w-6 shrink-0 text-neutral-500" strokeWidth={1.5} />
                        )}
                        <div className="min-w-0">
                          <p className="text-base font-light tracking-tight text-neutral-900 sm:text-lg">
                            {hasMfaEnrolled ? (
                              <>
                                2FA is <span className="font-light text-green-700">enabled</span>
                              </>
                            ) : (
                              "Set up 2FA"
                            )}
                          </p>
                          <p className="mt-1 text-xs font-light leading-relaxed text-neutral-500 sm:text-sm">
                            {hasMfaEnrolled
                              ? "Authenticator app codes protect your account. Tap to turn off two-factor authentication."
                              : "Use an authenticator app and a QR code. Tap here to begin setup."}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-center text-xs font-light text-neutral-400 sm:justify-end">
                        {mfaEnrollLoading || mfaUnenrollLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" strokeWidth={1.5} />
                        ) : hasMfaEnrolled ? (
                          <span className="tracking-wide">Tap to disable</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 tracking-wide">
                            Connect
                            <Plug className="h-3.5 w-3.5 rotate-45 text-neutral-400" strokeWidth={2} aria-hidden />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              )}
              </div>
            </section>

            {/* Change password */}
            <div className="flex items-center mb-8 mt-8">
              <span className="text-black font-black text-4xl mr-4">Change password</span>
              <div className="flex-1 border-t border-black h-[1px]" />
            </div>

            <section className="space-y-4">
              <p className="text-sm font-light text-neutral-500">
                Choose a strong password and don&apos;t reuse it for other accounts.
              </p>

              <div className="space-y-3">
                {/* Current password */}
                <div className="space-y-1.5">
                  <Label htmlFor="current-password" className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                    Current password
                  </Label>
                  <div className="relative">
                    <input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={passwordLoading}
                      placeholder="••••••••"
                      className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-800 font-normal px-4 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-foreground transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                New password
              </Label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                  placeholder="••••••••"
                  className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-800 font-normal px-4 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm new password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                Confirm new password
              </Label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                  placeholder="••••••••"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !passwordLoading) handlePasswordChange();
                  }}
                  className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-800 font-normal px-4 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {passwordError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {passwordSuccess}
              </p>
            )}

                <Button
                  type="button"
                  onClick={handlePasswordChange}
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="rounded-xl bg-walls-yellow text-neutral-900 hover:bg-walls-yellow/90 disabled:opacity-50"
                >
                  {passwordLoading ? "Updating…" : "Update password"}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <MultiFactorPopup
        open={mfaEnrollOpen}
        onOpenChange={setMfaEnrollOpen}
        error={mfaEnrollError}
        qrCode={enrollQrCode}
        secret={enrollSecret}
        customTotpUri={enrollTotpUri}
        verifyCode={enrollVerifyCode}
        onVerifyCodeChange={setEnrollVerifyCode}
        onConfirm={confirmMfaEnroll}
        verifying={mfaEnrollVerifying}
        enrollLoading={mfaEnrollLoading}
      />

      <Toaster />
    </div>
  );
}
