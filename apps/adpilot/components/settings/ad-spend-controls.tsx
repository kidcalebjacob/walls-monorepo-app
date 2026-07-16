"use client";

import * as React from "react";
import {
  Check,
  Coins,
  Gauge,
  Loader2,
  MousePointerClick,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import { Input } from "@walls/ui/input";
import { LabeledSwitch } from "@walls/ui/switch";
import { cn } from "@walls/utils";

import type { AutomationProfile } from "@/lib/automation-server";
import {
  COOLDOWN_OPTIONS,
  DEFAULT_SPEND_AUTOMATION_SETTINGS,
  getAggressivenessLabel,
  getProjectedWeeklyUplift,
  getRiskScore,
  OPTIMIZATION_GOAL_OPTIONS,
  optimizationGoalLabel,
  type OptimizationGoal,
  type SpendAutomationSettings,
} from "@/lib/spend-automation-settings";

import { SliderField } from "@/components/ui/slider-field";
import { RoasFloorField } from "@/components/ui/roas-floor-field";

import {
  glassSegmentTrackClass,
  glassToggleCardActiveClass,
  glassToggleCardBaseClass,
  glassToggleCardInactiveClass,
  glassToggleChipActiveClass,
  glassToggleChipBaseClass,
  glassToggleChipInactiveClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import { SectionLabel } from "./section-label";
import { SegmentThumb } from "./segment-thumb";

const GOAL_ICONS: Record<OptimizationGoal, LucideIcon> = {
  roas: TrendingUp,
  ctr: MousePointerClick,
  cpa: Coins,
  conversions: Target,
};

type ProfileFormState = {
  name: string;
  description: string;
  optimizationGoal: OptimizationGoal;
  isDefault: boolean;
  settings: SpendAutomationSettings;
};

function profileToForm(profile: AutomationProfile): ProfileFormState {
  return {
    name: profile.name,
    description: profile.description ?? "",
    optimizationGoal: profile.optimizationGoal,
    isDefault: profile.isDefault,
    settings: profile.settings,
  };
}

export function AdSpendControls() {
  const [profiles, setProfiles] = React.useState<AutomationProfile[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ProfileFormState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadProfiles = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/automation/profiles");
    if (!response.ok) {
      setError("Failed to load automation presets.");
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { profiles?: AutomationProfile[] };
    const nextProfiles = payload.profiles ?? [];
    setProfiles(nextProfiles);

    const defaultProfile =
      nextProfiles.find((profile) => profile.isDefault) ?? nextProfiles[0] ?? null;

    if (defaultProfile) {
      setSelectedId(defaultProfile.id);
      setForm(profileToForm(defaultProfile));
    }

    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const selectProfile = (profile: AutomationProfile) => {
    setSelectedId(profile.id);
    setForm(profileToForm(profile));
    setSaved(false);
    setError(null);
  };

  const updateSetting = <K extends keyof SpendAutomationSettings>(
    key: K,
    value: SpendAutomationSettings[K],
  ) => {
    setForm((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : prev,
    );
    setSaved(false);
  };

  const updateForm = <K extends keyof Omit<ProfileFormState, "settings">>(
    key: K,
    value: ProfileFormState[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!form || !selectedId) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const response = await fetch(`/api/automation/profiles/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || null,
        optimizationGoal: form.optimizationGoal,
        isDefault: form.isDefault,
        settings: form.settings,
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to save preset.");
      return;
    }

    const payload = (await response.json()) as { profile: AutomationProfile };
    const updated = payload.profile;

    setProfiles((prev) => {
      const withoutUpdated = prev.filter((profile) => profile.id !== updated.id);
      const next = [...withoutUpdated, updated];
      if (updated.isDefault) {
        return next.map((profile) =>
          profile.id === updated.id
            ? profile
            : { ...profile, isDefault: false },
        );
      }
      return next.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    });

    setForm(profileToForm(updated));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const handleCreatePreset = async () => {
    setCreating(true);
    setError(null);

    const response = await fetch("/api/automation/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New preset",
        description: "Custom automation preset",
        optimizationGoal: "roas",
        settings: DEFAULT_SPEND_AUTOMATION_SETTINGS,
      }),
    });

    setCreating(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to create preset.");
      return;
    }

    const payload = (await response.json()) as { profile: AutomationProfile };
    const created = payload.profile;

    setProfiles((prev) => [...prev, created]);
    selectProfile(created);
  };

  if (loading) {
    return (
      <section>
        <SectionLabel
          title="Ad spend automation"
          description="Workspace-wide presets stored in your automation profile library. Enable AdPilot per campaign or ad set to apply them."
        />
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-neutral-200/70 bg-kenoo-white py-16 text-sm font-light text-neutral-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading automation presets…
        </div>
      </section>
    );
  }

  if (!form) {
    return (
      <section>
        <SectionLabel
          title="Ad spend automation"
          description="Workspace-wide presets stored in your automation profile library. Enable AdPilot per campaign or ad set to apply them."
        />
        <div className="rounded-3xl border border-neutral-200/70 bg-kenoo-white py-16 text-center text-sm font-light text-neutral-500 shadow-sm">
          No automation presets found.
        </div>
      </section>
    );
  }

  const riskScore = getRiskScore(
    form.settings.aggressiveness,
    form.settings.maxDailyIncreasePct,
  );
  const projectedUplift = getProjectedWeeklyUplift(
    form.settings.aggressiveness,
    form.settings.maxDailyIncreasePct,
  );
  const autonomyLabel = getAggressivenessLabel(form.settings.aggressiveness);

  return (
    <section>
      <SectionLabel
        title="Ad spend automation"
        description="Workspace-wide presets stored in your automation profile library. Enable AdPilot per campaign or ad set to apply them."
      />
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={glassSegmentTrackClass}
            role="group"
            aria-label="Automation presets"
          >
            {profiles.map((profile) => {
              const active = selectedId === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectProfile(profile)}
                  className={cn(
                    glassToggleChipBaseClass,
                    active
                      ? glassToggleChipActiveClass
                      : glassToggleChipInactiveClass,
                  )}
                >
                  {active ? (
                    <SegmentThumb layoutId="preset-thumb" variant="glass" />
                  ) : null}
                  <span className="relative z-10">
                    {profile.name}
                    {profile.isDefault ? " · Default" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={creating}
            onClick={() => void handleCreatePreset()}
            className={secondaryButtonClass}
          >
            {creating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add preset
          </Button>
        </div>

        <div className="rounded-[24px] border border-neutral-200/70 bg-kenoo-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Preset name</span>
              <Input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                className="rounded-full border-neutral-200 bg-neutral-50 font-light"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Description</span>
              <Input
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Optional"
                className="rounded-full border-neutral-200 bg-neutral-50 font-light"
              />
            </label>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-foreground">Optimization goal</p>
            <p className="mt-1 text-xs font-light text-neutral-500">
              What this preset optimizes for when your backend algorithm runs.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {OPTIMIZATION_GOAL_OPTIONS.map((option) => {
                const selected = form.optimizationGoal === option.value;
                const Icon = GOAL_ICONS[option.value];
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateForm("optimizationGoal", option.value)}
                    className={cn(
                      glassToggleCardBaseClass,
                      selected
                        ? glassToggleCardActiveClass
                        : glassToggleCardInactiveClass,
                    )}
                  >
                    {selected ? (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-white/70 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-md">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                          selected
                            ? "border border-white/70 bg-white/70 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-md"
                            : "bg-neutral-100 text-neutral-400",
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            selected
                              ? "pr-6 text-neutral-700"
                              : "text-neutral-400",
                          )}
                        >
                          {option.label}
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-xs font-light leading-5",
                            selected ? "text-neutral-500" : "text-neutral-400",
                          )}
                        >
                          {option.hint}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-neutral-100 pt-5">
            <LabeledSwitch
              checked={form.isDefault}
              onCheckedChange={(value) => updateForm("isDefault", value)}
              label="Use as workspace default"
              description="New campaigns and ad sets inherit this preset unless you pick another on the entity page."
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-neutral-200/70 bg-kenoo-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-light text-neutral-500">
              <TrendingUp className="h-3.5 w-3.5" />
              Projected weekly uplift
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {projectedUplift}
            </p>
            <p className="mt-1 text-xs font-light text-neutral-400">
              Estimated at current aggressiveness
            </p>
          </div>
          <div className="rounded-[24px] border border-neutral-200/70 bg-kenoo-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-light text-neutral-500">
              <Gauge className="h-3.5 w-3.5" />
              Risk score
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {riskScore}
              <span className="text-base font-light text-neutral-400">/100</span>
            </p>
            <p className="mt-1 text-xs font-light text-neutral-400">
              {riskScore < 40 ? "Low volatility" : riskScore < 70 ? "Moderate" : "High volatility"}
            </p>
          </div>
          <div className="rounded-[24px] border border-neutral-200/70 bg-kenoo-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-light text-neutral-500">
              <Zap className="h-3.5 w-3.5" />
              Autonomy level
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {autonomyLabel}
            </p>
            <p className="mt-1 text-xs font-light text-neutral-400">
              Optimizing for {optimizationGoalLabel(form.optimizationGoal)}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/70 bg-kenoo-white p-5 shadow-sm">
          <div className="space-y-6">
            <SliderField
              label="Spend aggressiveness"
              hint="How quickly AdPilot ramps budget on strong performers"
              value={form.settings.aggressiveness}
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

            <div className="grid gap-5 sm:grid-cols-2">
              <SliderField
                label="Max daily budget increase"
                hint="Cap on % growth per 24h window"
                value={form.settings.maxDailyIncreasePct}
                min={5}
                max={50}
                step={1}
                suffix="%"
                onChange={(value) => updateSetting("maxDailyIncreasePct", value)}
                endLabels={{ left: "5%", right: "50%" }}
              />
              <SliderField
                label="Max daily budget decrease"
                hint="Cap on % reduction per 24h window"
                value={form.settings.maxDailyDecreasePct}
                min={5}
                max={50}
                step={1}
                suffix="%"
                onChange={(value) => updateSetting("maxDailyDecreasePct", value)}
                endLabels={{ left: "5%", right: "50%" }}
              />
            </div>

            <SliderField
              label="Scale-up cap per cycle"
              hint="Single optimization jump limit"
              value={form.settings.scaleUpCapPct}
              min={10}
              max={60}
              step={1}
              suffix="%"
              onChange={(value) => updateSetting("scaleUpCapPct", value)}
              endLabels={{ left: "10%", right: "60%" }}
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/70 bg-kenoo-white p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground">Guardrails</p>
          <p className="mt-1 text-xs font-light text-neutral-500">
            Hard stops that pause or slow scaling before efficiency drops.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {form.optimizationGoal === "roas" || form.optimizationGoal === "conversions" ? (
              <div className="sm:col-span-2">
                <RoasFloorField
                  variant="settings"
                  settings={form.settings}
                  onChange={(patch) => {
                    setForm((prev) =>
                      prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev,
                    );
                    setSaved(false);
                  }}
                />
              </div>
            ) : null}

            {form.optimizationGoal === "ctr" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">CTR floor (%)</span>
                <span className="block text-xs font-light text-neutral-500">
                  Minimum click-through rate before scaling continues
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.settings.ctrFloorPct ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "ctrFloorPct",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="mt-2 rounded-full border-neutral-200 bg-neutral-50 font-light"
                />
              </label>
            ) : null}

            {form.optimizationGoal === "cpa" || form.optimizationGoal === "conversions" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">CPA ceiling</span>
                <span className="block text-xs font-light text-neutral-500">
                  Max cost per acquisition (USD)
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.settings.cpaCeiling ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "cpaCeiling",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="mt-2 rounded-full border-neutral-200 bg-neutral-50 font-light"
                />
              </label>
            ) : null}
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-foreground">
              Cooldown between budget changes
            </p>
            <p className="mt-1 text-xs font-light text-neutral-500">
              Minimum wait before AdPilot can increase or decrease the daily budget
              again on the same entity.
            </p>
            <div
              className={cn("mt-3", glassSegmentTrackClass)}
              role="group"
              aria-label="Cooldown between budget changes"
            >
              {COOLDOWN_OPTIONS.map((option) => {
                const active = form.settings.cooldownHours === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateSetting("cooldownHours", option.value)}
                    className={cn(
                      glassToggleChipBaseClass,
                      active
                        ? glassToggleChipActiveClass
                        : glassToggleChipInactiveClass,
                    )}
                  >
                    {active ? (
                      <SegmentThumb layoutId="cooldown-thumb" variant="glass" />
                    ) : null}
                    <span className="relative z-10">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/70 bg-kenoo-white p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground">Safety</p>
          <div className="mt-5 space-y-5">
            <LabeledSwitch
              checked={form.settings.learningPhaseProtection}
              onCheckedChange={(value) => updateSetting("learningPhaseProtection", value)}
              label="Learning phase protection"
              description="Block scale-ups while Meta marks the ad set as learning limited."
            />
            <LabeledSwitch
              checked={form.settings.pauseOnFatigue}
              onCheckedChange={(value) => updateSetting("pauseOnFatigue", value)}
              label="Pause on frequency fatigue"
              description="Slow scaling when frequency rises and CTR drops week over week."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-light text-neutral-500">
            <Shield className="h-3.5 w-3.5" />
            Saved to your automation profile library. Enable AdPilot on each
            campaign or ad set to grant permission.
          </p>
          <Button
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={() => void handleSave()}
            className={cn(primaryButtonClass, "px-6")}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : saved ? (
              "Preset saved"
            ) : (
              "Save preset"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
