"use client";

import * as React from "react";
import { useLoadingCallback } from "react-loading-hook";
import { Loader2, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@walls/auth";
import { Button } from "@walls/ui/button";
import { Input } from "@walls/ui/input";

import {
  authGhostLinkClassName,
  authInputClassName,
  authPrimaryButtonClassName,
} from "@/components/kenoo/auth-field";
import { AuthHeading, AuthShell } from "@/components/kenoo/auth-shell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isResetMode, setIsResetMode] = React.useState(false);

  React.useEffect(() => {
    const checkForRecoveryToken = async () => {
      const supabase = getSupabaseClient();
      const hashParams = new URLSearchParams(
        window.location.hash.substring(1),
      );
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");

      if (accessToken && type === "recovery") {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get("refresh_token") || "",
        });

        if (sessionError) {
          setError("Invalid or expired reset link. Please request a new one.");
          return;
        }

        if (data.session) {
          setIsResetMode(true);
          window.history.replaceState({}, "", "/reset-password");
        }
      } else {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          setIsResetMode(true);
        }
      }
    };

    checkForRecoveryToken();
  }, []);

  const [handleRequestReset, isRequestLoading] = useLoadingCallback(async () => {
    try {
      setError(null);
      setSuccess(null);
      const supabase = getSupabaseClient();

      if (!email.endsWith("@wallsentertainment.com")) {
        throw new Error("Only @wallsentertainment.com emails are allowed");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess("Password reset email sent. Please check your inbox.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
    }
  });

  const [handleResetPassword, isResetLoading] = useLoadingCallback(async () => {
    try {
      setError(null);
      setSuccess(null);
      const supabase = getSupabaseClient();

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Password reset successfully. Redirecting to login...");

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
    }
  });

  return (
    <AuthShell
      topRight={
        <Button
          onClick={() => router.push("/login")}
          variant="ghost"
          className={authGhostLinkClassName}
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
          <span>Back to login</span>
        </Button>
      }
    >
      <AuthHeading
        title="Reset password"
        description={
          isResetMode
            ? "Choose a new password for your account."
            : "We’ll email you a link to reset your password."
        }
      />

      <div className="w-full space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {isResetMode ? (
          <>
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isResetLoading}
                className={authInputClassName}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !isResetLoading &&
                    password.trim() &&
                    confirmPassword.trim()
                  ) {
                    handleResetPassword();
                  }
                }}
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isResetLoading}
                className={authInputClassName}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !isResetLoading &&
                    password.trim() &&
                    confirmPassword.trim()
                  ) {
                    handleResetPassword();
                  }
                }}
              />
            </div>

            <Button
              onClick={handleResetPassword}
              className={authPrimaryButtonClassName}
              disabled={
                isResetLoading || !password.trim() || !confirmPassword.trim()
              }
            >
              {isResetLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </>
        ) : (
          <>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isRequestLoading}
              className={authInputClassName}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRequestLoading && email.trim()) {
                  handleRequestReset();
                }
              }}
            />

            <Button
              onClick={handleRequestReset}
              className={authPrimaryButtonClassName}
              disabled={isRequestLoading || !email.trim()}
            >
              {isRequestLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
