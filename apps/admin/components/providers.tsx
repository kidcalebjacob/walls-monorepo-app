"use client";

import { AuthProvider } from "@walls/auth";

import { ActiveAccountProvider } from "./active-account-context";
import { AdminSidebarProvider } from "./admin/AdminSidebarContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ActiveAccountProvider>
        <AdminSidebarProvider>{children}</AdminSidebarProvider>
      </ActiveAccountProvider>
    </AuthProvider>
  );
}
