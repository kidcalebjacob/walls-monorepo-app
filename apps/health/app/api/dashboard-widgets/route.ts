import { NextResponse } from "next/server";

import {
  isDashboardWidgetId,
  type DashboardWidgetId,
} from "@/lib/dashboard-widgets";
import {
  getVisibleDashboardWidgets,
  saveVisibleDashboardWidgets,
} from "@/lib/dashboard-widgets-server";
import { getHealthDataScope } from "@/lib/health-scope";

export async function GET() {
  const scope = await getHealthDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visibleWidgets = await getVisibleDashboardWidgets(scope);
  return NextResponse.json({ visibleWidgets });
}

export async function PUT(request: Request) {
  const scope = await getHealthDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw =
    body &&
    typeof body === "object" &&
    "visibleWidgets" in body &&
    Array.isArray((body as { visibleWidgets: unknown }).visibleWidgets)
      ? ((body as { visibleWidgets: unknown[] }).visibleWidgets as unknown[])
      : null;

  if (!raw) {
    return NextResponse.json(
      { error: "visibleWidgets array required" },
      { status: 400 },
    );
  }

  const visibleWidgets = raw.filter(
    (value): value is DashboardWidgetId =>
      typeof value === "string" && isDashboardWidgetId(value),
  );

  try {
    const saved = await saveVisibleDashboardWidgets(scope, visibleWidgets);
    return NextResponse.json({ visibleWidgets: saved });
  } catch {
    return NextResponse.json(
      { error: "Failed to save widgets" },
      { status: 500 },
    );
  }
}
