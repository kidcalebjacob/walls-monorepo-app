import { NextResponse } from "next/server";

import { getAdDataScope } from "@/lib/ad-scope";
import { getAudienceDetail } from "@/lib/audiences-server";

type RouteContext = {
  params: Promise<{ audienceId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { audienceId } = await context.params;
  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range") ?? "30d";
  const rangeDays =
    rangeParam === "24h"
      ? 1
      : rangeParam === "7d"
        ? 7
        : rangeParam === "14d"
          ? 14
          : 30;

  try {
    const detail = await getAudienceDetail({
      scope,
      audienceId,
      rangeDays,
    });
    if (!detail) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[adpilot] audience detail:", error);
    return NextResponse.json({ error: "Failed to load audience" }, { status: 500 });
  }
}
