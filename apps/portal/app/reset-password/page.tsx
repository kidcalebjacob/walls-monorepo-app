"use client";

import * as React from "react";
import { useLoadingCallback } from "react-loading-hook";
import { Loader2, ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@walls/auth";
import { Button } from "@walls/ui/button";
import { Input } from "@walls/ui/input";
import { Separator } from "@walls/ui/separator";

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

      setSuccess("Password reset email sent! Please check your inbox.");
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

      setSuccess("Password reset successfully! Redirecting to login...");

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
    <div className="flex h-screen bg-walls-white">
      <div className="absolute top-4 right-4 pr-6">
        <Button
          onClick={() => router.push("/login")}
          variant="ghost"
          className="group flex items-center gap-2 text-black hover:bg-transparent hover:text-black transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-black group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="text-black font-light">Back to login</span>
        </Button>
      </div>

      <div className="hidden md:flex w-1/2 relative bg-walls-yellow rounded-r-[150px] items-center justify-center shadow-inner border border-neutral-200/50">
        <Image
          src="https://assets.wallsentertainment.com/logo-variations/black-gradient-indented.png"
          alt="WALLS Logo"
          width={400}
          height={400}
          className="object-contain"
        />
      </div>

      <div className="md:hidden flex justify-center">
        <Separator orientation="horizontal" className="w-full bg-border/50" />
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="text-center max-w-md w-full space-y-8">
          <div className="space-y-2 flex items-center justify-center">
            <Image
              src="https://assets.wallsentertainment.com/logo-variations/black-gradient-indented.png"
              alt="WALLS Logo"
              width={65}
              height={65}
              className="mr-4 mt-2 md:hidden"
            />
            <h1 className="text-6xl font-bold tracking-tight">
              Reset Password.
            </h1>
          </div>

          <div className="space-y-4 w-full">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-700 text-sm">
                {success}
              </div>
            )}

            {isResetMode ? (
              <>
                <div className="space-y-4">
                  <Input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isResetLoading}
                    className="h-12 bg-walls-white backdrop-blur-md shadow-inner border border-neutral-200/50 transition-all duration-300"
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
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isResetLoading}
                    className="h-12 bg-walls-white backdrop-blur-md shadow-inner border border-neutral-200/50 transition-all duration-300"
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
                  className="w-full rounded-full font-bold text-xl h-16 bg-walls-yellow/80 hover:bg-walls-yellow/90 text-black transition-all duration-300 shadow-inner border border-neutral-200/50 relative z-10"
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
                    "Reset Password"
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isRequestLoading}
                    className="h-12 bg-walls-white backdrop-blur-md shadow-inner border border-neutral-200/50 transition-all duration-300"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isRequestLoading && email.trim()) {
                        handleRequestReset();
                      }
                    }}
                  />
                </div>

                <Button
                  onClick={handleRequestReset}
                  className="w-full rounded-full font-bold text-xl h-16 bg-walls-yellow/80 hover:bg-walls-yellow/90 text-black transition-all duration-300 shadow-inner border border-neutral-200/50 relative z-10"
                  disabled={isRequestLoading || !email.trim()}
                >
                  {isRequestLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </>
            )}

            {isResetMode && (
              <p className="text-xs text-muted-foreground">
                Enter your new password below.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
