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

type InviteSessionType = "invite" | "recovery" | "signup" | "magiclink";

function isInviteSessionType(value: string | null): value is InviteSessionType {
  return (
    value === "invite" ||
    value === "recovery" ||
    value === "signup" ||
    value === "magiclink"
  );
}

export default function CreatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);

  React.useEffect(() => {
    const bootstrapInviteSession = async () => {
      const supabase = getSupabaseClient();
      setError(null);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");
      const tokenHash =
        queryParams.get("token_hash") ?? hashParams.get("token_hash");
      const queryType = queryParams.get("type") ?? hashParams.get("type");

      if (accessToken && isInviteSessionType(hashType)) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (sessionError || !data.session) {
          setError("Invalid or expired invite link. Please ask for a new invite.");
          setIsBootstrapping(false);
          return;
        }

        setIsReady(true);
        window.history.replaceState({}, "", "/create-password");
        setIsBootstrapping(false);
        return;
      }

      if (tokenHash && isInviteSessionType(queryType)) {
        const otpType =
          queryType === "recovery"
            ? "recovery"
            : queryType === "signup"
              ? "signup"
              : queryType === "magiclink"
                ? "magiclink"
                : "invite";

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });

        if (verifyError || !data.session) {
          setError("Invalid or expired invite link. Please ask for a new invite.");
          setIsBootstrapping(false);
          return;
        }

        setIsReady(true);
        window.history.replaceState({}, "", "/create-password");
        setIsBootstrapping(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setIsReady(true);
        setIsBootstrapping(false);
        return;
      }

      setError("Open the invite link from your email to create your password.");
      setIsBootstrapping(false);
    };

    void bootstrapInviteSession();
  }, []);

  const [handleCreatePassword, isCreating] = useLoadingCallback(async () => {
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

      setSuccess("Password created. Redirecting to your apps...");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
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
        title="Create password"
        description="Set a password to access the apps available to your organization."
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

        {isBootstrapping ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-kenoo-muted" />
          </div>
        ) : isReady ? (
          <>
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isCreating}
                className={authInputClassName}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !isCreating &&
                    password.trim() &&
                    confirmPassword.trim()
                  ) {
                    handleCreatePassword();
                  }
                }}
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isCreating}
                className={authInputClassName}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !isCreating &&
                    password.trim() &&
                    confirmPassword.trim()
                  ) {
                    handleCreatePassword();
                  }
                }}
              />
            </div>

            <Button
              onClick={handleCreatePassword}
              className={authPrimaryButtonClassName}
              disabled={
                isCreating || !password.trim() || !confirmPassword.trim()
              }
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Create password"
              )}
            </Button>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}
