import { NextResponse } from "next/server";

import { getAdDataScope } from "@/lib/ad-scope";
import {
  deleteBudgetPeriod,
  updateBudgetPeriod,
} from "@/lib/budgets-server";
import {
  BUDGET_PERIOD_TYPES,
  dollarsToMicros,
  type BudgetPeriodType,
} from "@/lib/budgets-shared";

type RouteContext = {
  params: Promise<{ periodId: string }>;
};

type PatchBody = {
  name?: string;
  description?: string | null;
  periodType?: string;
  startDate?: string;
  endDate?: string | null;
  currency?: string;
  budgetAmountDollars?: number | null;
  primaryFocus?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId } = await context.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json(
      { error: "Period name cannot be empty" },
      { status: 400 },
    );
  }

  const periodType =
    body.periodType === undefined
      ? undefined
      : BUDGET_PERIOD_TYPES.includes(body.periodType as BudgetPeriodType)
        ? (body.periodType as BudgetPeriodType)
        : null;
  if (periodType === null) {
    return NextResponse.json({ error: "Invalid period type" }, { status: 400 });
  }

  let budgetAmountMicros: number | undefined;
  if (body.budgetAmountDollars !== undefined) {
    const budgetAmountDollars =
      body.budgetAmountDollars == null ? 0 : Number(body.budgetAmountDollars);
    if (!Number.isFinite(budgetAmountDollars) || budgetAmountDollars < 0) {
      return NextResponse.json(
        { error: "Budget amount must be a non-negative number" },
        { status: 400 },
      );
    }
    budgetAmountMicros = dollarsToMicros(budgetAmountDollars);
  }

  try {
    const period = await updateBudgetPeriod({
      scope,
      periodId,
      patch: {
        name: body.name,
        description: body.description,
        periodType,
        startDate: body.startDate,
        endDate: body.endDate,
        currency: body.currency,
        budgetAmountMicros,
        primaryFocus: body.primaryFocus,
      },
    });
    return NextResponse.json({ period });
  } catch (error) {
    console.error("[adpilot] update budget period:", error);
    return NextResponse.json(
      { error: "Failed to update budget period" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId } = await context.params;

  try {
    await deleteBudgetPeriod({ scope, periodId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[adpilot] delete budget period:", error);
    return NextResponse.json(
      { error: "Failed to delete budget period" },
      { status: 500 },
    );
  }
}
