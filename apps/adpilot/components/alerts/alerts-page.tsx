"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Check, ChevronDown, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@walls/ui/dropdown-menu";
import { cn } from "@walls/utils";

import { panelGlassClass } from "@/components/ui/button-styles";
import type {
  AccountMember,
  AdpilotAlertType,
  MemberAlertSubscription,
} from "@/lib/alert-subscriptions-server";

type ChannelState = {
  notifyEmail: boolean;
  notifySms: boolean;
};

function subscriptionKey(userId: string, alertKey: string) {
  return `${userId}::${alertKey}`;
}

function channelLabel(state: ChannelState, hasPhone: boolean) {
  const parts: string[] = [];
  if (state.notifyEmail) parts.push("Email");
  if (state.notifySms && hasPhone) parts.push("Text");
  if (parts.length === 0) return "None";
  return parts.join(" · ");
}

function MemberChannelSelect({
  member,
  state,
  saving,
  onChange,
}: {
  member: AccountMember;
  state: ChannelState;
  saving: boolean;
  onChange: (patch: Partial<ChannelState>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const hasPhone = Boolean(member.phoneNumber?.trim());

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          className={cn(
            "flex min-w-[8.5rem] items-center gap-2 rounded-xl border border-black/[0.06] bg-white/55 px-3 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl transition",
            "hover:bg-white/80 disabled:opacity-60",
            "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
            open && "bg-white/80",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {saving ? "Saving…" : channelLabel(state, hasPhone)}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-50 w-48 rounded-2xl border-0 bg-kenoo-white p-2 shadow-xl"
      >
        <p className="px-2 pb-1 pt-1 text-xs font-medium text-neutral-500">
          Notify via
        </p>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onChange({ notifyEmail: !state.notifyEmail });
          }}
          className={cn(
            "cursor-pointer rounded-xl px-3 py-2 focus:bg-transparent",
            state.notifyEmail ? "bg-neutral-100" : "hover:bg-neutral-50",
          )}
        >
          <div className="flex w-full items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 text-sm text-foreground",
                state.notifyEmail ? "font-semibold" : "font-medium",
              )}
            >
              Email
            </span>
            {state.notifyEmail ? (
              <Check className="h-4 w-4 shrink-0 text-[var(--kenoo-sky)]" strokeWidth={2.75} />
            ) : null}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasPhone}
          onSelect={(event) => {
            event.preventDefault();
            if (!hasPhone) return;
            onChange({ notifySms: !state.notifySms });
          }}
          className={cn(
            "cursor-pointer rounded-xl px-3 py-2 focus:bg-transparent",
            !hasPhone && "cursor-not-allowed opacity-50",
            state.notifySms && hasPhone ? "bg-neutral-100" : "hover:bg-neutral-50",
          )}
        >
          <div className="flex w-full items-center gap-2">
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm text-foreground",
                  state.notifySms && hasPhone ? "font-semibold" : "font-medium",
                )}
              >
                Text
              </span>
              {!hasPhone ? (
                <span className="mt-0.5 block text-xs text-neutral-400">
                  No phone on file
                </span>
              ) : null}
            </span>
            {state.notifySms && hasPhone ? (
              <Check className="h-4 w-4 shrink-0 text-[var(--kenoo-sky)]" strokeWidth={2.75} />
            ) : null}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AlertsPage() {
  const [alertTypes, setAlertTypes] = React.useState<AdpilotAlertType[]>([]);
  const [members, setMembers] = React.useState<AccountMember[]>([]);
  const [channels, setChannels] = React.useState<Record<string, ChannelState>>(
    {},
  );
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/alerts/subscriptions");
      if (!response.ok) {
        setError("Failed to load alert recipients.");
        return;
      }
      const payload = (await response.json()) as {
        alertTypes?: AdpilotAlertType[];
        members?: AccountMember[];
        subscriptions?: MemberAlertSubscription[];
      };

      const nextTypes = payload.alertTypes ?? [];
      const nextMembers = payload.members ?? [];
      const nextChannels: Record<string, ChannelState> = {};

      for (const member of nextMembers) {
        for (const type of nextTypes) {
          nextChannels[subscriptionKey(member.userId, type.key)] = {
            notifyEmail: false,
            notifySms: false,
          };
        }
      }

      for (const sub of payload.subscriptions ?? []) {
        if (!sub.enabled) continue;
        nextChannels[subscriptionKey(sub.userId, sub.alertKey)] = {
          notifyEmail: sub.notifyEmail,
          notifySms: sub.notifySms,
        };
      }

      setAlertTypes(nextTypes);
      setMembers(nextMembers);
      setChannels(nextChannels);
    } catch {
      setError("Failed to load alert recipients.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const saveChannel = async (
    member: AccountMember,
    alertKey: string,
    patch: Partial<ChannelState>,
  ) => {
    const key = subscriptionKey(member.userId, alertKey);
    const current = channels[key] ?? { notifyEmail: false, notifySms: false };
    const next: ChannelState = {
      notifyEmail: patch.notifyEmail ?? current.notifyEmail,
      notifySms: patch.notifySms ?? current.notifySms,
    };

    setChannels((prev) => ({ ...prev, [key]: next }));
    setSavingKey(key);
    setError(null);

    try {
      const response = await fetch("/api/alerts/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.userId,
          alertKey,
          notifyEmail: next.notifyEmail,
          notifySms: next.notifySms,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Failed to update alert recipient.");
        setChannels((prev) => ({ ...prev, [key]: current }));
      }
    } catch {
      setError("Failed to update alert recipient.");
      setChannels((prev) => ({ ...prev, [key]: current }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <main className="min-h-full w-full bg-kenoo-white px-6 py-8 md:px-10 md:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-14">
        <div>
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-2 text-sm font-light text-neutral-500 transition-colors hover:text-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to settings
          </Link>
          <header>
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Alerts
            </h1>
            <p className="mt-2 max-w-xl text-sm font-light leading-6 text-neutral-500">
              Choose which organization members receive AdPilot alerts by email or
              text when automation events fire.
            </p>
          </header>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div
            className={cn(
              "flex items-center justify-center gap-2 overflow-hidden rounded-[28px] py-16 text-sm font-light text-neutral-500",
              panelGlassClass,
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading alert recipients…
          </div>
        ) : members.length === 0 ? (
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-16 text-center text-sm font-light text-neutral-500 md:px-6",
              panelGlassClass,
            )}
          >
            No organization members found for this workspace.
          </div>
        ) : (
          alertTypes.map((alertType) => (
            <section key={alertType.key} className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-neutral-400" />
                  <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                    {alertType.label}
                  </p>
                </div>
                <p className="mt-1.5 text-sm font-light text-neutral-500">
                  {alertType.description}
                </p>
              </div>

              <div className="space-y-2">
                {members.map((member) => {
                  const key = subscriptionKey(member.userId, alertType.key);
                  const state = channels[key] ?? {
                    notifyEmail: false,
                    notifySms: false,
                  };
                  const hasPhone = Boolean(member.phoneNumber?.trim());

                  return (
                    <div
                      key={member.userId}
                      className={cn(
                        "flex items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-2.5 md:px-4",
                        panelGlassClass,
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {member.displayName}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-light text-neutral-500">
                          {member.email}
                          {member.role ? ` · ${member.role}` : ""}
                          {hasPhone ? ` · ${member.phoneNumber}` : ""}
                        </p>
                      </div>

                      <MemberChannelSelect
                        member={member}
                        state={state}
                        saving={savingKey === key}
                        onChange={(patch) =>
                          void saveChannel(member, alertType.key, patch)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
