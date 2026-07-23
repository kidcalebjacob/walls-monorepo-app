"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Coins,
  Gauge,
  Loader2,
  MousePointerClick,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Zap,
  Pencil,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@walls/ui/dropdown-menu";
import { LabeledSwitch } from "@walls/ui/switch";
import { cn } from "@walls/utils";

import type { AutomationProfile } from "@/lib/automation-server";
import type { ProfileAgentInstruction } from "@/lib/agent-instructions";
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

import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { SliderField } from "@/components/ui/slider-field";
import { RoasFloorField } from "@/components/ui/roas-floor-field";
import { RoasFloorActionsField } from "@/components/ui/roas-floor-actions-field";
import { Textarea } from "@walls/ui/textarea";

import {
  glassSegmentTrackClass,
  glassToggleCardActiveClass,
  glassToggleCardBaseClass,
  glassToggleCardInactiveClass,
  glassToggleChipActiveClass,
  glassToggleChipBaseClass,
  glassToggleChipInactiveClass,
  panelGlassClass,
  primaryButtonClass,
} from "@/components/ui/button-styles";
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
  agentInstructions: ProfileAgentInstruction[];
};

function profileToForm(profile: AutomationProfile): ProfileFormState {
  return {
    name: profile.name,
    description: profile.description ?? "",
    optimizationGoal: profile.optimizationGoal,
    isDefault: profile.isDefault,
    settings: profile.settings,
    agentInstructions: profile.agentInstructions ?? [],
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
  const [presetMenuOpen, setPresetMenuOpen] = React.useState(false);

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
        agentInstructions: form.agentInstructions,
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
        <div
          className={cn(
            "flex items-center justify-center gap-2 overflow-hidden rounded-[28px] py-16 text-sm font-light text-neutral-500",
            panelGlassClass,
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading automation presets…
        </div>
      </section>
    );
  }

  if (!form) {
    return (
      <section>
        <div
          className={cn(
            "overflow-hidden rounded-[28px] py-16 text-center text-sm font-light text-neutral-500",
            panelGlassClass,
          )}
        >
          No automation presets found.
        </div>
      </section>
    );
  }

  const riskScore = getRiskScore(form.settings);
  const projectedUplift = getProjectedWeeklyUplift(
    form.settings.aggressiveness,
    form.settings.maxDailyIncreasePct,
  );
  const autonomyLabel = getAggressivenessLabel(form.settings.aggressiveness);

  return (
    <section>
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <DropdownMenu open={presetMenuOpen} onOpenChange={setPresetMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full max-w-md items-center gap-3 overflow-hidden rounded-[28px] px-4 py-4 text-left transition md:px-5",
                panelGlassClass,
                "hover:bg-white/90",
                "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                presetMenuOpen && "bg-white/90",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {form.name || "Untitled preset"}
                </span>
                <span className="mt-0.5 block truncate text-xs text-neutral-500">
                  Optimize for {optimizationGoalLabel(form.optimizationGoal)}
                  {form.isDefault ? " · Default" : ""}
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
              {profiles.map((profile) => {
                const isExactMatch = selectedId === profile.id;
                return (
                  <DropdownMenuItem
                    key={profile.id}
                    onSelect={(event) => {
                      event.preventDefault();
                      selectProfile(profile);
                      setPresetMenuOpen(false);
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
              disabled={creating}
              onSelect={(event) => {
                event.preventDefault();
                void handleCreatePreset().then(() => setPresetMenuOpen(false));
              }}
              className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-transparent hover:bg-neutral-50"
            >
              <div className="flex items-center gap-2 text-sm text-foreground">
                {creating ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-neutral-400" />
                )}
                <span className="font-medium">Add preset</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          className={cn(
            "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
            panelGlassClass,
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingLabelInput
              label="Preset name"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
            />
            <FloatingLabelInput
              label="Description"
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
            />
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
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-4 md:px-5",
              panelGlassClass,
            )}
          >
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
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-4 md:px-5",
              panelGlassClass,
            )}
          >
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
          <div
            className={cn(
              "overflow-hidden rounded-[28px] px-4 py-4 md:px-5",
              panelGlassClass,
            )}
          >
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

        <div
          className={cn(
            "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
            panelGlassClass,
          )}
        >
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
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
            panelGlassClass,
          )}
        >
          <p className="text-sm font-medium text-foreground">Guardrails</p>
          <p className="mt-1 text-xs font-light text-neutral-500">
            Hard stops that pause or slow scaling before efficiency drops.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {form.optimizationGoal === "roas" || form.optimizationGoal === "conversions" ? (
              <div className="sm:col-span-2 space-y-5">
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
                <RoasFloorActionsField
                  value={form.settings.roasFloorActions}
                  onChange={(roasFloorActions) =>
                    updateSetting("roasFloorActions", roasFloorActions)
                  }
                />
              </div>
            ) : null}

            {form.optimizationGoal === "ctr" ? (
              <div className="space-y-2">
                <FloatingLabelInput
                  type="number"
                  min={0}
                  step={0.1}
                  label="CTR floor (%)"
                  value={form.settings.ctrFloorPct ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "ctrFloorPct",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
                <p className="text-xs font-light text-neutral-500">
                  Minimum click-through rate before scaling continues
                </p>
              </div>
            ) : null}

            {form.optimizationGoal === "cpa" || form.optimizationGoal === "conversions" ? (
              <div className="space-y-2">
                <FloatingLabelInput
                  type="number"
                  min={0}
                  step={1}
                  label="CPA ceiling"
                  value={form.settings.cpaCeiling ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "cpaCeiling",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
                <p className="text-xs font-light text-neutral-500">
                  Max cost per acquisition (USD)
                </p>
              </div>
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

        <div
          className={cn(
            "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
            panelGlassClass,
          )}
        >
          <p className="text-sm font-medium text-foreground">Safety</p>
          <div className="mt-5 space-y-5">
            <LabeledSwitch
              checked={form.settings.learningPhaseProtection}
              onCheckedChange={(value) => updateSetting("learningPhaseProtection", value)}
              label="Learning phase protection (recommended)"
              description="Block price adjustments while in learning stages."
            />
            <LabeledSwitch
              checked={form.settings.pauseOnFatigue}
              onCheckedChange={(value) => updateSetting("pauseOnFatigue", value)}
              label="Pause on frequency fatigue"
              description="Slow scaling when frequency rises and CTR drops week over week."
            />
          </div>
        </div>

        <div
          className={cn(
            "overflow-hidden rounded-[28px] px-4 py-5 md:px-6 md:py-6",
            panelGlassClass,
          )}
        >
          <p className="text-sm font-medium text-foreground">
            Agentic instructions
          </p>
          <p className="mt-1 text-xs font-light text-neutral-500">
            Natural-language guidance copied onto campaigns and ad sets when this
            preset is applied. Schedule windows can be set per entity afterward.
          </p>
          <div className="mt-5">
            <PresetAgentInstructionsEditor
              items={form.agentInstructions}
              onChange={(agentInstructions) => {
                setForm((prev) =>
                  prev ? { ...prev, agentInstructions } : prev,
                );
                setSaved(false);
              }}
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

function PresetAgentInstructionsEditor({
  items,
  onChange,
}: {
  items: ProfileAgentInstruction[];
  onChange: (items: ProfileAgentInstruction[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  const resetForm = () => {
    setDraft("");
    setEditingIndex(null);
    setShowForm(false);
  };

  const startCreate = () => {
    setDraft("");
    setEditingIndex(null);
    setShowForm(true);
  };

  const startEdit = (index: number) => {
    setDraft(items[index]?.instructions ?? "");
    setEditingIndex(index);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const instructions = draft.trim();
    if (!instructions) return;

    if (editingIndex != null) {
      onChange(
        items.map((item, index) =>
          index === editingIndex ? { instructions } : item,
        ),
      );
    } else {
      onChange([...items, { instructions }]);
    }
    resetForm();
  };

  const handleDelete = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    if (editingIndex === index) resetForm();
  };

  return (
    <div className="space-y-4">
      {items.length === 0 && !showForm ? (
        <p className="text-sm font-light text-neutral-500">
          No instructions yet. The agent will run on this preset&apos;s
          guardrails until you add guidance.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${index}-${item.instructions.slice(0, 24)}`}
              className="group rounded-2xl border border-dotted border-neutral-300 bg-transparent px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-light leading-relaxed text-neutral-700">
                  {item.instructions}
                </p>
                <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(index)}
                    aria-label="Edit instruction"
                    className="rounded-lg border border-neutral-200 bg-kenoo-white p-1.5 text-neutral-500 transition hover:text-neutral-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    aria-label="Delete instruction"
                    className="rounded-lg border border-neutral-200 bg-kenoo-white p-1.5 text-rose-600 transition hover:border-rose-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="space-y-4 rounded-2xl border border-dotted border-neutral-300 bg-transparent px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-800">
              {editingIndex != null ? "Edit instruction" : "New instruction"}
            </p>
            <button
              type="button"
              onClick={resetForm}
              aria-label="Cancel"
              className="rounded-lg border border-neutral-200 bg-kenoo-white p-1.5 text-neutral-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Scale daily budget as aggressively as allowed until we hit the ROAS floor."
            rows={3}
            className="rounded-xl border border-neutral-200 bg-kenoo-white px-3 py-2.5 font-light text-sm"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-neutral-200 bg-kenoo-white px-4 font-medium text-neutral-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!draft.trim()}
              onClick={handleSubmit}
              className={cn(primaryButtonClass, "inline-flex items-center gap-2")}
            >
              {editingIndex != null ? "Save changes" : "Add instruction"}
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
