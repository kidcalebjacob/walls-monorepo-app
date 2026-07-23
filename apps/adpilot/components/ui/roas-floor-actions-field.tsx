"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@walls/ui/dropdown-menu";
import { cn } from "@walls/utils";

import {
  ADPILOT_ROAS_FLOOR_ALERT_KEY,
  ROAS_FLOOR_ACTION_OPTIONS,
  toggleRoasFloorAction,
  type RoasFloorAction,
} from "@/lib/spend-automation-settings";

type RoasFloorActionsFieldProps = {
  value: RoasFloorAction[];
  onChange: (next: RoasFloorAction[]) => void;
  className?: string;
};

async function ensureEmailSubscription() {
  try {
    await fetch("/api/alerts/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertKey: ADPILOT_ROAS_FLOOR_ALERT_KEY,
        notifyEmail: true,
      }),
    });
  } catch {
    // Non-blocking: settings still save; backend can reconcile later.
  }
}

function selectionLabel(value: RoasFloorAction[]) {
  const labels = ROAS_FLOOR_ACTION_OPTIONS.filter((option) =>
    value.includes(option.value),
  ).map((option) => option.label);

  if (labels.length === 0) return "No action";
  if (labels.length === ROAS_FLOOR_ACTION_OPTIONS.length) {
    return "Stop campaign & email alert";
  }
  return labels.join(", ");
}

export function RoasFloorActionsField({
  value,
  onChange,
  className,
}: RoasFloorActionsFieldProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (action: RoasFloorAction) => {
    const next = toggleRoasFloorAction(value, action);
    onChange(next);

    if (action === "email_alert" && next.includes("email_alert")) {
      void ensureEmailSubscription();
    }
  };

  return (
    <div className={className}>
      <p className="text-sm font-medium text-foreground">
        When ROAS drops below the floor
      </p>
      <p className="mt-1 text-xs font-light text-neutral-500">
        Optional — stop the campaign, send an email alert, both, or neither.
        Manage who receives emails on the{" "}
        <Link href="/alerts" className="text-[var(--kenoo-sky)] hover:underline">
          Alerts
        </Link>{" "}
        page.
      </p>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-3 flex w-full max-w-sm items-center gap-2 rounded-xl border border-black/[0.06] bg-white/55 px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl transition",
              "hover:bg-white/80",
              "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
              open && "bg-white/80",
            )}
            aria-label="ROAS floor actions"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {selectionLabel(value)}
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
          align="start"
          sideOffset={6}
          className="z-50 w-[min(100vw-2rem,20rem)] rounded-2xl border-0 bg-kenoo-white p-2 shadow-xl"
        >
          <p className="px-2 pb-1 pt-1 text-xs font-medium text-neutral-500">
            Actions
          </p>
          {ROAS_FLOOR_ACTION_OPTIONS.map((option) => {
            const active = value.includes(option.value);
            return (
              <DropdownMenuItem
                key={option.value}
                onSelect={(event) => {
                  event.preventDefault();
                  handleToggle(option.value);
                }}
                className={cn(
                  "cursor-pointer rounded-xl px-3 py-2.5 focus:bg-transparent",
                  active ? "bg-neutral-100" : "hover:bg-neutral-50",
                )}
              >
                <div className="flex w-full items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm text-foreground",
                        active ? "font-semibold" : "font-medium",
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {option.hint}
                    </span>
                  </span>
                  {active ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-[var(--kenoo-sky)]"
                      strokeWidth={2.75}
                    />
                  ) : null}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
