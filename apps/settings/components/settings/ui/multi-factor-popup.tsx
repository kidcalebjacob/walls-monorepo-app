"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Check, Copy, Shield, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { QRCode } from "@/components/ui/qr-code";

/** Build a stable image URL from Supabase QR (SVG string). Uses Blob URL so the QR displays reliably. */
function useQrImageUrl(qrCode: string): string | null {
  return useMemo(() => {
    if (!qrCode || typeof qrCode !== "string") return null;
    const trimmed = qrCode.trim();
    if (trimmed.startsWith("data:")) return trimmed;
    if (trimmed.startsWith("<") || trimmed.includes("<svg")) {
      try {
        const blob = new Blob([trimmed], { type: "image/svg+xml;charset=utf-8" });
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    }
    return null;
  }, [qrCode]);
}

function useRevokeObjectUrl(url: string | null) {
  useEffect(() => {
    if (url && url.startsWith("blob:")) {
      return () => URL.revokeObjectURL(url);
    }
  }, [url]);
}

/** Flush with dialog bg until hover — matches talent settings floating save / revert controls */
const mfaFooterButtonClass =
  "group inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out border border-transparent bg-transparent hover:bg-kenoo-white hover:border hover:border-neutral-200 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

const otpBoxClass =
  "flex h-16 w-12 shrink-0 items-center justify-center gap-0.5 rounded-xl border border-neutral-200/50 bg-neutral-100 font-mono text-xl text-foreground shadow-inner backdrop-blur-md";

export interface MultiFactorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: string;
  qrCode: string;
  secret: string;
  /** When set, we render a QR from this otpauth URI (e.g. issuer=WALLS) instead of Supabase's qr_code. */
  customTotpUri?: string;
  verifyCode: string;
  onVerifyCodeChange: (value: string) => void;
  /** Pass the 6-digit code when calling from the OTP input so verify uses the latest digits (parent state may not have flushed yet). */
  onConfirm: (code?: string) => void | Promise<void>;
  verifying: boolean;
  /** True while the QR code is being fetched (popup just opened). */
  enrollLoading?: boolean;
}

export function MultiFactorPopup({
  open,
  onOpenChange,
  error,
  qrCode,
  secret,
  customTotpUri,
  verifyCode,
  onVerifyCodeChange,
  onConfirm,
  verifying,
  enrollLoading = false,
}: MultiFactorPopupProps) {
  const qrImageUrl = useQrImageUrl(qrCode);
  useRevokeObjectUrl(qrImageUrl);
  const mfaInputRef = useRef<HTMLInputElement>(null);
  const [mfaInputFocused, setMfaInputFocused] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const secretCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      if (secretCopiedTimerRef.current) clearTimeout(secretCopiedTimerRef.current);
      secretCopiedTimerRef.current = setTimeout(() => {
        setSecretCopied(false);
        secretCopiedTimerRef.current = null;
      }, 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  useEffect(() => {
    return () => {
      if (secretCopiedTimerRef.current) clearTimeout(secretCopiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || enrollLoading || (!qrCode && !customTotpUri)) return;
    const id = window.setTimeout(() => mfaInputRef.current?.focus(), 100);
    return () => window.clearTimeout(id);
  }, [open, enrollLoading, qrCode, customTotpUri]);

  const qrValue = useMemo(() => {
    if (enrollLoading) return null;
    if (customTotpUri?.trim()) return customTotpUri.trim();
    const raw = (qrCode ?? "").trim();
    if (!raw) return null;
    if (raw.startsWith("data:")) return null;
    if (raw.startsWith("<") || raw.includes("<svg")) return null;
    // Only treat as a QR payload if it looks like a normal string URI/text (not binary-ish).
    if (raw.length > 2048) return null;
    if (/[^\s\w\-./:?&=%+#;,@()[\]{}_~]/.test(raw)) return null;
    return raw;
  }, [customTotpUri, enrollLoading, qrCode]);

  const handleClose = () => {
    if (!verifying) {
      onOpenChange(false);
    }
  };

  const qrSize = 220;

  const qrBlock =
    qrValue ? (
      <QRCode
        value={qrValue}
        size={qrSize}
        fgColor="rgb(23 23 23)"
        bgColor="rgb(255 255 255)"
        errorCorrectionLevel="M"
        className="mx-auto"
      />
    ) : qrCode?.trim() && !qrImageUrl ? (
      <QRCodeSVG
        value={qrCode.trim()}
        size={qrSize}
        level="M"
        includeMargin={false}
        className="mx-auto"
        aria-label="QR code for authenticator app"
      />
    ) : qrImageUrl ? (
      <img
        src={qrImageUrl}
        alt="QR code for authenticator app"
        className="h-[220px] w-[220px] object-contain"
      />
    ) : (
      <div
        className="h-[220px] w-[220px] [&>svg]:h-full [&>svg]:w-full [&>svg]:max-h-full [&>svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: qrCode }}
        role="img"
        aria-label="QR code for authenticator app"
      />
    );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex w-[calc(100%-1.5rem)] max-w-[min(720px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-neutral-200/60 bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-0 gap-0 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:max-w-[720px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_100%_40%,rgba(0,0,0,0.06),transparent_55%)]" />

        <div className="relative flex min-h-[min(420px,85vh)] flex-col md:min-h-[380px] md:flex-row">
          {/* Left: QR */}
          <div className="flex flex-col items-center justify-center border-b border-neutral-200/60 bg-gradient-to-b from-neutral-100/90 to-neutral-50/50 px-6 py-8 md:w-[40%] md:min-w-[240px] md:shrink-0 md:border-b-0 md:border-r md:py-10">
            {enrollLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-4">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
                <p className="text-center text-sm font-light text-neutral-500">Getting your QR code…</p>
              </div>
            ) : (qrCode || customTotpUri) ? (
              <>
                <div className="rounded-[28px] bg-gradient-to-br from-white via-white to-neutral-100 p-2 shadow-[0_18px_55px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
                  <div className="rounded-[22px] bg-white/80 p-3 shadow-inner ring-1 ring-neutral-200/60">{qrBlock}</div>
                </div>
                <div className="mt-4 flex max-w-[220px] flex-col items-center gap-1.5 text-center">
                  <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">Scan QR</p>
                  <p className="text-xs font-light leading-relaxed text-neutral-500">
                    Scan with your authenticator app to link this account.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* Right: copy, secret, code, actions — footer pinned toward dialog bottom */}
          <div className="flex min-h-0 flex-1 flex-col px-6 pt-6 pb-4 md:px-8 md:pt-8 md:pb-5">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-foreground">2FA Setup</h3>
                <p className="mt-2 text-xs font-light leading-relaxed text-neutral-500">
                  Scan with your Authenticator app to setup 2FA
                </p>
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              {secret && !enrollLoading && (
                <div className="space-y-2">
                  <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">Manual Backup Code</p>
                  <div className="flex min-h-14 w-full items-center gap-2 rounded-xl border border-neutral-200/50 bg-neutral-100 px-2.5 py-2 shadow-inner backdrop-blur-md">
                    <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap select-all font-mono text-[13px] leading-tight tracking-tight text-neutral-500 sm:text-sm">
                      {secret}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopySecret()}
                      disabled={verifying}
                      className="shrink-0 rounded-md p-1.5 text-neutral-600 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300/80 focus-visible:ring-offset-0 disabled:opacity-50"
                      aria-label={secretCopied ? "Copied" : "Copy backup code"}
                    >
                      {secretCopied ? (
                        <Check className="h-4 w-4 text-green-600" strokeWidth={2.5} />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-light leading-relaxed text-neutral-500">
                    Use this code if you are unable to scan the QR graphic
                  </p>
                </div>
              )}

              {(qrCode || customTotpUri) && !enrollLoading && (
                <div className="space-y-2">
                  <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">Verification code</p>
                  <div className="flex justify-center md:justify-start" role="group" aria-label="Verification code">
                    <input
                      ref={mfaInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={verifyCode}
                      onFocus={() => setMfaInputFocused(true)}
                      onBlur={() => setMfaInputFocused(false)}
                      onChange={(e) => {
                        const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                        onVerifyCodeChange(next);
                        if (next.length === 6 && !verifying) void onConfirm(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !verifying) {
                          const fromInput =
                            mfaInputRef.current?.value.replace(/\D/g, "").slice(0, 6) ?? verifyCode;
                          void onConfirm(fromInput);
                        }
                      }}
                      disabled={verifying}
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
                        const isCursorHere = mfaInputFocused && i === verifyCode.length;
                        return (
                          <div key={i} className={otpBoxClass}>
                            <span>{verifyCode[i] ?? ""}</span>
                            {isCursorHere && (
                              <span
                                className="inline-block h-6 w-1 flex-shrink-0 animate-caret-blink bg-foreground"
                                aria-hidden
                              />
                            )}
                          </div>
                        );
                      })}
                      <span className="mx-0.5 text-lg font-light text-neutral-400" aria-hidden>
                        -
                      </span>
                      {[3, 4, 5].map((i) => {
                        const isCursorHere = mfaInputFocused && i === verifyCode.length;
                        return (
                          <div key={i} className={otpBoxClass}>
                            <span>{verifyCode[i] ?? ""}</span>
                            {isCursorHere && (
                              <span
                                className="inline-block h-6 w-1 flex-shrink-0 animate-caret-blink bg-foreground"
                                aria-hidden
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto flex items-center justify-end gap-2 border-t border-neutral-200/40 pt-3 md:border-t-0 md:pt-2">
              <button type="button" onClick={handleClose} disabled={verifying} className={mfaFooterButtonClass}>
                <X className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-red-600/60" />
                <span className="text-sm font-normal text-neutral-800 transition-colors group-hover:text-red-600/60">
                  Cancel
                </span>
              </button>
              {(qrCode || customTotpUri) && (
                <button
                  type="button"
                  onClick={() => void onConfirm(verifyCode)}
                  disabled={verifying || !verifyCode.trim()}
                  className={mfaFooterButtonClass}
                >
                  {verifying ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
                      <span className="text-sm font-normal text-neutral-800">Verifying…</span>
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-green-600/60" />
                      <span className="text-sm font-normal text-neutral-800">Enable 2FA</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
