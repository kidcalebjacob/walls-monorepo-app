import { NextResponse } from "next/server";

import { getAdDataScope } from "@/lib/ad-scope";
import { createBudgetObjective } from "@/lib/budgets-server";
import {
  BUDGET_OBJECTIVE_METRICS,
  BUDGET_OBJECTIVE_STATUSES,
  BUDGET_TARGET_OPERATORS,
  OBJECTIVE_METRIC_OPTIONS,
  type BudgetObjectiveMetric,
  type BudgetObjectiveStatus,
  type BudgetTargetOperator,
} from "@/lib/budgets-shared";

type RouteContext = {
  params: Promise<{ periodId: string }>;
};

type CreateBody = {
  name?: string;
  metricKey?: string;
  customMetricLabel?: string | null;
  targetValue?: number;
  targetOperator?: string;
  targetUnit?: string | null;
  isPrimary?: boolean;
  priority?: number;
  status?: string;
  notes?: string | null;
};

export async function POST(request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId } = await context.params;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Objective name is required" },
      { status: 400 },
    );
  }

  const metricKey = BUDGET_OBJECTIVE_METRICS.includes(
    body.metricKey as BudgetObjectiveMetric,
  )
    ? (body.metricKey as BudgetObjectiveMetric)
    : null;
  if (!metricKey) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  if (
    metricKey === "custom" &&
    !body.customMetricLabel?.trim()
  ) {
    return NextResponse.json(
      { error: "Custom metric label is required" },
      { status: 400 },
    );
  }

  const targetValue = Number(body.targetValue);
  if (!Number.isFinite(targetValue)) {
    return NextResponse.json(
      { error: "Target value is required" },
      { status: 400 },
    );
  }

  const metricDefaults = OBJECTIVE_METRIC_OPTIONS.find(
    (m) => m.value === metricKey,
  );

  const targetOperator = BUDGET_TARGET_OPERATORS.includes(
    body.targetOperator as BudgetTargetOperator,
  )
    ? (body.targetOperator as BudgetTargetOperator)
    : (metricDefaults?.defaultOperator ?? "gte");

  const status =
    body.status &&
    BUDGET_OBJECTIVE_STATUSES.includes(body.status as BudgetObjectiveStatus)
      ? (body.status as BudgetObjectiveStatus)
      : "active";

  try {
    const objective = await createBudgetObjective({
      scope,
      periodId,
      data: {
        name: body.name,
        metricKey,
        customMetricLabel: body.customMetricLabel,
        targetValue,
        targetOperator,
        targetUnit:
          body.targetUnit !== undefined
            ? body.targetUnit
            : (metricDefaults?.defaultUnit ?? null),
        isPrimary: body.isPrimary,
        priority: body.priority,
        status,
        notes: body.notes,
      },
    });
    return NextResponse.json({ objective }, { status: 201 });
  } catch (error) {
    console.error("[adpilot] create budget objective:", error);
    return NextResponse.json(
      { error: "Failed to create objective" },
      { status: 500 },
    );
  }
}
