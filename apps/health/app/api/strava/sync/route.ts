import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/connections-server";
import { syncStravaActivities } from "@/lib/strava-sync";

// Full-history sync can take a while for athletes with lots of activities.
export const maxDuration = 60;

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncStravaActivities(userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[health] Strava sync:", err);
    const message =
      err instanceof Error && err.message === "No Strava connection found for user."
        ? "Connect Strava before syncing."
        : "Could not sync Strava activities.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
