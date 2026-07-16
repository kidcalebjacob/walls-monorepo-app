"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { cn } from "@walls/utils";

import type { DashboardAnalytics, DashboardStat } from "@/lib/analytics-server";
import { ZERO_DASHBOARD_STATS } from "@/lib/dashboard-defaults";
import { formatCalories } from "@/lib/format-health";
import type { TimeRangeValue } from "@/lib/time-range";
import { TIME_RANGE_OPTIONS } from "@/lib/time-range";

import { CalorieTrendChart } from "./calorie-trend-chart";
import { DayPulse } from "./day-pulse";
import {
  ArcScaleGraphic,
  DiamondGraphic,
  FunnelGraphic,
  GlowMetricCard,
  RingsGraphic,
  WaveGraphic,
} from "./glow-metric-card";

function statByLabel(stats: DashboardStat[], label: string) {
  return stats.find((stat) => stat.label === label);
}

function goalLabel(goalType: string | null | undefined) {
  if (!goalType) return "Not set";
  return goalType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function macroStatus(
  current: number,
  target: number | null,
): { label: string; tone: "on" | "low" | "high" } {
  if (target == null || target <= 0) return { label: "Tracking", tone: "on" };
  const ratio = current / target;
  if (ratio < 0.85) return { label: "Below target", tone: "low" };
  if (ratio > 1.1) return { label: "Above target", tone: "high" };
  return { label: "On track", tone: "on" };
}

export function DashboardPage() {
  const [analytics, setAnalytics] = React.useState<DashboardAnalytics | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<TimeRangeValue>("7d");
  const rightPanelRef = React.useRef<HTMLElement>(null);

  const forwardWheelToRight = React.useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      // Only remap on the split desktop layout.
      if (typeof window !== "undefined" && window.innerWidth < 1024) return;
      const panel = rightPanelRef.current;
      if (!panel) return;
      panel.scrollTop += event.deltaY;
    },
    [],
  );

  const loadDashboard = React.useCallback(async () => {
    const response = await fetch(`/api/analytics?range=${timeRange}`);
    if (response.ok) {
      const payload = (await response.json()) as DashboardAnalytics;
      setAnalytics(payload);
    }
  }, [timeRange]);

  React.useEffect(() => {
    void (async () => {
      try {
        await loadDashboard();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDashboard]);

  const stats = analytics?.stats ?? [...ZERO_DASHBOARD_STATS];
  const caloriesByDay = analytics?.caloriesByDay ?? [];
  const todayMeals = analytics?.todayMeals ?? [];
  const macros = analytics?.macros ?? [];
  const insights = analytics?.insights ?? [];
  const periodLabel = analytics?.periodLabel ?? "Last 7 days";
  const hasProfile = analytics?.hasProfile ?? false;
  const profile = analytics?.profile;

  const remaining = statByLabel(stats, "Remaining");
  const burned = statByLabel(stats, "Burned");
  const protein = macros.find((macro) => macro.label === "Protein");
  const carbs = macros.find((macro) => macro.label === "Carbs");
  const fat = macros.find((macro) => macro.label === "Fat");

  const proteinStatus = macroStatus(
    protein?.current ?? 0,
    protein?.target ?? null,
  );
  const remainingPositive = remaining?.positive ?? true;

  const todayConsumedKcal = todayMeals.reduce(
    (sum, meal) => sum + meal.calories,
    0,
  );
  const calorieProgress =
    analytics?.calorieTarget && analytics.calorieTarget > 0
      ? Math.min(
          100,
          Math.round((todayConsumedKcal / analytics.calorieTarget) * 100),
        )
      : todayMeals.length > 0
        ? 35
        : 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-kenoo-white px-6 py-16">
        <div className="flex items-center gap-2 text-sm font-light text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-kenoo-white lg:h-full lg:overflow-hidden">
      {!hasProfile ? (
        <div className="shrink-0 border-b border-amber-200/80 bg-amber-50/70 px-6 py-3 text-sm font-light text-amber-900 md:px-8">
          Set your calorie target and body metrics in{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Settings
          </Link>{" "}
          to unlock personalized tracking.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2 lg:overflow-hidden">
        {/* Left — stays put on desktop; wheel still scrolls the right panel */}
        <section
          className="relative flex flex-col bg-kenoo-white px-6 py-8 md:px-10 md:py-10 lg:h-full lg:min-h-0 lg:overflow-hidden"
          onWheel={forwardWheelToRight}
        >
          <DayPulse
            className="min-h-0 flex-1"
            title="Energy & Nutrition"
            progress={calorieProgress}
            centerValue={remaining?.value ?? "—"}
            centerLabel="Remaining"
            statusItems={[
              {
                label: "Goal",
                value: goalLabel(profile?.goal_type),
              },
              {
                label: "Daily burn",
                value: profile?.tdee_calories
                  ? formatCalories(profile.tdee_calories)
                  : "—",
              },
            ]}
          />
        </section>

        {/* Right — full-height scrollable metrics panel */}
        <section
          ref={rightPanelRef}
          className="bg-kenoo-white px-5 py-8 md:px-8 md:py-10 lg:h-full lg:overflow-y-auto lg:overscroll-contain"
        >
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <GlowMetricCard
              className="col-span-2 min-h-[200px] md:col-span-1 md:min-h-[240px] md:row-span-2"
              title="Energy balance"
              value={remaining?.value ?? "—"}
              detail={
                remainingPositive
                  ? `${remaining?.change ?? "Remaining"} · ${burned?.value ?? "0"} burned`
                  : "Over daily target"
              }
              tone="sage"
              graphic={<RingsGraphic />}
              delay={0.08}
            />

            <GlowMetricCard
              title="Protein"
              value={protein?.value ?? "0g"}
              detail={
                protein?.target != null
                  ? `${proteinStatus.label} · ${protein.target}g target`
                  : proteinStatus.label
              }
              tone="amber"
              graphic={<WaveGraphic />}
              delay={0.12}
            />

            <GlowMetricCard
              title="Carbs"
              value={carbs?.value ?? "0g"}
              detail={
                carbs?.target != null
                  ? `Target ${carbs.target}g`
                  : "No target set"
              }
              tone="spectrum"
              graphic={<ArcScaleGraphic />}
              delay={0.16}
            />

            <GlowMetricCard
              title="Meals logged"
              value={`${todayMeals.length}`}
              detail={
                todayMeals.length === 0
                  ? "Start your day"
                  : `${formatCalories(
                      todayMeals.reduce((sum, meal) => sum + meal.calories, 0),
                    )} today`
              }
              tone="coral"
              graphic={<DiamondGraphic />}
              delay={0.2}
              href="/meals"
            />

            <GlowMetricCard
              title="Fat"
              value={fat?.value ?? "0g"}
              detail={
                fat?.target != null ? `Target ${fat.target}g` : "Tracking"
              }
              tone="mist"
              graphic={<FunnelGraphic stroke="#1a1a1a" />}
              delay={0.24}
            />

            <GlowMetricCard
              className="col-span-2"
              title="Active burn"
              value={burned?.value ?? "0"}
              detail="From logged activities today"
              tone="lime"
              graphic={<WaveGraphic stroke="#1a1a1a" className="opacity-35" />}
              delay={0.28}
              href="/activities"
            />
          </div>

          {insights.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4">
              {insights.map((insight, index) => {
                const darkStroke =
                  insight.tone === "mist" || insight.tone === "lime";
                const stroke = darkStroke ? "#1a1a1a" : "white";
                const graphic = darkStroke ? (
                  index % 2 === 0 ? (
                    <WaveGraphic stroke={stroke} className="opacity-35" />
                  ) : (
                    <FunnelGraphic stroke={stroke} />
                  )
                ) : index % 5 === 0 ? (
                  <RingsGraphic />
                ) : index % 5 === 1 ? (
                  <WaveGraphic />
                ) : index % 5 === 2 ? (
                  <ArcScaleGraphic />
                ) : index % 5 === 3 ? (
                  <DiamondGraphic />
                ) : (
                  <FunnelGraphic />
                );

                return (
                  <GlowMetricCard
                    key={insight.id}
                    className={
                      insights.length % 2 === 1 && index === insights.length - 1
                        ? "col-span-2"
                        : undefined
                    }
                    title={insight.title}
                    value={insight.value}
                    detail={insight.detail}
                    tone={insight.tone}
                    graphic={graphic}
                    delay={0.3 + index * 0.04}
                    href={insight.href}
                  />
                );
              })}
            </div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.36,
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative mt-4 min-h-[160px] overflow-hidden rounded-[28px] p-5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] md:p-6"
            style={{
              background:
                "linear-gradient(145deg, #d9e2e8 0%, #b7c8d2 48%, #9bb0bd 100%)",
            }}
          >
            <div className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600">
                  Calories
                </p>
                <p className="mt-1 text-sm font-light text-neutral-700/80">
                  {periodLabel}
                </p>
              </div>
              <div className="flex gap-1 rounded-full bg-white/35 p-1 ring-1 ring-white/40 backdrop-blur-sm">
                {TIME_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeRange(option.value)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-light uppercase tracking-wider transition-colors",
                      timeRange === option.value
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:text-neutral-900",
                    )}
                  >
                    {option.label.replace("Last ", "")}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative z-10">
              <CalorieTrendChart days={caloriesByDay} variant="onGlow" />
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
