"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Shield } from "lucide-react";

import { Button } from "@walls/ui/button";
import { Input } from "@walls/ui/input";
import { LabeledSwitch } from "@walls/ui/switch";

import { AdPilotPreviewCard } from "@/components/campaigns/adpilot-preview";
import {
  DetailSection,
  DetailSubLabel,
  detailSelectableClass,
} from "@/components/campaigns/entity-detail-shared";
import type { BudgetAdjustmentRow } from "@/lib/automation-server";
import type { EntityDetailResult } from "@/lib/entity-detail-server";
import { formatCurrencyFromMicros } from "@/lib/format-analytics";
import {
  COOLDOWN_OPTIONS,
  OPTIMIZATION_GOAL_OPTIONS,
  optimizationGoalLabel,
  type AutomationStatus,
  type OptimizationGoal,
  type SpendAutomationSettings,
} from "@/lib/spend-automation-settings";

import { SliderField } from "@/components/ui/slider-field";

function automationStatusLabel(status: AutomationStatus): string {
  const labels: Record<AutomationStatus, string> = {
    inactive: "Inactive",
    active: "Active",
    paused: "Paused",
    cooldown: "Cooldown",
    learning: "Learning",
    error: "Error",
  };
  return labels[status];
}

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
          className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
        >
          <div>
            <p className="font-medium text-neutral-800">
              {row.previousDailyBudgetMicros != null
                ? formatCurrencyFromMicros(row.previousDailyBudgetMicros)
                : "—"}{" "}
              →{" "}
              {row.newDailyBudgetMicros != null
                ? formatCurrencyFromMicros(row.newDailyBudgetMicros)
                : "—"}
            </p>
            <p className="mt-0.5 text-xs font-light text-neutral-500">
              {row.decisionReason ?? "Budget adjustment"}
              {row.optimizationGoal
                ? ` · ${optimizationGoalLabel(row.optimizationGoal)}`
                : ""}
            </p>
          </div>
          <div className="text-right text-xs font-light text-neutral-400">
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
  const [enabled, setEnabled] = React.useState(detail.automation.enabled);
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
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEnabled(detail.automation.enabled);
    setProfileId(resolveInitialProfileId(detail));
    setMinBudget(microsToDollars(detail.automation.minDailyBudgetMicros));
    setMaxBudget(microsToDollars(detail.automation.maxDailyBudgetMicros));
    setSettings(detail.automation.effectiveSettings);
  }, [detail]);

  const selectedProfile = detail.profiles.find((profile) => profile.id === profileId);
  const optimizationGoal: OptimizationGoal =
    selectedProfile?.optimizationGoal ?? "roas";

  const updateSetting = <K extends keyof SpendAutomationSettings>(
    key: K,
    value: SpendAutomationSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
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
        enabled,
        profileId,
        cooldownHours: settings.cooldownHours,
        minDailyBudgetMicros: dollarsToMicros(minBudget),
        maxDailyBudgetMicros: dollarsToMicros(maxBudget),
        settingsOverride,
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to save automation settings.");
      return;
    }

    const payload = (await response.json()) as {
      automation: EntityDetailResult["automation"];
    };
    onAutomationUpdated(payload.automation);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

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
          <div>
            <LabeledSwitch
              size="lg"
              checked={enabled}
              onCheckedChange={(value) => {
                setEnabled(value);
                setSaved(false);
              }}
              label="Enable AdPilot for this entity"
              description="When on, your automation worker may increase or decrease the daily budget within the guardrails below."
            />

            {enabled ? (
              <p className="mt-4 text-xs font-light text-neutral-500">
                Status:{" "}
                <span className="font-medium text-neutral-700">
                  {automationStatusLabel(detail.automation.automationStatus)}
                </span>
                {detail.automation.lastAdjustedAt
                  ? ` · Last adjusted ${formatAdjustmentDate(detail.automation.lastAdjustedAt)}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div>
            <DetailSubLabel>Automation preset</DetailSubLabel>
            <p className="mt-1 text-xs font-light text-neutral-500">
              Pick a workspace preset to inherit defaults. Per-{entityLabel} overrides
              are stored on this {entityLabel} only.
            </p>
            {detail.profiles.length === 0 ? (
              <p className="mt-4 text-sm font-light text-neutral-500">
                No presets yet.{" "}
                <Link href="/settings" className="text-[var(--walls-sky)] hover:underline">
                  Create one in Settings
                </Link>{" "}
                — or save here to use built-in defaults for this {entityLabel}.
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {detail.profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setProfileId(profile.id);
                      setSettings(profile.settings);
                      setSaved(false);
                    }}
                    className={detailSelectableClass(
                      profileId === profile.id,
                      "px-4 py-3 text-left",
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {profile.name}
                      {profile.isDefault ? (
                        <span className="ml-2 text-[10px] font-light uppercase tracking-wider text-neutral-400">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs font-light text-neutral-500">
                      Optimize for {optimizationGoalLabel(profile.optimizationGoal)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <DetailSubLabel>Budget bounds</DetailSubLabel>
            <p className="mt-1 text-xs font-light text-neutral-500">
              Hard min/max daily budget (USD) the algorithm may not exceed.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
                    setMinBudget(e.target.value);
                    setSaved(false);
                  }}
                  className="rounded-full border-neutral-200 bg-walls-white font-light"
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
                    setMaxBudget(e.target.value);
                    setSaved(false);
                  }}
                  className="rounded-full border-neutral-200 bg-walls-white font-light"
                />
              </label>
              {optimizationGoal === "roas" || optimizationGoal === "conversions" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    ROAS floor
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="No floor"
                    value={settings.roasFloor ?? ""}
                    onChange={(e) =>
                      updateSetting(
                        "roasFloor",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="rounded-full border-neutral-200 bg-walls-white font-light"
                  />
                </label>
              ) : null}
            </div>
          </div>

          <div>
            <DetailSubLabel>Entity overrides</DetailSubLabel>
            <p className="mt-1 text-xs font-light text-neutral-500">
              Tuning for{" "}
              {OPTIMIZATION_GOAL_OPTIONS.find(
                (option) => option.value === optimizationGoal,
              )?.hint.toLowerCase()}
              . Only changes from the preset are stored on this entity.
            </p>

            <div className="mt-6 space-y-8">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {COOLDOWN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSetting("cooldownHours", option.value)}
                      className={detailSelectableClass(
                        settings.cooldownHours === option.value,
                        "rounded-full px-3.5 py-1.5 text-xs font-light text-neutral-700",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
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
                    className="rounded-full border-neutral-200 bg-walls-white font-light"
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
                    className="rounded-full border-neutral-200 bg-walls-white font-light"
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-light text-neutral-500">
              <Shield className="h-3.5 w-3.5" />
              Saves to this {entityLabel}&apos;s enrollment record. Meta budget updates
              run via your backend worker.
            </p>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-none border-0 bg-walls-yellow px-5 py-2.5 text-sm font-medium text-black shadow-none hover:bg-walls-yellow"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                "Settings saved"
              ) : (
                "Save AdPilot settings"
              )}
            </Button>
          </div>
        </div>
      </DetailSection>

      <AdPilotPreviewCard entityId={entityId} entityLabel={entityLabel} />

      <DetailSection
        title="Budget history"
        description="Recent daily budget adjustments for this entity."
      >
        <AdjustmentsList rows={detail.recentAdjustments} />
      </DetailSection>
    </div>
  );
}
