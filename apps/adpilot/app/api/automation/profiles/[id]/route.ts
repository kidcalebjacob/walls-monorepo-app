import { NextResponse } from "next/server";

import { updateAutomationProfile } from "@/lib/automation-server";
import { getAdDataScope } from "@/lib/ad-scope";
import type {
  OptimizationGoal,
  SpendAutomationSettings,
} from "@/lib/spend-automation-settings";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateProfileBody = Partial<{
  name: string;
  description: string | null;
  isDefault: boolean;
  optimizationGoal: OptimizationGoal;
  settings: SpendAutomationSettings;
}>;

export async function PATCH(request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: UpdateProfileBody;
  try {
    body = (await request.json()) as UpdateProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "Profile name cannot be empty" }, { status: 400 });
  }

  try {
    const profile = await updateAutomationProfile({
      scope,
      profileId: id,
      patch: {
        ...body,
        name: body.name?.trim(),
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[adpilot] update automation profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
