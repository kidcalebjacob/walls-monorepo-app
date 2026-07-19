"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { cn } from "@walls/utils";

import type {
  DashboardAnalytics,
  DashboardStat,
} from "@/lib/analytics-server";
import {
  DEFAULT_VISIBLE_WIDGETS,
  APPLE_CARD_WIDGET_IDS,
  isWidgetVisible,
  type DashboardWidgetId,
} from "@/lib/dashboard-widgets";
import { ZERO_DASHBOARD_STATS } from "@/lib/dashboard-defaults";
import {
  formatCalories,
  formatDistanceMeters,
  formatSteps,
} from "@/lib/format-health";
import type { TimeRangeValue } from "@/lib/time-range";
import { TIME_RANGE_OPTIONS } from "@/lib/time-range";

import { ActivityTrendChart } from "./activity-trend-chart";
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
import { WidgetPicker } from "./widget-picker";

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

const APPLE_CARD_TONES = [
  "sage",
  "amber",
  "spectrum",
  "coral",
  "mist",
  "lime",
] as const;

function graphicForIndex(index: number, darkStroke: boolean) {
  const stroke = darkStroke ? "#1a1a1a" : "white";
  if (darkStroke) {
    return index % 2 === 0 ? (
      <WaveGraphic stroke={stroke} className="opacity-35" />
    ) : (
      <FunnelGraphic stroke={stroke} />
    );
  }
  switch (index % 5) {
    case 0:
      return <RingsGraphic />;
    case 1:
      return <WaveGraphic />;
    case 2:
      return <ArcScaleGraphic />;
    case 3:
      return <DiamondGraphic />;
    default:
      return <FunnelGraphic />;
  }
}

export function DashboardPage() {
  const [analytics, setAnalytics] = React.useState<DashboardAnalytics | null>(
    null,
  );
  const [visibleWidgets, setVisibleWidgets] = React.useState<
    DashboardWidgetId[]
  >([...DEFAULT_VISIBLE_WIDGETS]);
  const [widgetsSaving, setWidgetsSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<TimeRangeValue>("7d");
  const rightPanelRef = React.useRef<HTMLElement>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (payload.visibleWidgets?.length) {
        setVisibleWidgets(payload.visibleWidgets);
      }
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

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleWidgetsChange = React.useCallback(
    (next: DashboardWidgetId[]) => {
      setVisibleWidgets(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void (async () => {
          setWidgetsSaving(true);
          try {
            await fetch("/api/dashboard-widgets", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ visibleWidgets: next }),
            });
          } finally {
            setWidgetsSaving(false);
          }
        })();
      }, 350);
    },
    [],
  );

  const show = React.useCallback(
    (id: DashboardWidgetId) => isWidgetVisible(visibleWidgets, id),
    [visibleWidgets],
  );

  const stats = analytics?.stats ?? [...ZERO_DASHBOARD_STATS];
  const caloriesByDay = analytics?.caloriesByDay ?? [];
  const activityByDay = analytics?.activityByDay ?? [];
  const todayMeals = analytics?.todayMeals ?? [];
  const macros = analytics?.macros ?? [];
  const insights = analytics?.insights ?? [];
  const appleHealth = analytics?.appleHealth;
  const periodLabel = analytics?.periodLabel ?? "Last 7 days";
  const hasProfile = analytics?.hasProfile ?? false;
  const profile = analytics?.profile;

  const remaining = statByLabel(stats, "Remaining");
  const burned = statByLabel(stats, "Burned");
  const steps = statByLabel(stats, "Steps");
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

  const secondaryAppleCards =
    appleHealth?.cards.filter((card) => {
      if (card.label === "Steps") return false;
      const widgetId = APPLE_CARD_WIDGET_IDS[card.label];
      if (!widgetId) return false;
      return show(widgetId);
    }) ?? [];

  const coreCards = [
    show("energy_balance") ? (
      <GlowMetricCard
        key="energy_balance"
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
    ) : null,
    show("steps") ? (
      <GlowMetricCard
        key="steps"
        title="Steps"
        value={steps?.value ?? "0"}
        detail={
          appleHealth?.hasAppleHealth
            ? `${appleHealth.stepsProgress}% of ${formatSteps(appleHealth.stepsTarget)}${
                appleHealth.distanceMeters > 0
                  ? ` · ${formatDistanceMeters(appleHealth.distanceMeters, appleHealth.unitSystem)}`
                  : ""
              }`
            : "Connect Apple Health in Wallie"
        }
        tone="spectrum"
        graphic={<ArcScaleGraphic />}
        delay={0.1}
        href="/goals"
      />
    ) : null,
    show("protein") ? (
      <GlowMetricCard
        key="protein"
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
    ) : null,
    show("carbs") ? (
      <GlowMetricCard
        key="carbs"
        title="Carbs"
        value={carbs?.value ?? "0g"}
        detail={
          carbs?.target != null ? `Target ${carbs.target}g` : "No target set"
        }
        tone="coral"
        graphic={<DiamondGraphic />}
        delay={0.16}
      />
    ) : null,
    show("meals_logged") ? (
      <GlowMetricCard
        key="meals_logged"
        title="Meals logged"
        value={`${todayMeals.length}`}
        detail={
          todayMeals.length === 0
            ? "Start your day"
            : `${formatCalories(
                todayMeals.reduce((sum, meal) => sum + meal.calories, 0),
              )} today`
        }
        tone="mist"
        graphic={<FunnelGraphic stroke="#1a1a1a" />}
        delay={0.2}
        href="/meals"
      />
    ) : null,
    show("fat") ? (
      <GlowMetricCard
        key="fat"
        title="Fat"
        value={fat?.value ?? "0g"}
        detail={fat?.target != null ? `Target ${fat.target}g` : "Tracking"}
        tone="lime"
        graphic={<WaveGraphic stroke="#1a1a1a" className="opacity-35" />}
        delay={0.24}
      />
    ) : null,
    show("active_burn") ? (
      <GlowMetricCard
        key="active_burn"
        className="col-span-2"
        title="Active burn"
        value={burned?.value ?? "0"}
        detail={
          appleHealth?.activeEnergyKcal
            ? "From Apple Health active energy"
            : "From logged activities today"
        }
        tone="sage"
        graphic={<RingsGraphic />}
        delay={0.28}
        href="/activities"
      />
    ) : null,
  ].filter(Boolean);

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
                label: "Steps",
                value: steps?.value ?? "—",
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

        <section
          ref={rightPanelRef}
          className="bg-kenoo-white px-5 py-8 md:px-8 md:py-10 lg:h-full lg:overflow-y-auto lg:overscroll-contain"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                Today
              </p>
            </div>
            <WidgetPicker
              visibleWidgets={visibleWidgets}
              onChange={handleWidgetsChange}
              saving={widgetsSaving}
            />
          </div>

          {coreCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:gap-4">{coreCards}</div>
          ) : null}

          {secondaryAppleCards.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4">
              {secondaryAppleCards.map((card, index) => {
                const tone = APPLE_CARD_TONES[index % APPLE_CARD_TONES.length];
                const darkStroke = tone === "mist" || tone === "lime";
                return (
                  <GlowMetricCard
                    key={card.label}
                    className={
                      secondaryAppleCards.length % 2 === 1 &&
                      index === secondaryAppleCards.length - 1
                        ? "col-span-2"
                        : undefined
                    }
                    title={card.label}
                    value={card.value}
                    detail={card.change}
                    tone={tone}
                    graphic={graphicForIndex(index, darkStroke)}
                    delay={0.3 + index * 0.03}
                  />
                );
              })}
            </div>
          ) : null}

          {show("insights") && insights.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4">
              {insights.map((insight, index) => {
                const darkStroke =
                  insight.tone === "mist" || insight.tone === "lime";
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
                    graphic={graphicForIndex(index, darkStroke)}
                    delay={0.34 + index * 0.04}
                    href={insight.href}
                  />
                );
              })}
            </div>
          ) : null}

          {show("steps_chart") ? (
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
                  "linear-gradient(145deg, #6eadc0 0%, #4a8fa3 48%, #3a6f82 100%)",
              }}
            >
              <div className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
                    Steps
                  </p>
                  <p className="mt-1 text-sm font-light text-white/80">
                    {periodLabel}
                    {appleHealth?.hasAppleHealth
                      ? " · Apple Health"
                      : " · Preview"}
                  </p>
                </div>
                <div className="flex gap-1 rounded-full bg-white/20 p-1 ring-1 ring-white/30 backdrop-blur-sm">
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <button
                      key={`steps-${option.value}`}
                      type="button"
                      onClick={() => setTimeRange(option.value)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-light uppercase tracking-wider transition-colors",
                        timeRange === option.value
                          ? "bg-neutral-900 text-white"
                          : "text-white/80 hover:text-white",
                      )}
                    >
                      {option.label.replace("Last ", "")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative z-10">
                <ActivityTrendChart
                  days={activityByDay}
                  stepsTarget={appleHealth?.stepsTarget}
                  variant="onDark"
                />
              </div>
            </motion.div>
          ) : null}

          {show("calories_chart") ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.4,
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
          ) : null}
        </section>
      </div>
    </div>
  );
}
