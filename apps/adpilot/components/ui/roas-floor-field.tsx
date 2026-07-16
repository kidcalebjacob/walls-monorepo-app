"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Percent, TrendingUp } from "lucide-react";

import { Input } from "@walls/ui/input";
import { Slider } from "@walls/ui/slider";
import { cn } from "@walls/utils";

import { SegmentThumb } from "@/components/settings/segment-thumb";
import {
  glassSegmentTrackClass,
  glassToggleChipActiveClass,
  glassToggleChipBaseClass,
  glassToggleChipInactiveClass,
} from "@/components/settings/button-styles";
import { formatRoas } from "@/lib/format-analytics";
import {
  CONTRIBUTION_MARGIN_PRESETS,
  getEffectiveRoasFloor,
  patchRoasFloorSettings,
  type RoasFloorInputMode,
  type SpendAutomationSettings,
} from "@/lib/spend-automation-settings";

type RoasFloorSlice = Pick<
  SpendAutomationSettings,
  "roasFloor" | "roasFloorInputMode" | "contributionMarginPct"
>;

type RoasFloorFieldProps = {
  settings: RoasFloorSlice;
  onChange: (patch: RoasFloorSlice) => void;
  variant?: "settings" | "detail";
  className?: string;
};

const MODE_OPTIONS: Array<{ value: RoasFloorInputMode; label: string }> = [
  { value: "direct", label: "ROAS floor" },
  { value: "margin", label: "Gross margin" },
];

function ModeToggle({
  mode,
  onChange,
  layoutId,
}: {
  mode: RoasFloorInputMode;
  onChange: (mode: RoasFloorInputMode) => void;
  layoutId: string;
}) {
  return (
    <div
      className={glassSegmentTrackClass}
      role="group"
      aria-label="ROAS floor input mode"
    >
      {MODE_OPTIONS.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              glassToggleChipBaseClass,
              active
                ? glassToggleChipActiveClass
                : glassToggleChipInactiveClass,
            )}
          >
            {active ? (
              <SegmentThumb layoutId={layoutId} variant="glass" />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RoasFloorField({
  settings,
  onChange,
  variant = "settings",
  className,
}: RoasFloorFieldProps) {
  const mode = settings.roasFloorInputMode ?? "direct";
  const marginPct = settings.contributionMarginPct ?? 50;
  const effectiveRoas = getEffectiveRoasFloor({
    ...settings,
    roasFloorInputMode: mode,
    contributionMarginPct: marginPct,
  } as SpendAutomationSettings);

  const applyPatch = (
    patch: Partial<RoasFloorSlice>,
  ) => {
    onChange(
      patchRoasFloorSettings(
        {
          ...settings,
          roasFloorInputMode: mode,
          contributionMarginPct: settings.contributionMarginPct,
        } as SpendAutomationSettings,
        patch,
      ),
    );
  };

  const layoutId = variant === "settings" ? "roas-floor-mode" : "roas-floor-mode-detail";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {mode === "margin" ? "Break-even guardrail" : "ROAS floor"}
          </p>
          <p className="mt-0.5 text-xs font-light text-neutral-500">
            {mode === "margin"
              ? "Set contribution margin — we derive the minimum ROAS to break even before ad spend."
              : "Minimum return before scaling continues."}
          </p>
        </div>
        <ModeToggle
          mode={mode}
          layoutId={layoutId}
          onChange={(nextMode) => applyPatch({ roasFloorInputMode: nextMode })}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mode === "direct" ? (
          <motion.div
            key="direct"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="No floor"
              value={settings.roasFloor ?? ""}
              onChange={(e) =>
                applyPatch({
                  roasFloor: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={cn(
                "rounded-full border-neutral-200 font-light",
                variant === "settings" ? "bg-neutral-50" : "bg-kenoo-white",
              )}
            />
          </motion.div>
        ) : (
          <motion.div
            key="margin"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-black/[0.08] bg-neutral-200/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-normal uppercase tracking-[0.14em] text-neutral-500">
                    Break-even ROAS
                  </p>
                  <p className="mt-1 text-3xl font-medium tracking-tight text-neutral-700">
                    {formatRoas(effectiveRoas)}
                  </p>
                  <p className="mt-1 text-xs font-light text-neutral-500">
                    1 ÷ {marginPct}% contribution margin
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/55 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150">
                  <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-[11px] font-normal uppercase tracking-[0.14em] text-neutral-500">
                  Contribution margin
                </p>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step={0.1}
                    value={settings.contributionMarginPct ?? ""}
                    onChange={(e) =>
                      applyPatch({
                        contributionMarginPct: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className={cn(
                      "h-8 w-20 rounded-full border-neutral-200 px-3 text-right text-sm font-medium tabular-nums",
                      variant === "settings" ? "bg-neutral-50" : "bg-kenoo-white",
                    )}
                  />
                  <Percent className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                </div>
              </div>
              <Slider
                value={[marginPct]}
                onValueChange={(next) =>
                  applyPatch({ contributionMarginPct: next[0] ?? marginPct })
                }
                min={1}
                max={100}
                step={1}
                aria-label="Contribution margin"
              />
              <div className="mt-2 flex justify-between text-[10px] font-light uppercase tracking-wider text-neutral-400">
                <span>1%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-normal uppercase tracking-[0.14em] text-neutral-500">
                Quick presets
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CONTRIBUTION_MARGIN_PRESETS.map((preset) => {
                  const active = marginPct === preset.marginPct;
                  return (
                    <button
                      key={preset.marginPct}
                      type="button"
                      onClick={() =>
                        applyPatch({ contributionMarginPct: preset.marginPct })
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] tabular-nums transition-all duration-200",
                        active
                          ? "border-white/70 bg-white/55 font-medium text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150"
                          : "border-transparent bg-neutral-100/80 font-medium text-neutral-400",
                      )}
                    >
                      {preset.marginPct}%
                      <span className="ml-1 font-light opacity-75">
                        · {formatRoas(preset.roasFloor)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
