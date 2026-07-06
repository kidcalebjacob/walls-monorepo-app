import { NextResponse } from "next/server";

import { getDashboardAnalytics } from "@/lib/analytics-server";
import { getCurrentUserId } from "@/lib/connections-server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analytics = await getDashboardAnalytics(userId);
  return NextResponse.json(analytics);
}
