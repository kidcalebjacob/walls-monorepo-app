"use client";

import { AuthProvider } from "@walls/auth";

import { AppSidebarProvider } from "./app-sidebar-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppSidebarProvider>{children}</AppSidebarProvider>
    </AuthProvider>
  );
}
