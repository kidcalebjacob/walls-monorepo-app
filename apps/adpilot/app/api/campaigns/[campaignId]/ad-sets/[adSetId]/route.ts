import { NextResponse } from "next/server";

import { getAdSetDetail } from "@/lib/entity-detail-server";
import { getCurrentUserId } from "@/lib/connections-server";

type RouteContext = {
  params: Promise<{ campaignId: string; adSetId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId, adSetId } = await context.params;

  try {
    const detail = await getAdSetDetail({ userId, campaignId, adSetId });
    if (!detail) {
      return NextResponse.json({ error: "Ad set not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[adpilot] ad set detail:", error);
    return NextResponse.json({ error: "Failed to load ad set" }, { status: 500 });
  }
}
