import { NextResponse } from "next/server";

import {
  createAutomationProfile,
  listAutomationProfilesForSettings,
  updateAutomationProfile,
} from "@/lib/automation-server";
import { getAdDataScope } from "@/lib/ad-scope";
import type {
  OptimizationGoal,
  SpendAutomationSettings,
} from "@/lib/spend-automation-settings";

export async function GET() {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = await listAutomationProfilesForSettings(scope);
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("[adpilot] automation profiles:", error);
    return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
  }
}

type CreateProfileBody = {
  name: string;
  description?: string | null;
  optimizationGoal?: OptimizationGoal;
  settings?: SpendAutomationSettings;
  isDefault?: boolean;
};

export async function POST(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateProfileBody;
  try {
    body = (await request.json()) as CreateProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
  }

  try {
    const profile = await createAutomationProfile({
      scope,
      name: body.name.trim(),
      description: body.description,
      optimizationGoal: body.optimizationGoal,
      settings: body.settings,
      isDefault: body.isDefault,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("[adpilot] create automation profile:", error);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
}
