"use client";

import * as React from "react";

import type { OrganizationSummary } from "@/lib/ad-scope";

export type OrganizationOption = OrganizationSummary;

type OrganizationContextValue = {
  organizations: OrganizationOption[];
  activeOrganizationId: string | null;
  activeOrganization: OrganizationOption | null;
  loading: boolean;
  setActiveOrganizationId: (organizationId: string | null) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
};

const OrganizationContext = React.createContext<OrganizationContextValue | null>(
  null,
);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organizations, setOrganizations] = React.useState<OrganizationOption[]>(
    [],
  );
  const [activeOrganizationId, setActiveOrganizationIdState] = React.useState<
    string | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  const refreshOrganizations = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/organizations", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        organizations?: OrganizationOption[];
        activeOrganizationId?: string | null;
      };

      setOrganizations(payload.organizations ?? []);
      setActiveOrganizationIdState(payload.activeOrganizationId ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  const setActiveOrganizationId = React.useCallback(
    async (organizationId: string | null) => {
      const response = await fetch("/api/organizations/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as {
        activeOrganizationId?: string | null;
      };

      setActiveOrganizationIdState(payload.activeOrganizationId ?? null);
      await refreshOrganizations();
    },
    [refreshOrganizations],
  );

  const activeOrganization = React.useMemo(
    () =>
      activeOrganizationId
        ? organizations.find(
            (organization) => organization.id === activeOrganizationId,
          ) ?? null
        : null,
    [activeOrganizationId, organizations],
  );

  const value = React.useMemo(
    () => ({
      organizations,
      activeOrganizationId,
      activeOrganization,
      loading,
      setActiveOrganizationId,
      refreshOrganizations,
    }),
    [
      organizations,
      activeOrganizationId,
      activeOrganization,
      loading,
      setActiveOrganizationId,
      refreshOrganizations,
    ],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext(): OrganizationContextValue {
  const context = React.useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganizationContext must be used within OrganizationProvider",
    );
  }
  return context;
}
