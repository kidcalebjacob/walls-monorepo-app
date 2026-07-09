import { NextResponse } from "next/server";

import { getDashboardAnalytics } from "@/lib/analytics-server";
import { getCurrentUserId } from "@/lib/connections-server";
import { parseTimeRangeParam, timeRangeToDays } from "@/lib/time-range";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeRange = parseTimeRangeParam(searchParams.get("range"));
  const rangeDays = timeRangeToDays(timeRange);

  const analytics = await getDashboardAnalytics(userId, { rangeDays });
  return NextResponse.json(analytics);
}
