"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@walls/ui/dropdown-menu";
import { Input } from "@walls/ui/input";
import { LabeledSwitch } from "@walls/ui/switch";
import { Textarea } from "@walls/ui/textarea";
import { cn } from "@walls/utils";

import { AdPilotPreviewCard } from "@/components/campaigns/adpilot-preview";
import {
  DetailSection,
  DetailSubLabel,
} from "@/components/campaigns/entity-detail-shared";
import type {
  AutomationProfile,
  BudgetAdjustmentRow,
} from "@/lib/automation-server";
import {
  resolveInstructionStatus,
  type AgentInstruction,
  type AgentInstructionStatus,
} from "@/lib/agent-instructions";
import type { EntityDetailResult } from "@/lib/entity-detail-server";
import { formatCurrencyFromMicros } from "@/lib/format-analytics";
import {
  COOLDOWN_OPTIONS,
  optimizationGoalLabel,
  spendSettingsEqual,
  type OptimizationGoal,
  type SpendAutomationSettings,
} from "@/lib/spend-automation-settings";

import { SliderField } from "@/components/ui/slider-field";
import { RoasFloorField } from "@/components/ui/roas-floor-field";
import {
  glassSegmentTrackClass,
  glassToggleChipActiveClass,
  glassToggleChipBaseClass,
  glassToggleChipInactiveClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import { SegmentThumb } from "@/components/settings/segment-thumb";

function microsToDollars(micros: number | null): string {
  if (micros == null || micros <= 0) return "";
  return String(Math.round((micros / 1_000_000) * 100) / 100);
}

function dollarsToMicros(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 1_000_000);
}

function formatAdjustmentDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function isoToDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function datetimeLocalValueToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function AdjustmentsList({ rows }: { rows: BudgetAdjustmentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-light text-neutral-400">
        No budget adjustments yet. Changes will appear here once AdPilot runs.
      </p>
    );
  }

  return (
    <div className="divide-y divide-neutral-100">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-start justify-between gap-4 py-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-neutral-800">
              {row.previousDailyBudgetMicros != null
                ? formatCurrencyFromMicros(row.previousDailyBudgetMicros)
                : "—"}{" "}
              →{" "}
              {row.newDailyBudgetMicros != null
                ? formatCurrencyFromMicros(row.newDailyBudgetMicros)
                : "—"}
            </p>
            <p className="mt-0.5 text-xs font-light leading-relaxed text-neutral-500">
              {row.decisionReason ?? "Budget adjustment"}
              {row.optimizationGoal
                ? ` · ${optimizationGoalLabel(row.optimizationGoal)}`
                : ""}
            </p>
          </div>
          <div className="shrink-0 text-right text-xs font-light whitespace-nowrap text-neutral-400">
            <p>{formatAdjustmentDate(row.createdAt)}</p>
            {row.changePct != null ? (
              <p className="tabular-nums">
                {row.changePct >= 0 ? "+" : ""}
                {row.changePct.toFixed(1)}%
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

type EntityAutomationSectionProps = {
  entityId: string;
  entityLabel: string;
  detail: EntityDetailResult;
  onAutomationUpdated: (automation: EntityDetailResult["automation"]) => void;
};

function resolveInitialProfileId(detail: EntityDetailResult): string | null {
  if (detail.automation.profileId) return detail.automation.profileId;
  return (
    detail.profiles.find((profile) => profile.isDefault)?.id ??
    detail.profiles[0]?.id ??
    null
  );
}

export function EntityAutomationSection({
  entityId,
  entityLabel,
  detail,
  onAutomationUpdated,
}: EntityAutomationSectionProps) {
  const [adjustments, setAdjustments] = React.useState(detail.recentAdjustments);
  const [profileId, setProfileId] = React.useState<string | null>(() =>
    resolveInitialProfileId(detail),
  );
  const [minBudget, setMinBudget] = React.useState(
    microsToDollars(detail.automation.minDailyBudgetMicros),
  );
  const [maxBudget, setMaxBudget] = React.useState(
    microsToDollars(detail.automation.maxDailyBudgetMicros),
  );
  const [settings, setSettings] = React.useState<SpendAutomationSettings>(
    detail.automation.effectiveSettings,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [presetMenuOpen, setPresetMenuOpen] = React.useState(false);
  const [pendingPreset, setPendingPreset] =
    React.useState<AutomationProfile | null>(null);
  const dirtyRef = React.useRef(false);
  const saveSeqRef = React.useRef(0);

  React.useEffect(() => {
    setAdjustments(detail.recentAdjustments);
    if (dirtyRef.current) return;
    setProfileId(resolveInitialProfileId(detail));
    setMinBudget(microsToDollars(detail.automation.minDailyBudgetMicros));
    setMaxBudget(microsToDollars(detail.automation.maxDailyBudgetMicros));
    setSettings(detail.automation.effectiveSettings);
  }, [detail]);

  const selectedProfile = detail.profiles.find((profile) => profile.id === profileId);
  const isCustomPreset =
    selectedProfile != null &&
    !spendSettingsEqual(settings, selectedProfile.settings);
  const optimizationGoal: OptimizationGoal =
    selectedProfile?.optimizationGoal ?? "roas";

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const applyPreset = (profile: AutomationProfile) => {
    markDirty();
    setProfileId(profile.id);
    setSettings(profile.settings);
    setPendingPreset(null);
    setPresetMenuOpen(false);
  };

  const requestPresetChange = (profile: AutomationProfile) => {
    if (isCustomPreset) {
      setPresetMenuOpen(false);
      setPendingPreset(profile);
      return;
    }
    applyPreset(profile);
  };

  React.useEffect(() => {
    if (!pendingPreset) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingPreset(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingPreset]);

  const updateSetting = <K extends keyof SpendAutomationSettings>(
    key: K,
    value: SpendAutomationSettings[K],
  ) => {
    markDirty();
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  React.useEffect(() => {
    if (!dirtyRef.current) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      dirtyRef.current = false;
      const seq = ++saveSeqRef.current;
      void (async () => {
        setSaving(true);
        setError(null);

        const baseSettings =
          detail.profiles.find((profile) => profile.id === profileId)?.settings ??
          detail.automation.effectiveSettings;

        const settingsOverride = Object.fromEntries(
          (Object.keys(settings) as Array<keyof SpendAutomationSettings>)
            .filter(
              (key) =>
                key !== "cooldownHours" && settings[key] !== baseSettings[key],
            )
            .map((key) => [key, settings[key]]),
        ) as Partial<SpendAutomationSettings>;

        const response = await fetch(`/api/campaigns/${entityId}/automation`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            cooldownHours: settings.cooldownHours,
            minDailyBudgetMicros: dollarsToMicros(minBudget),
            maxDailyBudgetMicros: dollarsToMicros(maxBudget),
            settingsOverride,
          }),
        });

        if (cancelled || seq !== saveSeqRef.current) return;

        setSaving(false);

        if (!response.ok) {
          dirtyRef.current = true;
          const payload = (await response.json()) as { error?: string };
          setError(payload.error ?? "Failed to save automation settings.");
          return;
        }

        const payload = (await response.json()) as {
          automation: EntityDetailResult["automation"];
        };
        onAutomationUpdated(payload.automation);
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    detail.automation.effectiveSettings,
    detail.profiles,
    entityId,
    maxBudget,
    minBudget,
    onAutomationUpdated,
    profileId,
    settings,
  ]);


  if (!detail.canAutomate) return null;

  return (
    <div className="space-y-12">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <DetailSection title="AdPilot budget control">
        <div className="space-y-10">
          {!detail.automation.enabled ? (
            <p className="text-xs font-light text-neutral-500">
              AdPilot is off for this {entityLabel}. Turn it on with the AdPilot
              toggle at the top of the page to let the worker adjust the daily
              budget within the guardrails below.
            </p>
          ) : null}

          <div>
            <DetailSubLabel>Automation preset</DetailSubLabel>
            <p className="mt-1 text-xs font-light text-neutral-500">
              Start from a workspace preset or completely customize controls.
            </p>
            {detail.profiles.length === 0 ? (
              <p className="mt-4 text-sm font-light text-neutral-500">
                No presets yet.{" "}
                <Link href="/settings" className="text-[var(--kenoo-sky)] hover:underline">
                  Create one in Settings
                </Link>{" "}
                — or tune the defaults below for this {entityLabel}.
              </p>
            ) : (
              <DropdownMenu open={presetMenuOpen} onOpenChange={setPresetMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "mt-4 flex w-full max-w-md items-center gap-3 rounded-xl bg-kenoo-white px-3 py-2.5 text-left transition",
                      "hover:bg-neutral-50",
                      "focus:outline-none",
                      presetMenuOpen && "bg-neutral-50",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {isCustomPreset
                          ? "Custom"
                          : (selectedProfile?.name ?? "Choose a preset")}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {isCustomPreset
                          ? selectedProfile
                            ? `Based on ${selectedProfile.name}`
                            : "Entity overrides"
                          : selectedProfile
                            ? `Optimize for ${optimizationGoalLabel(selectedProfile.optimizationGoal)}${
                                selectedProfile.isDefault ? " · Default" : ""
                              }`
                            : "Pick a workspace preset"}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-neutral-400 transition-transform",
                        presetMenuOpen && "rotate-180",
                      )}
                    />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="z-50 w-[min(100vw-2rem,28rem)] rounded-2xl border-0 bg-kenoo-white p-2 shadow-xl"
                >
                  <p className="px-2 pb-1 pt-1 text-sm font-medium text-neutral-500">
                    Choose a preset
                  </p>

                  <div className="mt-1 space-y-0.5">
                    {isCustomPreset ? (
                      <div className="flex w-full items-center gap-3 rounded-xl bg-neutral-100 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            Custom
                          </p>
                          <p className="mt-0.5 truncate text-xs text-neutral-500">
                            {selectedProfile
                              ? `Based on ${selectedProfile.name}`
                              : "Entity overrides"}
                          </p>
                        </div>
                        <Check
                          className="h-4 w-4 shrink-0 text-foreground"
                          strokeWidth={2.75}
                        />
                      </div>
                    ) : null}

                    {detail.profiles.map((profile) => {
                      const isExactMatch =
                        !isCustomPreset && profileId === profile.id;
                      return (
                        <DropdownMenuItem
                          key={profile.id}
                          onSelect={(event) => {
                            event.preventDefault();
                            requestPresetChange(profile);
                          }}
                          className={cn(
                            "cursor-pointer rounded-xl px-3 py-2.5 transition-colors focus:bg-transparent",
                            isExactMatch ? "bg-neutral-100" : "hover:bg-neutral-50",
                          )}
                        >
                          <div className="flex w-full items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm text-foreground",
                                  isExactMatch ? "font-semibold" : "font-medium",
                                )}
                              >
                                {profile.name}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-neutral-500">
                                Optimize for{" "}
                                {optimizationGoalLabel(profile.optimizationGoal)}
                                {profile.isDefault ? " · Default" : ""}
                              </p>
                            </div>
                            {isExactMatch ? (
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

                  <DropdownMenuSeparator className="my-2 bg-neutral-100" />
                  <DropdownMenuItem
                    asChild
                    className="rounded-xl p-0 focus:bg-transparent"
                  >
                    <Link
                      href="/settings"
                      className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-neutral-50"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="font-medium">Manage presets</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {pendingPreset ? (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="preset-change-title"
              onClick={() => setPendingPreset(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-kenoo-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <h2
                  id="preset-change-title"
                  className="text-base font-semibold text-foreground"
                >
                  Replace custom settings?
                </h2>
                <p className="mt-2 text-sm font-light leading-relaxed text-neutral-500">
                  Switching to{" "}
                  <span className="font-medium text-foreground">
                    {pendingPreset.name}
                  </span>{" "}
                  will discard the custom overrides on this {entityLabel} and
                  replace them with that preset&apos;s settings.
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => setPendingPreset(null)}
                    className={cn(secondaryButtonClass, "px-4")}
                  >
                    Keep custom
                  </Button>
                  <Button
                    type="button"
                    onClick={() => applyPreset(pendingPreset)}
                    className={cn(primaryButtonClass, "px-4")}
                  >
                    Use preset
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <DetailSubLabel>Budget bounds</DetailSubLabel>
            <p className="mt-1 text-xs font-light text-neutral-500">
              Hard min/max daily budget (USD) the algorithm may not exceed.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Minimum daily budget
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="No minimum"
                  value={minBudget}
                  onChange={(e) => {
                    markDirty();
                    setMinBudget(e.target.value);
                  }}
                  className="rounded-full border-neutral-200 bg-kenoo-white font-light"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Maximum daily budget
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="No maximum"
                  value={maxBudget}
                  onChange={(e) => {
                    markDirty();
                    setMaxBudget(e.target.value);
                  }}
                  className="rounded-full border-neutral-200 bg-kenoo-white font-light"
                />
              </label>
            </div>
            {optimizationGoal === "roas" || optimizationGoal === "conversions" ? (
              <div className="mt-5 border-t border-neutral-100 pt-5">
                <RoasFloorField
                  variant="detail"
                  settings={settings}
                  onChange={(patch) => {
                    markDirty();
                    setSettings((prev) => ({ ...prev, ...patch }));
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-8">
            <SliderField
              label="Spend aggressiveness"
              hint="How quickly AdPilot ramps budget on strong performers"
              value={settings.aggressiveness}
              min={0}
              max={100}
              step={1}
              onChange={(value) => updateSetting("aggressiveness", value)}
              endLabels={{
                left: "Conservative",
                center: "Balanced",
                right: "Aggressive",
              }}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <SliderField
                label="Max daily increase"
                value={settings.maxDailyIncreasePct}
                min={5}
                max={50}
                step={1}
                suffix="%"
                onChange={(value) => updateSetting("maxDailyIncreasePct", value)}
                endLabels={{ left: "5%", right: "50%" }}
              />
              <SliderField
                label="Max daily decrease"
                value={settings.maxDailyDecreasePct}
                min={5}
                max={50}
                step={1}
                suffix="%"
                onChange={(value) => updateSetting("maxDailyDecreasePct", value)}
                endLabels={{ left: "5%", right: "50%" }}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">
                Cooldown between budget changes
              </p>
              <p className="mt-1 text-xs font-light text-neutral-500">
                Minimum wait before AdPilot can increase or decrease the daily
                budget again on this {entityLabel}.
              </p>
              <div
                className={cn("mt-3", glassSegmentTrackClass)}
                role="group"
                aria-label="Cooldown between budget changes"
              >
                {COOLDOWN_OPTIONS.map((option) => {
                  const active = settings.cooldownHours === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        updateSetting("cooldownHours", option.value)
                      }
                      className={cn(
                        glassToggleChipBaseClass,
                        active
                          ? glassToggleChipActiveClass
                          : glassToggleChipInactiveClass,
                      )}
                    >
                      {active ? (
                        <SegmentThumb
                          layoutId="entity-cooldown-thumb"
                          variant="glass"
                        />
                      ) : null}
                      <span className="relative z-10">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {optimizationGoal === "ctr" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">
                  CTR floor (%)
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={settings.ctrFloorPct ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "ctrFloorPct",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="rounded-full border-neutral-200 bg-kenoo-white font-light"
                />
              </label>
            ) : null}

            {optimizationGoal === "cpa" || optimizationGoal === "conversions" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">
                  CPA ceiling (USD)
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.cpaCeiling ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "cpaCeiling",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="rounded-full border-neutral-200 bg-kenoo-white font-light"
                />
              </label>
            ) : null}

            <div className="space-y-5 border-t border-neutral-200/70 pt-6">
              <LabeledSwitch
                size="lg"
                checked={settings.learningPhaseProtection}
                onCheckedChange={(value) =>
                  updateSetting("learningPhaseProtection", value)
                }
                label="Learning phase protection"
                description="Block scale-ups while Meta marks the ad set as learning limited."
              />
              <LabeledSwitch
                size="lg"
                checked={settings.pauseOnFatigue}
                onCheckedChange={(value) => updateSetting("pauseOnFatigue", value)}
                label="Pause on frequency fatigue"
                description="Slow scaling when frequency rises and CTR drops week over week."
              />
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs font-light text-neutral-500">
            <Shield className="h-3.5 w-3.5" />
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>Changes save automatically.</>

            )}
          </p>
        </div>
      </DetailSection>

      <AdPilotPreviewCard
        entityId={entityId}
        onApplied={(adjustment) =>
          setAdjustments((current) => [adjustment, ...current].slice(0, 10))
        }
      />

      <AgentInstructionsSection
        entityId={entityId}
        entityLabel={entityLabel}
        initialInstructions={detail.agentInstructions}
      />

      <DetailSection title="Budget history">
        <AdjustmentsList rows={adjustments} />
      </DetailSection>
    </div>
  );
}

type InstructionFormState = {
  instructions: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY_INSTRUCTION_FORM: InstructionFormState = {
  instructions: "",
  startsAt: "",
  endsAt: "",
};

function instructionStatusMeta(status: AgentInstructionStatus): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  switch (status) {
    case "active":
      return {
        label: "Live",
        dotClass: "bg-kenoo-yellow",
        textClass: "text-neutral-700",
      };
    case "scheduled":
      return {
        label: "Scheduled",
        dotClass: "bg-kenoo-sky",
        textClass: "text-neutral-500",
      };
    case "expired":
      return {
        label: "Ended",
        dotClass: "bg-neutral-300",
        textClass: "text-neutral-400",
      };
    case "disabled":
    default:
      return {
        label: "Off",
        dotClass: "bg-neutral-300",
        textClass: "text-neutral-400",
      };
  }
}

function instructionWindowLabel(instruction: AgentInstruction): string {
  const { startsAt, endsAt } = instruction;
  if (startsAt && endsAt) {
    return `${formatAdjustmentDate(startsAt)} → ${formatAdjustmentDate(endsAt)}`;
  }
  if (startsAt) return `From ${formatAdjustmentDate(startsAt)}`;
  if (endsAt) return `Until ${formatAdjustmentDate(endsAt)}`;
  return "Always on (no schedule)";
}

function AgentInstructionsSection({
  entityId,
  entityLabel,
  initialInstructions,
}: {
  entityId: string;
  entityLabel: string;
  initialInstructions: AgentInstruction[];
}) {
  const [items, setItems] = React.useState(initialInstructions);

  React.useEffect(() => {
    setItems(initialInstructions);
  }, [initialInstructions]);

  const activeCount = items.filter(
    (item) =>
      resolveInstructionStatus({
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        isActive: item.isActive,
      }) === "active",
  ).length;

  return (
    <DetailSection
      title="Agent instructions"
      description="Natural-language guidance the AdPilot agent reads when deciding how to move spend. Add as many as you like, each with its own schedule."
      collapsedBadgeCount={activeCount}
    >
      <AgentInstructionsManager
        entityId={entityId}
        entityLabel={entityLabel}
        items={items}
        onItemsChange={setItems}
      />
    </DetailSection>
  );
}

function AgentInstructionsManager({
  entityId,
  entityLabel,
  items,
  onItemsChange,
}: {
  entityId: string;
  entityLabel: string;
  items: AgentInstruction[];
  onItemsChange: React.Dispatch<React.SetStateAction<AgentInstruction[]>>;
}) {
  const [form, setForm] = React.useState<InstructionFormState>(
    EMPTY_INSTRUCTION_FORM,
  );
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setItems = onItemsChange;

  const resetForm = () => {
    setForm(EMPTY_INSTRUCTION_FORM);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const startCreate = () => {
    setForm(EMPTY_INSTRUCTION_FORM);
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const startEdit = (instruction: AgentInstruction) => {
    setForm({
      instructions: instruction.instructions,
      startsAt: isoToDatetimeLocalValue(instruction.startsAt),
      endsAt: isoToDatetimeLocalValue(instruction.endsAt),
    });
    setEditingId(instruction.id);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.instructions.trim()) {
      setError("Add some instructions first.");
      return;
    }
    setBusy(true);
    setError(null);

    const body = {
      instructions: form.instructions.trim(),
      startsAt: datetimeLocalValueToIso(form.startsAt),
      endsAt: datetimeLocalValueToIso(form.endsAt),
    };
    const url = editingId
      ? `/api/campaigns/${entityId}/instructions/${editingId}`
      : `/api/campaigns/${entityId}/instructions`;

    const response = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to save instruction.");
      return;
    }

    const payload = (await response.json()) as { instruction: AgentInstruction };
    setItems((current) =>
      editingId
        ? current.map((item) =>
            item.id === editingId ? payload.instruction : item,
          )
        : [payload.instruction, ...current],
    );
    resetForm();
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);

    const response = await fetch(
      `/api/campaigns/${entityId}/instructions/${id}`,
      { method: "DELETE" },
    );

    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to delete instruction.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  };

  const handleToggleActive = async (instruction: AgentInstruction) => {
    setBusy(true);
    setError(null);

    const response = await fetch(
      `/api/campaigns/${entityId}/instructions/${instruction.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !instruction.isActive }),
      },
    );

    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to update instruction.");
      return;
    }

    const payload = (await response.json()) as { instruction: AgentInstruction };
    setItems((current) =>
      current.map((item) =>
        item.id === instruction.id ? payload.instruction : item,
      ),
    );
  };

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {items.length === 0 && !showForm ? (
        <p className="text-sm font-light text-neutral-500">
          No instructions yet. The agent runs on preset guardrails until you add
          guidance for this {entityLabel}.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((instruction) => {
            const meta = instructionStatusMeta(instruction.status);
            const isActive = instruction.status === "active";
            return (
              <div
                key={instruction.id}
                className={cn(
                  "group rounded-2xl border border-dotted bg-transparent px-4 py-3.5",
                  isActive
                    ? "border-neutral-400/70"
                    : instruction.status === "scheduled"
                      ? "border-neutral-300"
                      : "border-neutral-200",
                  !isActive &&
                    instruction.status !== "scheduled" &&
                    "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] font-medium tracking-tight",
                        meta.textClass,
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          meta.dotClass,
                        )}
                        aria-hidden
                      />
                      {meta.label}
                    </span>
                    <span className="text-neutral-300" aria-hidden>
                      ·
                    </span>
                    <span className="text-xs font-light text-neutral-500">
                      {instructionWindowLabel(instruction)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleToggleActive(instruction)}
                      className={cn(
                        secondaryButtonClass,
                        "px-3 py-1 text-[11px] disabled:opacity-50",
                      )}
                    >
                      {instruction.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(instruction)}
                      aria-label="Edit instruction"
                      className={cn(
                        secondaryButtonClass,
                        "p-1.5 disabled:opacity-50",
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(instruction.id)}
                      aria-label="Delete instruction"
                      className={cn(
                        secondaryButtonClass,
                        "p-1.5 text-rose-600 disabled:opacity-50",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2.5 whitespace-pre-wrap text-sm font-light leading-relaxed text-neutral-700">
                  {instruction.instructions}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {showForm ? (
        <div className="space-y-4 rounded-2xl border border-dotted border-neutral-300 bg-transparent px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-800">
              {editingId ? "Edit instruction" : "New instruction"}
            </p>
            <button
              type="button"
              onClick={resetForm}
              aria-label="Cancel"
              className={cn(secondaryButtonClass, "p-1.5")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Textarea
            value={form.instructions}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, instructions: e.target.value }))
            }
            placeholder="e.g. Scale daily budget as aggressively as allowed until we hit the ROAS floor."
            rows={3}
            className="rounded-xl border border-neutral-200 bg-kenoo-white px-3 py-2.5 font-light text-sm"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">
                Start
              </span>
              <p className="text-xs font-light text-neutral-500">
                Leave blank to start now. Set a future time to schedule ahead.
              </p>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startsAt: e.target.value }))
                }
                className="rounded-full border-neutral-200 bg-kenoo-white font-light"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">End</span>
              <p className="text-xs font-light text-neutral-500">
                Leave blank for no expiry.
              </p>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endsAt: e.target.value }))
                }
                className="rounded-full border-neutral-200 bg-kenoo-white font-light"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              onClick={resetForm}
              className={cn(secondaryButtonClass, "px-4")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void handleSubmit()}
              className={cn(primaryButtonClass, "inline-flex items-center gap-2")}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editingId ? (
                "Save changes"
              ) : (
                "Add instruction"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-kenoo-white px-5 font-medium tracking-tight text-neutral-400 transition-all duration-300 ease-in-out hover:border-neutral-300 hover:bg-kenoo-white hover:text-neutral-400 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add instruction
        </Button>
      )}
    </div>
  );
}
