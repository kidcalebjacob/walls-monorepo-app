"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Gauge,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  MoreHorizontal,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@walls/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@walls/ui/dropdown-menu";
import { Textarea } from "@walls/ui/textarea";
import { cn } from "@walls/utils";

import {
  OBJECTIVE_METRIC_OPTIONS,
  PERIOD_TYPE_OPTIONS,
  PRIMARY_FOCUS_OPTIONS,
  TARGET_OPERATOR_OPTIONS,
  budgetUsedRatio,
  computePeriodEndDate,
  formatBudgetCurrency,
  formatBudgetUsedPercent,
  formatObjectiveTarget,
  formatPeriodRange,
  metricLabel,
  microsToDollars,
  periodTypeLabel,
  type BudgetObjective,
  type BudgetObjectiveMetric,
  type BudgetPeriod,
  type BudgetPeriodType,
  type BudgetTargetOperator,
} from "@/lib/budgets-shared";

import {
  panelGlassClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { FloatingLabelDatePicker } from "@/components/ui/floating-label-date-picker";
import { SectionLabel } from "@/components/settings/section-label";
import { HeroStat, HeroStatsBar } from "@/components/dashboard/dashboard-metrics";

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toIsoDate(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDaysLeft(period: BudgetPeriod): string {
  if (period.periodType === "ongoing" || !period.endDate) {
    return "Ongoing";
  }
  const end = parseIsoDate(period.endDate);
  if (!end) return "Ongoing";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < today) return "Ended";

  const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 1) return days === 1 ? "1 day left" : "Ends today";
  return `${days} days left`;
}

function periodSpendStats(period: BudgetPeriod) {
  const budgetMicros = period.budgetAmountMicros;
  const spentMicros = period.spentMicros ?? 0;
  const remainingMicros = Math.max(0, budgetMicros - spentMicros);
  const usedRatio = budgetUsedRatio(budgetMicros, spentMicros);
  return { budgetMicros, spentMicros, remainingMicros, usedRatio };
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="pt-2">
      <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-12 w-full items-center justify-between rounded-2xl border border-neutral-200 bg-kenoo-white px-4 outline-none transition hover:border-neutral-300"
          >
            <span className="truncate text-[15px] font-light text-neutral-900">
              {selected?.label ?? "Select"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-neutral-400 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="z-50 max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-2xl border-0 bg-kenoo-white p-1.5 font-light shadow-xl"
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "cursor-pointer rounded-xl px-3 py-2.5 text-sm font-light",
                option.value === value
                  ? "bg-neutral-100"
                  : "hover:bg-neutral-50",
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type PeriodFormState = {
  name: string;
  description: string;
  periodType: BudgetPeriodType;
  startDate: Date | null;
  endDate: Date | null;
  amountDollars: string;
  primaryFocus: string;
};

function emptyPeriodForm(): PeriodFormState {
  return {
    name: "",
    description: "",
    periodType: "quarter",
    startDate: null,
    endDate: null,
    amountDollars: "",
    primaryFocus: "",
  };
}

function periodToForm(period: BudgetPeriod): PeriodFormState {
  const periodType =
    period.periodType === "custom" ? "quarter" : period.periodType;
  const startDate = parseIsoDate(period.startDate);
  const focus = period.primaryFocus?.trim() ?? "";
  return {
    name: period.name,
    description: period.description ?? "",
    periodType,
    startDate,
    endDate:
      periodType === "ongoing"
        ? null
        : computePeriodEndDate(startDate, periodType) ??
          parseIsoDate(period.endDate),
    amountDollars: String(microsToDollars(period.budgetAmountMicros)),
    primaryFocus: PRIMARY_FOCUS_OPTIONS.some((o) => o.value === focus)
      ? focus
      : "",
  };
}

type ObjectiveFormState = {
  name: string;
  metricKey: BudgetObjectiveMetric;
  customMetricLabel: string;
  targetValue: string;
  targetOperator: BudgetTargetOperator;
  targetUnit: string;
  isPrimary: boolean;
  notes: string;
};

function emptyObjectiveForm(): ObjectiveFormState {
  return {
    name: "Primary ROAS",
    metricKey: "roas",
    customMetricLabel: "",
    targetValue: "3",
    targetOperator: "gte",
    targetUnit: "x",
    isPrimary: true,
    notes: "",
  };
}

export function BudgetsPage() {
  const [periods, setPeriods] = React.useState<BudgetPeriod[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [creatingPeriod, setCreatingPeriod] = React.useState(false);
  const [editingPeriod, setEditingPeriod] = React.useState(false);
  const [periodForm, setPeriodForm] = React.useState<PeriodFormState>(
    emptyPeriodForm,
  );

  const [addingObjective, setAddingObjective] = React.useState(false);
  const [objectiveForm, setObjectiveForm] = React.useState<ObjectiveFormState>(
    emptyObjectiveForm,
  );
  const [editingObjectiveId, setEditingObjectiveId] = React.useState<
    string | null
  >(null);

  const selected = periods.find((p) => p.id === selectedId) ?? null;

  const loadPeriods = React.useCallback(async (preferId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/budgets");
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load budgets");
      }
      const payload = (await response.json()) as { periods: BudgetPeriod[] };
      setPeriods(payload.periods);
      setSelectedId((current) => {
        if (preferId && payload.periods.some((p) => p.id === preferId)) {
          return preferId;
        }
        if (current && payload.periods.some((p) => p.id === current)) {
          return current;
        }
        return (
          payload.periods.find((p) => p.isCurrentlyEffective)?.id ??
          payload.periods[0]?.id ??
          null
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const startCreatePeriod = () => {
    setCreatingPeriod(true);
    setEditingPeriod(false);
    setPeriodForm(emptyPeriodForm());
  };

  const startEditPeriod = (period: BudgetPeriod) => {
    setEditingPeriod(true);
    setCreatingPeriod(false);
    setPeriodForm(periodToForm(period));
  };

  const cancelPeriodForm = () => {
    setCreatingPeriod(false);
    setEditingPeriod(false);
  };

  const savePeriod = async () => {
    if (!periodForm.name.trim() || !periodForm.startDate) {
      setError("Name and start date are required.");
      return;
    }
    if (periodForm.periodType !== "ongoing" && !periodForm.endDate) {
      setError("End date is required unless the period is ongoing.");
      return;
    }
    const amountDollars = Number(periodForm.amountDollars);
    if (!Number.isFinite(amountDollars) || amountDollars < 0) {
      setError("Budget amount must be a valid non-negative number.");
      return;
    }

    setBusy(true);
    setError(null);

    const body = {
      name: periodForm.name.trim(),
      description: periodForm.description.trim() || null,
      periodType: periodForm.periodType,
      startDate: toIsoDate(periodForm.startDate),
      endDate:
        periodForm.periodType === "ongoing"
          ? null
          : toIsoDate(periodForm.endDate),
      budgetAmountDollars: amountDollars,
      primaryFocus: periodForm.primaryFocus.trim() || null,
    };

    const isEdit = editingPeriod && selected;
    const response = await fetch(
      isEdit ? `/api/budgets/${selected.id}` : "/api/budgets",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to save period");
      return;
    }

    const payload = (await response.json()) as { period: BudgetPeriod };
    cancelPeriodForm();
    await loadPeriods(payload.period.id);
  };

  const deletePeriod = async (period: BudgetPeriod) => {
    if (
      !window.confirm(
        `Delete “${period.name}” and all of its objectives?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/budgets/${period.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to delete period");
      return;
    }
    await loadPeriods(null);
  };

  const saveObjective = async () => {
    if (!selected) return;
    const targetValue = Number(objectiveForm.targetValue);
    if (!objectiveForm.name.trim() || !Number.isFinite(targetValue)) {
      setError("Objective name and target value are required.");
      return;
    }
    if (
      objectiveForm.metricKey === "custom" &&
      !objectiveForm.customMetricLabel.trim()
    ) {
      setError("Custom metric label is required.");
      return;
    }

    setBusy(true);
    setError(null);

    const body = {
      name: objectiveForm.name.trim(),
      metricKey: objectiveForm.metricKey,
      customMetricLabel: objectiveForm.customMetricLabel.trim() || null,
      targetValue,
      targetOperator: objectiveForm.targetOperator,
      targetUnit: objectiveForm.targetUnit.trim() || null,
      isPrimary: objectiveForm.isPrimary,
      notes: objectiveForm.notes.trim() || null,
    };

    const isEdit = Boolean(editingObjectiveId);
    const response = await fetch(
      isEdit
        ? `/api/budgets/${selected.id}/objectives/${editingObjectiveId}`
        : `/api/budgets/${selected.id}/objectives`,
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to save objective");
      return;
    }

    setAddingObjective(false);
    setEditingObjectiveId(null);
    setObjectiveForm(emptyObjectiveForm());
    await loadPeriods(selected.id);
  };

  const deleteObjective = async (objective: BudgetObjective) => {
    if (!selected) return;
    if (!window.confirm(`Delete objective “${objective.name}”?`)) return;
    setBusy(true);
    const response = await fetch(
      `/api/budgets/${selected.id}/objectives/${objective.id}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to delete objective");
      return;
    }
    await loadPeriods(selected.id);
  };

  const showPeriodForm = creatingPeriod || editingPeriod;

  return (
    <main className="min-h-full w-full bg-kenoo-white px-6 py-8 md:px-10 md:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Budgets
            </h1>
            <p className="mt-2 max-w-xl text-sm font-light leading-6 text-neutral-500">
              Plan period budgets and objectives: quarters, fiscal years, or
              ongoing targets.
            </p>
          </div>
          {!showPeriodForm ? (
            <Button
              type="button"
              onClick={startCreatePeriod}
              className={cn(primaryButtonClass, "shrink-0")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New period
            </Button>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {showPeriodForm ? (
          <PeriodEditor
            title={creatingPeriod ? "New planning period" : "Edit period"}
            form={periodForm}
            setForm={setPeriodForm}
            busy={busy}
            onCancel={cancelPeriodForm}
            onSave={() => void savePeriod()}
          />
        ) : null}

        {loading ? (
          <div
            className={cn(
              "flex items-center justify-center gap-2 rounded-[28px] py-16 text-sm font-light text-neutral-500",
              panelGlassClass,
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading budget periods…
          </div>
        ) : periods.length === 0 && !showPeriodForm ? (
          <EmptyState onCreate={startCreatePeriod} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            <aside className="space-y-2.5">
              <SectionLabel title="Periods" />
              {periods.map((period) => {
                const isActive = selectedId === period.id;
                const { budgetMicros, spentMicros, usedRatio } =
                  periodSpendStats(period);
                const usageFillPct = Math.min(100, usedRatio * 100);
                const isOverBudget = usedRatio > 1;
                return (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(period.id);
                      setAddingObjective(false);
                      setEditingObjectiveId(null);
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "w-full rounded-[22px] px-4 py-4 text-left transition-all duration-200 ease-out",
                      isActive
                        ? panelGlassClass
                        : "bg-neutral-100/45 shadow-none hover:bg-neutral-100/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm text-foreground",
                          isActive ? "font-semibold" : "font-medium",
                        )}
                      >
                        {period.name}
                      </p>
                      {period.isCurrentlyEffective ? (
                        <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-kenoo-sky">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-xs font-light text-neutral-500">
                      {formatPeriodRange(period.startDate, period.endDate)}
                    </p>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {formatBudgetCurrency(budgetMicros, period.currency, {
                          compact: true,
                        })}
                      </p>
                      {spentMicros > 0 ? (
                        <p className="text-[11px] font-light tabular-nums text-neutral-500">
                          {formatBudgetCurrency(spentMicros, period.currency, {
                            compact: true,
                          })}{" "}
                          spent
                        </p>
                      ) : null}
                    </div>
                    {budgetMicros > 0 ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.05]">
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-out"
                          style={{
                            width: `${usageFillPct}%`,
                            background: isOverBudget
                              ? "linear-gradient(90deg, #fb7185 0%, #f59e0b 100%)"
                              : "linear-gradient(90deg, #c4b5fd 0%, #93c5fd 55%, #38bdf8 100%)",
                          }}
                        />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </aside>

            <div className="min-w-0">
              {selected ? (
                <PeriodDetail
                  period={selected}
                  busy={busy}
                  onEdit={() => startEditPeriod(selected)}
                  onDelete={() => void deletePeriod(selected)}
                  addingObjective={addingObjective}
                  setAddingObjective={setAddingObjective}
                  objectiveForm={objectiveForm}
                  setObjectiveForm={setObjectiveForm}
                  editingObjectiveId={editingObjectiveId}
                  setEditingObjectiveId={setEditingObjectiveId}
                  onSaveObjective={() => void saveObjective()}
                  onDeleteObjective={(o) => void deleteObjective(o)}
                  onStartEditObjective={(objective) => {
                    setEditingObjectiveId(objective.id);
                    setAddingObjective(true);
                    setObjectiveForm({
                      name: objective.name,
                      metricKey: objective.metricKey,
                      customMetricLabel: objective.customMetricLabel ?? "",
                      targetValue: String(objective.targetValue),
                      targetOperator: objective.targetOperator,
                      targetUnit: objective.targetUnit ?? "",
                      isPrimary: objective.isPrimary,
                      notes: objective.notes ?? "",
                    });
                  }}
                />
              ) : (
                <div
                  className={cn(
                    "rounded-[28px] px-6 py-16 text-center text-sm font-light text-neutral-500",
                    panelGlassClass,
                  )}
                >
                  Select a period to manage objectives.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-[28px] px-6 py-16 text-center",
        panelGlassClass,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        <Landmark className="h-5 w-5" />
      </span>
      <div>
        <p className="text-base font-medium text-foreground">
          No budget periods yet
        </p>
        <p className="mt-1.5 max-w-sm text-sm font-light text-neutral-500">
          Create a quarter or ongoing period, set a planned budget amount, and
          define primary objectives like ROAS or brand recognition.
        </p>
      </div>
      <Button type="button" onClick={onCreate} className={primaryButtonClass}>
        <Plus className="mr-2 h-4 w-4" />
        Create first period
      </Button>
    </div>
  );
}

function PeriodEditor({
  title,
  form,
  setForm,
  busy,
  onCancel,
  onSave,
}: {
  title: string;
  form: PeriodFormState;
  setForm: React.Dispatch<React.SetStateAction<PeriodFormState>>;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className={cn("rounded-[28px] px-5 py-6 md:px-7 md:py-7", panelGlassClass)}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Planning period
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FloatingLabelInput
          label="Period name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <FloatingLabelInput
          label="Budget amount (USD)"
          inputMode="decimal"
          value={form.amountDollars}
          onChange={(e) =>
            setForm((f) => ({ ...f, amountDollars: e.target.value }))
          }
        />
        <SelectField
          label="Type"
          value={form.periodType}
          options={PERIOD_TYPE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          onChange={(periodType) =>
            setForm((f) => ({
              ...f,
              periodType,
              endDate: computePeriodEndDate(f.startDate, periodType),
            }))
          }
        />
        <SelectField
          label="Primary focus"
          value={form.primaryFocus}
          options={[
            { value: "", label: "None" },
            ...PRIMARY_FOCUS_OPTIONS,
          ]}
          onChange={(primaryFocus) =>
            setForm((f) => ({ ...f, primaryFocus }))
          }
        />
        <FloatingLabelDatePicker
          label="Start date"
          value={form.startDate}
          onChange={(startDate) =>
            setForm((f) => ({
              ...f,
              startDate,
              endDate: computePeriodEndDate(startDate, f.periodType),
            }))
          }
        />
        {form.periodType !== "ongoing" ? (
          <FloatingLabelDatePicker
            label="End date"
            value={form.endDate}
            onChange={() => undefined}
            disabled
            showClearButton={false}
          />
        ) : (
          <div className="flex items-end">
            <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-3 text-sm font-light text-neutral-500">
              Ongoing — remains in effect until deleted
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Textarea
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Notes for this planning period…"
          className="min-h-[88px] rounded-2xl border-neutral-200 bg-kenoo-white font-light"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={onSave}
          className={primaryButtonClass}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save period
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={secondaryButtonClass}
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}

function PeriodDetail({
  period,
  busy,
  onEdit,
  onDelete,
  addingObjective,
  setAddingObjective,
  objectiveForm,
  setObjectiveForm,
  editingObjectiveId,
  setEditingObjectiveId,
  onSaveObjective,
  onDeleteObjective,
  onStartEditObjective,
}: {
  period: BudgetPeriod;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  addingObjective: boolean;
  setAddingObjective: (v: boolean) => void;
  objectiveForm: ObjectiveFormState;
  setObjectiveForm: React.Dispatch<React.SetStateAction<ObjectiveFormState>>;
  editingObjectiveId: string | null;
  setEditingObjectiveId: (id: string | null) => void;
  onSaveObjective: () => void;
  onDeleteObjective: (o: BudgetObjective) => void;
  onStartEditObjective: (o: BudgetObjective) => void;
}) {
  const { budgetMicros, spentMicros, remainingMicros, usedRatio } =
    periodSpendStats(period);

  return (
    <div className="space-y-8">
      <HeroStatsBar
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {period.name}
              </h2>
              <p className="mt-1.5 text-sm font-light text-neutral-500">
                {formatPeriodRange(period.startDate, period.endDate)}
                {" · "}
                {periodTypeLabel(period.periodType)}
              </p>
              {period.description ? (
                <p className="mt-2 text-sm font-light leading-6 text-neutral-500">
                  {period.description}
                </p>
              ) : null}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Period actions"
                  className="rounded-full p-2 text-neutral-400 outline-none transition hover:text-neutral-600 focus:outline-none focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-50 min-w-[8rem] overflow-hidden rounded-[15px] border-0 bg-white/90 p-1 font-light text-foreground shadow-md backdrop-blur-xl"
              >
                <DropdownMenuItem
                  disabled={busy}
                  onSelect={onEdit}
                  className="cursor-pointer rounded-[10px] py-1.5 pl-3 pr-3 text-sm font-light outline-none hover:bg-neutral-100 focus:bg-neutral-100"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busy}
                  onSelect={onDelete}
                  className="cursor-pointer rounded-[10px] py-1.5 pl-3 pr-3 text-sm font-light text-rose-600 outline-none hover:bg-neutral-100 focus:bg-neutral-100 focus:text-rose-600"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        footer={
          <BudgetUsageBar
            budgetMicros={budgetMicros}
            spentMicros={spentMicros}
            remainingMicros={remainingMicros}
            usedRatio={usedRatio}
            currency={period.currency}
          />
        }
      >
        <HeroStat
          label="Planned budget"
          value={formatBudgetCurrency(budgetMicros, period.currency)}
          icon={Wallet}
          accentColor="var(--kenoo-sky)"
        />
        <HeroStat
          label="Ad spend"
          value={formatBudgetCurrency(spentMicros, period.currency)}
          icon={CircleDollarSign}
          accentColor="var(--kenoo-blue)"
        />
        <HeroStat
          label="Remaining"
          value={formatBudgetCurrency(remainingMicros, period.currency)}
          icon={Landmark}
          accentColor="#00d1c1"
        />
        <HeroStat
          label="Budget used"
          value={formatBudgetUsedPercent(usedRatio)}
          icon={Gauge}
          accentColor="#7a04eb"
        />
        <HeroStat
          label="Days left"
          value={formatDaysLeft(period)}
          icon={CalendarDays}
          accentColor="#f59e0b"
        />
        <HeroStat
          label="Primary focus"
          value={period.primaryFocus?.trim() || "Not set"}
          icon={Star}
          accentColor="#10b981"
        />
      </HeroStatsBar>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionLabel
            title="Objectives"
            description="Primary and supporting KPIs for this period: ROAS, CTR, recognition, and more."
          />
          {!addingObjective ? (
            <Button
              type="button"
              onClick={() => {
                setEditingObjectiveId(null);
                setObjectiveForm({
                  ...emptyObjectiveForm(),
                  isPrimary: period.objectives.length === 0,
                });
                setAddingObjective(true);
              }}
              className={cn(secondaryButtonClass, "shrink-0")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>

        {addingObjective ? (
          <div
            className={cn(
              "mb-4 rounded-[24px] px-4 py-5 md:px-5",
              panelGlassClass,
            )}
          >
            <p className="mb-3 text-sm font-medium text-foreground">
              {editingObjectiveId ? "Edit objective" : "New objective"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FloatingLabelInput
                label="Name"
                value={objectiveForm.name}
                onChange={(e) =>
                  setObjectiveForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <SelectField
                label="Metric"
                value={objectiveForm.metricKey}
                options={OBJECTIVE_METRIC_OPTIONS.map((m) => ({
                  value: m.value,
                  label: m.label,
                }))}
                onChange={(metricKey) => {
                  const defaults = OBJECTIVE_METRIC_OPTIONS.find(
                    (m) => m.value === metricKey,
                  );
                  setObjectiveForm((f) => ({
                    ...f,
                    metricKey,
                    targetOperator:
                      defaults?.defaultOperator ?? f.targetOperator,
                    targetUnit: defaults?.defaultUnit ?? "",
                    name:
                      f.name === emptyObjectiveForm().name ||
                      OBJECTIVE_METRIC_OPTIONS.some(
                        (m) => m.label === f.name || `Primary ${m.label}` === f.name,
                      )
                        ? metricKey === "custom"
                          ? "Custom objective"
                          : `Primary ${defaults?.label ?? metricKey}`
                        : f.name,
                  }));
                }}
              />
              {objectiveForm.metricKey === "custom" ? (
                <FloatingLabelInput
                  label="Custom metric label"
                  value={objectiveForm.customMetricLabel}
                  onChange={(e) =>
                    setObjectiveForm((f) => ({
                      ...f,
                      customMetricLabel: e.target.value,
                    }))
                  }
                />
              ) : null}
              <SelectField
                label="Operator"
                value={objectiveForm.targetOperator}
                options={TARGET_OPERATOR_OPTIONS.map((o) => ({
                  value: o.value,
                  label: `${o.symbol} ${o.label}`,
                }))}
                onChange={(targetOperator) =>
                  setObjectiveForm((f) => ({ ...f, targetOperator }))
                }
              />
              <FloatingLabelInput
                label="Target value"
                inputMode="decimal"
                value={objectiveForm.targetValue}
                onChange={(e) =>
                  setObjectiveForm((f) => ({
                    ...f,
                    targetValue: e.target.value,
                  }))
                }
              />
              <FloatingLabelInput
                label="Unit (x, %, $…)"
                value={objectiveForm.targetUnit}
                onChange={(e) =>
                  setObjectiveForm((f) => ({
                    ...f,
                    targetUnit: e.target.value,
                  }))
                }
              />
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2.5 px-1">
              <input
                type="checkbox"
                checked={objectiveForm.isPrimary}
                onChange={(e) =>
                  setObjectiveForm((f) => ({
                    ...f,
                    isPrimary: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm font-light text-neutral-600">
                Primary objective for this period
              </span>
            </label>

            <div className="mt-3">
              <Textarea
                value={objectiveForm.notes}
                onChange={(e) =>
                  setObjectiveForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Notes…"
                className="min-h-[72px] rounded-2xl border-neutral-200 bg-kenoo-white font-light"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={onSaveObjective}
                className={primaryButtonClass}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save objective
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAddingObjective(false);
                  setEditingObjectiveId(null);
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {period.objectives.length === 0 && !addingObjective ? (
          <div
            className={cn(
              "rounded-[24px] px-5 py-10 text-center text-sm font-light text-neutral-500",
              panelGlassClass,
            )}
          >
            No objectives yet. Set a primary ROAS, CTR, or recognition target.
          </div>
        ) : (
          <ul className="space-y-2">
            {period.objectives.map((objective) => (
              <li
                key={objective.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-[22px] px-4 py-4 md:px-5",
                  panelGlassClass,
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {objective.name}
                    </p>
                    {objective.isPrimary ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200/80">
                        <Star className="h-3 w-3" />
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-light text-neutral-500">
                    {metricLabel(
                      objective.metricKey,
                      objective.customMetricLabel,
                    )}{" "}
                    · {formatObjectiveTarget(objective)}
                  </p>
                  {objective.notes ? (
                    <p className="mt-1.5 text-xs font-light text-neutral-400">
                      {objective.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label="Edit objective"
                    onClick={() => onStartEditObjective(objective)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Delete objective"
                    onClick={() => onDeleteObjective(objective)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BudgetUsageBar({
  budgetMicros,
  spentMicros,
  remainingMicros,
  usedRatio,
  currency,
}: {
  budgetMicros: number;
  spentMicros: number;
  remainingMicros: number;
  usedRatio: number;
  currency: string;
}) {
  const isOverBudget = usedRatio > 1;
  const displayPct = usedRatio * 100;
  const visualPct = Math.min(100, displayPct);
  const segmentCount = 4;
  const segmentFills = Array.from({ length: segmentCount }, (_, index) => {
    const start = (index / segmentCount) * 100;
    const end = ((index + 1) / segmentCount) * 100;
    if (visualPct <= start) return 0;
    if (visualPct >= end) return 100;
    return ((visualPct - start) / (end - start)) * 100;
  });

  const gradient = isOverBudget
    ? "linear-gradient(90deg, #fb7185 0%, #fbbf24 55%, #f59e0b 100%)"
    : "linear-gradient(90deg, #c4b5fd 0%, #93c5fd 55%, #38bdf8 100%)";

  const percentLabel =
    displayPct >= 10
      ? `${Math.round(displayPct)}%`
      : displayPct > 0
        ? `${displayPct.toFixed(1)}%`
        : "0%";

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="w-16 shrink-0 sm:w-20">
          <p className="text-2xl font-black tabular-nums tracking-tight text-neutral-800 sm:text-3xl">
            {percentLabel}
          </p>
          <p className="mt-0.5 text-[10px] font-normal uppercase tracking-[0.14em] text-neutral-400">
            Used
          </p>
        </div>

        <div className="relative min-w-0 flex-1 py-1">
          <div className="flex gap-1.5 sm:gap-2">
            {segmentFills.map((fill, index) => (
              <div
                key={index}
                className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.05] sm:h-3"
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: gradient,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${fill}%` }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.08 + index * 0.06,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm font-light text-neutral-500">
        {budgetMicros <= 0 ? (
          "Set a planned budget to track spend."
        ) : isOverBudget ? (
          <>
            <span className="font-medium tabular-nums text-neutral-800">
              {formatBudgetCurrency(spentMicros, currency)}
            </span>
            {" of "}
            <span className="tabular-nums text-neutral-700">
              {formatBudgetCurrency(budgetMicros, currency)}
            </span>
            {" spent · "}
            <span className="font-medium tabular-nums text-rose-600">
              {formatBudgetCurrency(spentMicros - budgetMicros, currency)}
            </span>
            {" over budget"}
          </>
        ) : (
          <>
            <span className="font-medium tabular-nums text-neutral-800">
              {formatBudgetCurrency(spentMicros, currency)}
            </span>
            {" of "}
            <span className="tabular-nums text-neutral-700">
              {formatBudgetCurrency(budgetMicros, currency)}
            </span>
            {" spent · "}
            <span className="font-medium tabular-nums text-neutral-800">
              {formatBudgetCurrency(remainingMicros, currency)}
            </span>
            {" remaining"}
          </>
        )}
      </p>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
    >
      {children}
    </button>
  );
}
