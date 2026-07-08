import { NextResponse } from "next/server";

import {
  listCampaignPerformance,
  type CampaignEntityType,
} from "@/lib/campaigns-server";
import { getCurrentUserId } from "@/lib/connections-server";
import {
  DASHBOARD_OBJECTIVE_BUCKETS,
  type DashboardObjectiveBucket,
} from "@/lib/meta-objectives";

const ENTITY_TYPES = new Set<CampaignEntityType>(["campaign", "ad_group", "ad"]);

const OBJECTIVE_BUCKETS = new Set<DashboardObjectiveBucket>(
  DASHBOARD_OBJECTIVE_BUCKETS.map((bucket) => bucket.value),
);

const RANGE_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityTypeParam = searchParams.get("type") ?? "campaign";
  const entityType = ENTITY_TYPES.has(entityTypeParam as CampaignEntityType)
    ? (entityTypeParam as CampaignEntityType)
    : "campaign";
  const search = searchParams.get("search") ?? undefined;
  const accountId = searchParams.get("accountId") ?? undefined;
  const objectiveParam = searchParams.get("objective") ?? undefined;
  const objective =
    objectiveParam && OBJECTIVE_BUCKETS.has(objectiveParam as DashboardObjectiveBucket)
      ? (objectiveParam as DashboardObjectiveBucket)
      : undefined;
  const page = Number(searchParams.get("page") ?? "0");
  const rangeParam = searchParams.get("range") ?? "30d";
  const rangeDays = RANGE_DAYS[rangeParam] ?? 30;

  try {
    const result = await listCampaignPerformance({
      userId,
      entityType,
      search,
      accountId,
      objective,
      page: Number.isFinite(page) ? page : 0,
      rangeDays,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[adpilot] campaigns list:", error);
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }
}
