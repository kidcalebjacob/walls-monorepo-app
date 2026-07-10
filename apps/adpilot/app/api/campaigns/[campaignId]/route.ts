import { NextResponse } from "next/server";

import { getCampaignDetail } from "@/lib/entity-detail-server";
import { getAdDataScope } from "@/lib/ad-scope";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await context.params;

  try {
    const detail = await getCampaignDetail({ scope, campaignId });
    if (!detail) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[adpilot] campaign detail:", error);
    return NextResponse.json({ error: "Failed to load campaign" }, { status: 500 });
  }
}
