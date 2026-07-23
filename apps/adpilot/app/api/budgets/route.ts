import { NextResponse } from "next/server";

import { getAdDataScope } from "@/lib/ad-scope";
import {
  createBudgetPeriod,
  listBudgetPeriods,
} from "@/lib/budgets-server";
import {
  BUDGET_PERIOD_TYPES,
  dollarsToMicros,
  type BudgetPeriodType,
} from "@/lib/budgets-shared";

export async function GET() {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const periods = await listBudgetPeriods(scope);
    return NextResponse.json({ periods });
  } catch (error) {
    console.error("[adpilot] budget periods:", error);
    return NextResponse.json(
      { error: "Failed to load budget periods" },
      { status: 500 },
    );
  }
}

type CreateBody = {
  name?: string;
  description?: string | null;
  periodType?: string;
  startDate?: string;
  endDate?: string | null;
  currency?: string;
  budgetAmountDollars?: number | null;
  primaryFocus?: string | null;
};

export async function POST(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Period name is required" }, { status: 400 });
  }
  if (!body.startDate) {
    return NextResponse.json({ error: "Start date is required" }, { status: 400 });
  }

  const periodType = BUDGET_PERIOD_TYPES.includes(
    body.periodType as BudgetPeriodType,
  )
    ? (body.periodType as BudgetPeriodType)
    : null;
  if (!periodType) {
    return NextResponse.json({ error: "Invalid period type" }, { status: 400 });
  }

  if (periodType !== "ongoing" && !body.endDate) {
    return NextResponse.json(
      { error: "End date is required unless the period is ongoing" },
      { status: 400 },
    );
  }

  const budgetAmountDollars =
    body.budgetAmountDollars == null ? 0 : Number(body.budgetAmountDollars);
  if (!Number.isFinite(budgetAmountDollars) || budgetAmountDollars < 0) {
    return NextResponse.json(
      { error: "Budget amount must be a non-negative number" },
      { status: 400 },
    );
  }

  try {
    const period = await createBudgetPeriod({
      scope,
      data: {
        name: body.name,
        description: body.description,
        periodType,
        startDate: body.startDate,
        endDate: body.endDate ?? null,
        currency: body.currency,
        budgetAmountMicros: dollarsToMicros(budgetAmountDollars),
        primaryFocus: body.primaryFocus,
      },
    });
    return NextResponse.json({ period }, { status: 201 });
  } catch (error) {
    console.error("[adpilot] create budget period:", error);
    return NextResponse.json(
      { error: "Failed to create budget period" },
      { status: 500 },
    );
  }
}
