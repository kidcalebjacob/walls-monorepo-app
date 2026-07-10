import { NextResponse } from "next/server";

import { upsertEntityAutomation } from "@/lib/automation-server";
import { getAdDataScope } from "@/lib/ad-scope";
import type { SpendAutomationSettings } from "@/lib/spend-automation-settings";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

type AutomationPatchBody = {
  enabled?: boolean;
  profileId?: string | null;
  settingsOverride?: Partial<SpendAutomationSettings>;
  cooldownHours?: number | null;
  minDailyBudgetMicros?: number | null;
  maxDailyBudgetMicros?: number | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
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
      scope,
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
