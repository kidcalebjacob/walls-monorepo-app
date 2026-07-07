"use client";

import * as React from "react";
import {
  Gauge,
  Loader2,
  Plus,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@walls/ui/card";
import { Input } from "@walls/ui/input";
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

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? (
          <p className="mt-1 text-xs font-light leading-5 text-neutral-500">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-walls-yellow/90" : "bg-neutral-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint ? (
            <p className="mt-1 text-xs font-light text-neutral-500">{hint}</p>
          ) : null}
        </div>
        <p className="text-sm font-medium tabular-nums text-foreground">
          {value}
          {suffix}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-black"
      />
    </div>
  );
}

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
      <Card className="rounded-[32px] border-neutral-200/60 bg-neutral-100 shadow-inner">
        <CardContent className="flex items-center justify-center gap-2 py-16 text-sm font-light text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading automation presets…
        </CardContent>
      </Card>
    );
  }

  if (!form) {
    return (
      <Card className="rounded-[32px] border-neutral-200/60 bg-neutral-100 shadow-inner">
        <CardContent className="py-16 text-center text-sm font-light text-neutral-500">
          No automation presets found.
        </CardContent>
      </Card>
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
    <Card className="rounded-[32px] border-neutral-200/60 bg-neutral-100 shadow-inner">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
          Ad spend automation presets
        </CardTitle>
        <p className="text-sm font-light text-neutral-500">
          Workspace-wide defaults stored in your automation profile library. Enable
          AdPilot per campaign or ad set to apply these settings.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pb-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => selectProfile(profile)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-light transition-colors",
                selectedId === profile.id
                  ? "border-walls-yellow bg-walls-yellow/20 text-foreground"
                  : "border-neutral-200 bg-walls-white text-neutral-600 hover:bg-neutral-50",
              )}
            >
              {profile.name}
              {profile.isDefault ? " · Default" : ""}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={creating}
            onClick={() => void handleCreatePreset()}
            className="rounded-full border-neutral-200 bg-walls-white font-light"
          >
            {creating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add preset
          </Button>
        </div>

        <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-5 shadow-sm">
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
              {OPTIMIZATION_GOAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateForm("optimizationGoal", option.value)}
                  className={cn(
                    "rounded-[20px] border px-3 py-3 text-left transition-colors",
                    form.optimizationGoal === option.value
                      ? "border-walls-yellow bg-walls-yellow/15"
                      : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="mt-1 text-xs font-light leading-5 text-neutral-500">
                    {option.hint}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-neutral-100 pt-5">
            <Toggle
              checked={form.isDefault}
              onChange={(value) => updateForm("isDefault", value)}
              label="Use as workspace default"
              description="New campaigns and ad sets inherit this preset unless you pick another on the entity page."
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-4 shadow-sm">
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
          <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-4 shadow-sm">
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
          <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-4 shadow-sm">
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

        <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-5 shadow-sm">
          <div className="space-y-6">
            <SliderField
              label="Spend aggressiveness"
              hint="How quickly AdPilot ramps budget on strong performers"
              value={form.settings.aggressiveness}
              min={0}
              max={100}
              step={1}
              onChange={(value) => updateSetting("aggressiveness", value)}
            />
            <div className="flex justify-between text-[11px] font-light text-neutral-400">
              <span>Conservative</span>
              <span>Balanced</span>
              <span>Aggressive</span>
            </div>

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
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground">Guardrails</p>
          <p className="mt-1 text-xs font-light text-neutral-500">
            Hard stops that pause or slow scaling before efficiency drops.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {form.optimizationGoal === "roas" || form.optimizationGoal === "conversions" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">ROAS floor</span>
                <span className="block text-xs font-light text-neutral-500">
                  Minimum return before scaling continues
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.settings.roasFloor ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "roasFloor",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="mt-2 rounded-full border-neutral-200 bg-neutral-50 font-light"
                />
              </label>
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
            <p className="text-sm font-medium text-foreground">Cooldown between increases</p>
            <p className="mt-1 text-xs font-light text-neutral-500">
              Minimum wait before the next budget bump on the same entity.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {COOLDOWN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateSetting("cooldownHours", option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-light transition-colors",
                    form.settings.cooldownHours === option.value
                      ? "border-walls-yellow bg-walls-yellow/20 text-foreground"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200/70 bg-walls-white p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground">Safety</p>
          <div className="mt-5 space-y-5">
            <Toggle
              checked={form.settings.learningPhaseProtection}
              onChange={(value) => updateSetting("learningPhaseProtection", value)}
              label="Learning phase protection"
              description="Block scale-ups while Meta marks the ad set as learning limited."
            />
            <Toggle
              checked={form.settings.pauseOnFatigue}
              onChange={(value) => updateSetting("pauseOnFatigue", value)}
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
            className="rounded-full bg-walls-yellow/90 px-6 font-medium text-black hover:bg-walls-yellow"
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
      </CardContent>
    </Card>
  );
}
