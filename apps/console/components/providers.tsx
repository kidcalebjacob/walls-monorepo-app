"use client";

import { AuthProvider } from "@walls/auth";

import { ConsoleSidebarProvider } from "./console/ConsoleSidebarContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConsoleSidebarProvider>{children}</ConsoleSidebarProvider>
    </AuthProvider>
  );
}
