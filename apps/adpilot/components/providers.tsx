"use client";

import { AuthProvider } from "@walls/auth";

import { AppSidebarProvider } from "./app-sidebar-context";
import { OrganizationProvider } from "./organization-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <AppSidebarProvider>{children}</AppSidebarProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}
