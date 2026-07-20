"use client";

import * as React from "react";
import { Building2, Check, ChevronDown, Plus, User } from "lucide-react";

import { useAuth } from "@walls/auth";
import { cn } from "@walls/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useActiveAccount,
  type ProjectsAccount,
} from "./active-account-context";

const SETTINGS_URL =
  process.env.NEXT_PUBLIC_SETTINGS_URL?.replace(/\/$/, "") ?? "";

/** Matches the loaded switcher layout so the header does not jump. */
function AccountSwitcherSkeleton() {
  return (
    <div
      className="mt-2 flex min-w-0 max-w-[min(100vw-8rem,280px)] items-center gap-3 rounded-xl bg-kenoo-white px-3 py-2.5"
      aria-busy="true"
      aria-label="Loading accounts"
    >
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg bg-neutral-100" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-28 rounded bg-neutral-100" />
        <Skeleton className="h-3 w-16 rounded bg-neutral-100" />
      </div>
      <Skeleton className="h-4 w-4 shrink-0 rounded bg-neutral-100" />
    </div>
  );
}

/**
 * Header account switcher — store-style picker for the active WALLS account.
 * Selection is persisted via `/api/accounts` cookie, then the page reloads.
 */
export function AccountSwitcher() {
  const { accounts, activeAccountId, loading, setActiveAccountId } =
    useActiveAccount();
  const [open, setOpen] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);

  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  const handleSelect = async (accountId: string) => {
    const target = accounts.find((account) => account.id === accountId);
    if (
      !target ||
      target.hasAppAccess === false ||
      accountId === activeAccountId ||
      switching
    ) {
      return;
    }
    setSwitching(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) {
        setSwitching(false);
        return;
      }
      setActiveAccountId(accountId);
      setOpen(false);
      // Client pages fetch their data on mount (no shared query cache), so a
      // full reload is required to drop stale data from the previous account.
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  };

  if (loading) {
    return <AccountSwitcherSkeleton />;
  }

  if (!activeAccount || accounts.length < 2) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={switching}
          className={cn(
            "mt-2 flex min-w-0 max-w-[min(100vw-8rem,280px)] items-center gap-3 rounded-xl bg-kenoo-white px-3 py-2.5 text-left transition",
            "hover:bg-kenoo-white",
            "focus:outline-none",
            "disabled:opacity-60",
            open && "bg-kenoo-white",
          )}
        >
          <AccountAvatar account={activeAccount} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {activeAccount.name}
            </span>
            <AccountTypeBadge account={activeAccount} className="mt-0.5" />
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="z-[110] w-[min(100vw-2rem,320px)] rounded-2xl border-0 bg-kenoo-white p-2 shadow-xl"
      >
        <p className="px-2 pb-1 pt-1 text-sm font-medium text-neutral-500">
          Choose an account
        </p>

        <div className="mt-1 space-y-0.5">
          {accounts.map((account) => {
            const isActive = account.id === activeAccount.id;
            const hasAppAccess = account.hasAppAccess !== false;
            return (
              <DropdownMenuItem
                key={account.id}
                disabled={!hasAppAccess}
                onSelect={(event) => {
                  event.preventDefault();
                  if (!hasAppAccess) return;
                  void handleSelect(account.id);
                }}
                className={cn(
                  "rounded-xl p-2 transition-colors focus:bg-transparent",
                  hasAppAccess
                    ? cn(
                        "cursor-pointer",
                        isActive ? "bg-neutral-100" : "hover:bg-kenoo-white",
                      )
                    : "cursor-not-allowed opacity-50 data-[disabled]:opacity-50",
                )}
                title={
                  hasAppAccess
                    ? undefined
                    : "This account does not have access to Projects"
                }
              >
                <div className="flex w-full items-center gap-3">
                  <AccountAvatar account={account} size="md" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm text-foreground",
                        isActive ? "font-semibold" : "font-medium",
                        !hasAppAccess && "text-neutral-500",
                      )}
                    >
                      {account.name}
                    </p>
                    {hasAppAccess ? (
                      <AccountTypeBadge
                        account={account}
                        className="mt-0.5"
                      />
                    ) : (
                      <span className="mt-0.5 block text-xs text-neutral-400">
                        No Projects access
                      </span>
                    )}
                  </div>
                  {isActive ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-foreground"
                      strokeWidth={2.75}
                    />
                  ) : null}
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>

        {SETTINGS_URL ? (
          <>
            <DropdownMenuSeparator className="my-2 bg-neutral-100" />
            <DropdownMenuItem asChild className="rounded-xl p-0 focus:bg-transparent">
              <a
                href={`${SETTINGS_URL}/organization`}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm text-foreground hover:bg-kenoo-white"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-kenoo-white text-neutral-500">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="font-medium">Manage accounts</span>
              </a>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function accountIconTone(account: ProjectsAccount) {
  if (account.accountType === "organization") {
    return {
      container: "bg-violet-100 text-violet-700",
    };
  }
  return {
    container: "bg-neutral-100 text-neutral-600",
  };
}

function AccountAvatar({
  account,
  size = "md",
}: {
  account: ProjectsAccount;
  size?: "md" | "sm";
}) {
  const { profile } = useAuth();
  const tone = accountIconTone(account);
  const boxClass =
    size === "md" ? "h-10 w-10 rounded-lg" : "h-8 w-8 rounded-md";

  const imageUrl =
    account.iconUrl ??
    (account.accountType === "personal" ? (profile?.avatarUrl ?? null) : null);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote account icons
      <img
        src={imageUrl}
        alt=""
        className={cn(boxClass, "shrink-0 object-cover")}
      />
    );
  }

  const Icon = account.accountType === "organization" ? Building2 : User;
  const initial = account.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        boxClass,
        tone.container,
      )}
    >
      {account.accountType === "organization" ? (
        <Icon className="h-5 w-5" />
      ) : (
        <span className="text-sm">{initial}</span>
      )}
    </span>
  );
}

function AccountTypeBadge({
  account,
  className,
}: {
  account: ProjectsAccount;
  className?: string;
}) {
  const label =
    account.accountType === "organization" ? "Organization" : "Account";

  return (
    <span className={cn("block text-xs text-neutral-500", className)}>
      {label}
    </span>
  );
}
