"use client";

import { AuthProvider } from "@walls/auth";

import { ActiveAccountProvider } from "./active-account-context";
import { AppSidebarProvider } from "./app-sidebar-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ActiveAccountProvider>
        <AppSidebarProvider>{children}</AppSidebarProvider>
      </ActiveAccountProvider>
    </AuthProvider>
  );
}
