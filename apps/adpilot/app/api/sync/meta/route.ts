import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/connections-server";
import { syncMetaConnectionsForUser } from "@/lib/meta-sync";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncMetaConnectionsForUser(userId);
  const failed = results.filter((result) => !result.ok);

  if (failed.length > 0 && failed.length === results.length) {
    return NextResponse.json(
      { error: failed[0]?.error ?? "Meta sync failed", results },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, results });
}
