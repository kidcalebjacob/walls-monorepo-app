import { createClient } from "@walls/supabase/server";

import {
  type AdDataScope,
  adScopeFields,
  withAdScope,
} from "@/lib/ad-scope";
import {
  BUDGET_OBJECTIVE_METRICS,
  BUDGET_OBJECTIVE_STATUSES,
  BUDGET_PERIOD_TYPES,
  BUDGET_TARGET_OPERATORS,
  isPeriodCurrentlyEffective,
  type BudgetObjective,
  type BudgetObjectiveMetric,
  type BudgetObjectiveStatus,
  type BudgetPeriod,
  type BudgetPeriodType,
  type BudgetTargetOperator,
} from "@/lib/budgets-shared";
import { META_PROVIDER } from "@/lib/connections";

const PERIOD_SELECT =
  "id, name, description, period_type, start_date, end_date, currency, budget_amount_micros, primary_focus, created_at, updated_at";

const OBJECTIVE_SELECT =
  "id, period_id, name, metric_key, custom_metric_label, target_value, target_operator, target_unit, is_primary, priority, status, notes, created_at, updated_at";

function asPeriodType(value: unknown): BudgetPeriodType {
  return BUDGET_PERIOD_TYPES.includes(value as BudgetPeriodType)
    ? (value as BudgetPeriodType)
    : "custom";
}

function asMetric(value: unknown): BudgetObjectiveMetric {
  return BUDGET_OBJECTIVE_METRICS.includes(value as BudgetObjectiveMetric)
    ? (value as BudgetObjectiveMetric)
    : "custom";
}

function asOperator(value: unknown): BudgetTargetOperator {
  return BUDGET_TARGET_OPERATORS.includes(value as BudgetTargetOperator)
    ? (value as BudgetTargetOperator)
    : "gte";
}

function asObjectiveStatus(value: unknown): BudgetObjectiveStatus {
  return BUDGET_OBJECTIVE_STATUSES.includes(value as BudgetObjectiveStatus)
    ? (value as BudgetObjectiveStatus)
    : "active";
}

function mapObjective(row: Record<string, unknown>): BudgetObjective {
  return {
    id: row.id as string,
    periodId: row.period_id as string,
    name: row.name as string,
    metricKey: asMetric(row.metric_key),
    customMetricLabel: (row.custom_metric_label as string | null) ?? null,
    targetValue: Number(row.target_value ?? 0),
    targetOperator: asOperator(row.target_operator),
    targetUnit: (row.target_unit as string | null) ?? null,
    isPrimary: Boolean(row.is_primary),
    priority: Number(row.priority ?? 0),
    status: asObjectiveStatus(row.status),
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

function mapPeriod(
  row: Record<string, unknown>,
  objectives: BudgetObjective[],
  spentMicros = 0,
): BudgetPeriod {
  const startDate = row.start_date as string;
  const endDate = (row.end_date as string | null) ?? null;
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    periodType: asPeriodType(row.period_type),
    startDate,
    endDate,
    currency: (row.currency as string) ?? "USD",
    budgetAmountMicros: Number(row.budget_amount_micros ?? 0),
    spentMicros,
    primaryFocus: (row.primary_focus as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? null,
    isCurrentlyEffective: isPeriodCurrentlyEffective({
      startDate,
      endDate,
    }),
    objectives,
  };
}

async function loadAccountSpendByDate(
  scope: AdDataScope,
  startDate: string,
  endDate: string,
): Promise<Array<{ metric_date: string; spend_micros: number }>> {
  const supabase = await createClient();

  const { data: accountEntities, error: accountError } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id")
      .eq("provider", META_PROVIDER)
      .eq("entity_type", "account"),
    scope,
  );

  if (accountError) throw accountError;
  const entityIds = (accountEntities ?? []).map((row) => row.id as string);
  if (entityIds.length === 0) return [];

  const { data: metrics, error: metricsError } = await supabase
    .from("ad_metrics_daily")
    .select("metric_date, spend_micros")
    .in("entity_id", entityIds)
    .gte("metric_date", startDate)
    .lte("metric_date", endDate);

  if (metricsError) throw metricsError;
  return (metrics ?? []) as Array<{ metric_date: string; spend_micros: number }>;
}

function spentForPeriod(
  rows: Array<{ metric_date: string; spend_micros: number }>,
  startDate: string,
  endDate: string | null,
  today: string,
): number {
  const inclusiveEnd = endDate && endDate < today ? endDate : today;
  let total = 0;
  for (const row of rows) {
    if (row.metric_date < startDate) continue;
    if (row.metric_date > inclusiveEnd) continue;
    total += Number(row.spend_micros ?? 0);
  }
  return total;
}

export async function listBudgetPeriods(
  scope: AdDataScope,
): Promise<BudgetPeriod[]> {
  const supabase = await createClient();

  const { data: periodRows, error: periodError } = await withAdScope(
    supabase.from("ad_budget_periods").select(PERIOD_SELECT),
    scope,
  ).order("start_date", { ascending: false });

  if (periodError) throw periodError;

  const periods = periodRows ?? [];
  if (periods.length === 0) return [];

  const periodIds = periods.map((p) => p.id as string);

  const { data: objectiveRows, error: objectiveError } = await withAdScope(
    supabase.from("ad_budget_objectives").select(OBJECTIVE_SELECT),
    scope,
  )
    .in("period_id", periodIds)
    .order("is_primary", { ascending: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (objectiveError) throw objectiveError;

  const objectivesByPeriod = new Map<string, BudgetObjective[]>();
  for (const row of objectiveRows ?? []) {
    const mapped = mapObjective(row);
    const list = objectivesByPeriod.get(mapped.periodId) ?? [];
    list.push(mapped);
    objectivesByPeriod.set(mapped.periodId, list);
  }

  const today = new Date().toISOString().slice(0, 10);
  const spendWindowStart = periods.reduce((min, row) => {
    const start = row.start_date as string;
    return start < min ? start : min;
  }, periods[0]!.start_date as string);
  const spendWindowEnd = periods.reduce((max, row) => {
    const end = ((row.end_date as string | null) ?? today);
    return end > max ? end : max;
  }, today);

  let spendRows: Array<{ metric_date: string; spend_micros: number }> = [];
  try {
    spendRows = await loadAccountSpendByDate(
      scope,
      spendWindowStart,
      spendWindowEnd,
    );
  } catch (error) {
    console.error("[adpilot] budget period spend:", error);
  }

  const mapped = periods.map((row) => {
    const startDate = row.start_date as string;
    const endDate = (row.end_date as string | null) ?? null;
    return mapPeriod(
      row,
      objectivesByPeriod.get(row.id as string) ?? [],
      spentForPeriod(spendRows, startDate, endDate, today),
    );
  });

  // Surface currently-effective periods first, then by start date.
  return mapped.sort((a, b) => {
    if (a.isCurrentlyEffective !== b.isCurrentlyEffective) {
      return a.isCurrentlyEffective ? -1 : 1;
    }
    return b.startDate.localeCompare(a.startDate);
  });
}

export type CreateBudgetPeriodInput = {
  name: string;
  description?: string | null;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate?: string | null;
  currency?: string;
  budgetAmountMicros?: number;
  primaryFocus?: string | null;
};

export async function createBudgetPeriod(input: {
  scope: AdDataScope;
  data: CreateBudgetPeriodInput;
}): Promise<BudgetPeriod> {
  const supabase = await createClient();
  const periodType = input.data.periodType;
  const endDate =
    periodType === "ongoing" ? null : (input.data.endDate ?? null);
  const budgetAmountMicros = Math.max(
    0,
    Math.round(input.data.budgetAmountMicros ?? 0),
  );

  const { data, error } = await supabase
    .from("ad_budget_periods")
    .insert({
      ...adScopeFields(input.scope),
      created_by: input.scope.userId,
      updated_by: input.scope.userId,
      name: input.data.name.trim(),
      description: input.data.description?.trim() || null,
      period_type: periodType,
      start_date: input.data.startDate,
      end_date: endDate,
      currency: (input.data.currency ?? "USD").toUpperCase(),
      budget_amount_micros: budgetAmountMicros,
      primary_focus: input.data.primaryFocus?.trim() || null,
    })
    .select(PERIOD_SELECT)
    .single();

  if (error) throw error;
  return mapPeriod(data, []);
}

export type UpdateBudgetPeriodInput = Partial<CreateBudgetPeriodInput>;

export async function updateBudgetPeriod(input: {
  scope: AdDataScope;
  periodId: string;
  patch: UpdateBudgetPeriodInput;
}): Promise<BudgetPeriod> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    updated_at: now,
    updated_by: input.scope.userId,
  };

  if (input.patch.name !== undefined) updates.name = input.patch.name.trim();
  if (input.patch.description !== undefined) {
    updates.description = input.patch.description?.trim() || null;
  }
  if (input.patch.periodType !== undefined) {
    updates.period_type = input.patch.periodType;
    if (input.patch.periodType === "ongoing") {
      updates.end_date = null;
    }
  }
  if (input.patch.startDate !== undefined) {
    updates.start_date = input.patch.startDate;
  }
  if (input.patch.endDate !== undefined) {
    updates.end_date = input.patch.endDate;
  }
  if (input.patch.currency !== undefined) {
    updates.currency = input.patch.currency.toUpperCase();
  }
  if (input.patch.budgetAmountMicros !== undefined) {
    updates.budget_amount_micros = Math.max(
      0,
      Math.round(input.patch.budgetAmountMicros),
    );
  }
  if (input.patch.primaryFocus !== undefined) {
    updates.primary_focus = input.patch.primaryFocus?.trim() || null;
  }

  const { data, error } = await withAdScope(
    supabase.from("ad_budget_periods").update(updates).select(PERIOD_SELECT),
    input.scope,
  )
    .eq("id", input.periodId)
    .single();

  if (error) throw error;

  const all = await listBudgetPeriods(input.scope);
  const refreshed = all.find((p) => p.id === input.periodId);
  if (refreshed) return refreshed;
  return mapPeriod(data, []);
}

export async function deleteBudgetPeriod(input: {
  scope: AdDataScope;
  periodId: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await withAdScope(
    supabase.from("ad_budget_periods").delete(),
    input.scope,
  ).eq("id", input.periodId);

  if (error) throw error;
}

export type CreateObjectiveInput = {
  name: string;
  metricKey: BudgetObjectiveMetric;
  customMetricLabel?: string | null;
  targetValue: number;
  targetOperator?: BudgetTargetOperator;
  targetUnit?: string | null;
  isPrimary?: boolean;
  priority?: number;
  status?: BudgetObjectiveStatus;
  notes?: string | null;
};

async function clearPrimaryObjective(
  scope: AdDataScope,
  periodId: string,
  exceptId?: string,
) {
  const supabase = await createClient();
  let query = withAdScope(
    supabase
      .from("ad_budget_objectives")
      .update({
        is_primary: false,
        updated_at: new Date().toISOString(),
        updated_by: scope.userId,
      }),
    scope,
  )
    .eq("period_id", periodId)
    .eq("is_primary", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function createBudgetObjective(input: {
  scope: AdDataScope;
  periodId: string;
  data: CreateObjectiveInput;
}): Promise<BudgetObjective> {
  const supabase = await createClient();

  if (input.data.isPrimary) {
    await clearPrimaryObjective(input.scope, input.periodId);
  }

  const { data, error } = await supabase
    .from("ad_budget_objectives")
    .insert({
      ...adScopeFields(input.scope),
      period_id: input.periodId,
      created_by: input.scope.userId,
      updated_by: input.scope.userId,
      name: input.data.name.trim(),
      metric_key: input.data.metricKey,
      custom_metric_label:
        input.data.metricKey === "custom"
          ? input.data.customMetricLabel?.trim() || null
          : null,
      target_value: input.data.targetValue,
      target_operator: input.data.targetOperator ?? "gte",
      target_unit: input.data.targetUnit?.trim() || null,
      is_primary: input.data.isPrimary ?? false,
      priority: input.data.priority ?? 0,
      status: input.data.status ?? "active",
      notes: input.data.notes?.trim() || null,
    })
    .select(OBJECTIVE_SELECT)
    .single();

  if (error) throw error;
  return mapObjective(data);
}

export type UpdateObjectiveInput = Partial<CreateObjectiveInput>;

export async function updateBudgetObjective(input: {
  scope: AdDataScope;
  objectiveId: string;
  periodId: string;
  patch: UpdateObjectiveInput;
}): Promise<BudgetObjective> {
  const supabase = await createClient();

  if (input.patch.isPrimary === true) {
    await clearPrimaryObjective(
      input.scope,
      input.periodId,
      input.objectiveId,
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: input.scope.userId,
  };

  if (input.patch.name !== undefined) updates.name = input.patch.name.trim();
  if (input.patch.metricKey !== undefined) {
    updates.metric_key = input.patch.metricKey;
    if (input.patch.metricKey !== "custom") {
      updates.custom_metric_label = null;
    }
  }
  if (input.patch.customMetricLabel !== undefined) {
    updates.custom_metric_label = input.patch.customMetricLabel?.trim() || null;
  }
  if (input.patch.targetValue !== undefined) {
    updates.target_value = input.patch.targetValue;
  }
  if (input.patch.targetOperator !== undefined) {
    updates.target_operator = input.patch.targetOperator;
  }
  if (input.patch.targetUnit !== undefined) {
    updates.target_unit = input.patch.targetUnit?.trim() || null;
  }
  if (input.patch.isPrimary !== undefined) {
    updates.is_primary = input.patch.isPrimary;
  }
  if (input.patch.priority !== undefined) {
    updates.priority = input.patch.priority;
  }
  if (input.patch.status !== undefined) updates.status = input.patch.status;
  if (input.patch.notes !== undefined) {
    updates.notes = input.patch.notes?.trim() || null;
  }

  const { data, error } = await withAdScope(
    supabase
      .from("ad_budget_objectives")
      .update(updates)
      .select(OBJECTIVE_SELECT),
    input.scope,
  )
    .eq("id", input.objectiveId)
    .single();

  if (error) throw error;
  return mapObjective(data);
}

export async function deleteBudgetObjective(input: {
  scope: AdDataScope;
  objectiveId: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await withAdScope(
    supabase.from("ad_budget_objectives").delete(),
    input.scope,
  ).eq("id", input.objectiveId);

  if (error) throw error;
}
