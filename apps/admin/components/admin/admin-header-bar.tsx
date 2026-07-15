"use client";

import { useAuth, buildPortalLoginUrl } from "@/lib/auth";
import UserProfileButton from "@/components/ui/user-profile-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense, useEffect, useState } from "react";

function UserProfileButtonSkeleton() {
  return (
    <div
      className="relative my-auto h-14 w-auto px-4 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 animate-pulse"
      aria-hidden
    >
      <div className="flex items-center gap-4 h-full">
        <div className="w-[25px] h-[25px] rounded bg-neutral-200/80 shrink-0" />
        <div className="w-[40px] h-[40px] rounded-full bg-neutral-200/80 shrink-0" />
      </div>
    </div>
  );
}

export default function AdminHeaderBar() {
  const { user, isLoading } = useAuth();
  const [loginHref, setLoginHref] = useState("#");

  useEffect(() => {
    setLoginHref(
      buildPortalLoginUrl(window.location.origin, {
        redirect: window.location.href,
      }),
    );
  }, []);

  return (
    <div className="w-full bg-transparent">
      <div className="flex min-h-16 items-center justify-between px-5 py-3">
        <div
          id="admin-header-left"
          className="min-w-0 flex-1"
          aria-label="Page title"
        />
        {isLoading ? (
          <div className="flex items-center gap-4 shrink-0">
            <UserProfileButtonSkeleton />
          </div>
        ) : user !== null ? (
          <div className="flex items-center gap-4 shrink-0">
            <Suspense fallback={<UserProfileButtonSkeleton />}>
              <UserProfileButton />
            </Suspense>
          </div>
        ) : (
          <Link href={loginHref} className="shrink-0">
            <Button
              variant="outline"
              className="relative min-w-[125px] h-10 rounded-full bg-background text-foreground border-border"
            >
              <p className="font-bold">Login</p>
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
