"use client";

import { AuthProvider } from "@walls/auth";

import { ActiveAccountProvider } from "./active-account-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ActiveAccountProvider>{children}</ActiveAccountProvider>
    </AuthProvider>
  );
}
