import { NextResponse } from "next/server";

import {
  getCurrentUserId,
  listStravaConnections,
  revokeStravaConnection,
} from "@/lib/connections-server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await listStravaConnections(userId);
  return NextResponse.json({ connection: connections[0] ?? null });
}

export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await revokeStravaConnection(userId);
  return NextResponse.json({ ok: true });
}
