import { NextResponse } from "next/server";

import { getAdDataScope } from "@/lib/ad-scope";
import {
  deleteBudgetObjective,
  updateBudgetObjective,
} from "@/lib/budgets-server";
import {
  BUDGET_OBJECTIVE_METRICS,
  BUDGET_OBJECTIVE_STATUSES,
  BUDGET_TARGET_OPERATORS,
  type BudgetObjectiveMetric,
  type BudgetObjectiveStatus,
  type BudgetTargetOperator,
} from "@/lib/budgets-shared";

type RouteContext = {
  params: Promise<{ periodId: string; objectiveId: string }>;
};

type PatchBody = {
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

export async function PATCH(request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId, objectiveId } = await context.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json(
      { error: "Objective name cannot be empty" },
      { status: 400 },
    );
  }

  const metricKey =
    body.metricKey === undefined
      ? undefined
      : BUDGET_OBJECTIVE_METRICS.includes(
            body.metricKey as BudgetObjectiveMetric,
          )
        ? (body.metricKey as BudgetObjectiveMetric)
        : null;
  if (metricKey === null) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  const targetOperator =
    body.targetOperator === undefined
      ? undefined
      : BUDGET_TARGET_OPERATORS.includes(
            body.targetOperator as BudgetTargetOperator,
          )
        ? (body.targetOperator as BudgetTargetOperator)
        : null;
  if (targetOperator === null) {
    return NextResponse.json({ error: "Invalid operator" }, { status: 400 });
  }

  const status =
    body.status === undefined
      ? undefined
      : BUDGET_OBJECTIVE_STATUSES.includes(
            body.status as BudgetObjectiveStatus,
          )
        ? (body.status as BudgetObjectiveStatus)
        : null;
  if (status === null) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const targetValue =
    body.targetValue === undefined ? undefined : Number(body.targetValue);
  if (
    targetValue !== undefined &&
    !Number.isFinite(targetValue)
  ) {
    return NextResponse.json({ error: "Invalid target value" }, { status: 400 });
  }

  try {
    const objective = await updateBudgetObjective({
      scope,
      periodId,
      objectiveId,
      patch: {
        name: body.name,
        metricKey,
        customMetricLabel: body.customMetricLabel,
        targetValue,
        targetOperator,
        targetUnit: body.targetUnit,
        isPrimary: body.isPrimary,
        priority: body.priority,
        status,
        notes: body.notes,
      },
    });
    return NextResponse.json({ objective });
  } catch (error) {
    console.error("[adpilot] update budget objective:", error);
    return NextResponse.json(
      { error: "Failed to update objective" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objectiveId } = await context.params;

  try {
    await deleteBudgetObjective({ scope, objectiveId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[adpilot] delete budget objective:", error);
    return NextResponse.json(
      { error: "Failed to delete objective" },
      { status: 500 },
    );
  }
}
