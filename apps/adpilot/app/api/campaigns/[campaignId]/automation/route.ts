import { NextResponse } from "next/server";

import { upsertEntityAutomation } from "@/lib/automation-server";
import { getCurrentUserId } from "@/lib/connections-server";
import type { SpendAutomationSettings } from "@/lib/spend-automation-settings";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

type AutomationPatchBody = {
  enabled?: boolean;
  profileId?: string | null;
  settingsOverride?: Partial<SpendAutomationSettings>;
  minDailyBudgetMicros?: number | null;
  maxDailyBudgetMicros?: number | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId: entityId } = await context.params;

  let body: AutomationPatchBody;
  try {
    body = (await request.json()) as AutomationPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const automation = await upsertEntityAutomation({
      userId,
      entityId,
      patch: body,
    });

    return NextResponse.json({ automation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update automation";
    const status = message === "Entity not found" ? 404 : 400;
    console.error("[adpilot] entity automation:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
