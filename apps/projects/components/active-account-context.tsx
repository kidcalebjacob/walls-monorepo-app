"use client";

import * as React from "react";

export type ProjectsAccountType = "personal" | "organization";

export type ProjectsAccount = {
  id: string;
  name: string;
  accountType: ProjectsAccountType;
  iconUrl: string | null;
  role: string;
  isDefault: boolean;
  /** Whether the user can open Projects under this account. */
  hasAppAccess: boolean;
};

type ActiveAccountContextValue = {
  accounts: ProjectsAccount[];
  activeAccountId: string | null;
  activeAccount: ProjectsAccount | null;
  loading: boolean;
  setActiveAccountId: (accountId: string) => void;
};

const ActiveAccountContext =
  React.createContext<ActiveAccountContextValue | null>(null);

export function ActiveAccountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accounts, setAccounts] = React.useState<ProjectsAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = React.useState<string | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/accounts");
        if (!response.ok) return;
        const payload = (await response.json()) as {
          accounts?: ProjectsAccount[];
          activeAccountId?: string | null;
        };
        if (cancelled) return;
        setAccounts(payload.accounts ?? []);
        setActiveAccountId(payload.activeAccountId ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ??
    accounts[0] ??
    null;

  const value = React.useMemo<ActiveAccountContextValue>(
    () => ({
      accounts,
      activeAccountId: activeAccount?.id ?? activeAccountId,
      activeAccount,
      loading,
      setActiveAccountId,
    }),
    [accounts, activeAccount, activeAccountId, loading],
  );

  return (
    <ActiveAccountContext.Provider value={value}>
      {children}
    </ActiveAccountContext.Provider>
  );
}

export function useActiveAccount(): ActiveAccountContextValue {
  const ctx = React.useContext(ActiveAccountContext);
  if (!ctx) {
    throw new Error(
      "useActiveAccount must be used within ActiveAccountProvider",
    );
  }
  return ctx;
}
