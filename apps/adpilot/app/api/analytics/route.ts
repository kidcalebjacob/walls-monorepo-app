import { NextResponse } from "next/server";

import { getDashboardAnalytics } from "@/lib/analytics-server";
import { getAdDataScope } from "@/lib/ad-scope";
import { parseTimeRangeParam, timeRangeToDays } from "@/lib/time-range";

export async function GET(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeRange = parseTimeRangeParam(searchParams.get("range"));
  const rangeDays = timeRangeToDays(timeRange);

  const analytics = await getDashboardAnalytics(scope, { rangeDays });
  return NextResponse.json(analytics);
}
