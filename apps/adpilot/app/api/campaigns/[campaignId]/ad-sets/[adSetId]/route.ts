import { NextResponse } from "next/server";

import { getAdSetDetail } from "@/lib/entity-detail-server";
import { getAdDataScope } from "@/lib/ad-scope";

type RouteContext = {
  params: Promise<{ campaignId: string; adSetId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId, adSetId } = await context.params;

  try {
    const detail = await getAdSetDetail({ scope, campaignId, adSetId });
    if (!detail) {
      return NextResponse.json({ error: "Ad set not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[adpilot] ad set detail:", error);
    return NextResponse.json({ error: "Failed to load ad set" }, { status: 500 });
  }
}
