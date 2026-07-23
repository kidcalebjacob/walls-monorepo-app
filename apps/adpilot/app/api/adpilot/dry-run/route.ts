import { NextResponse } from "next/server";

import { createClient } from "@walls/supabase/server";

import { getAdDataScope, withAdScope } from "@/lib/ad-scope";
import { getAdpilotApiKey, getAdpilotApiUrl } from "@/lib/algorithm-env";

type DryRunBody = {
  entityId?: string;
};

export async function POST(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DryRunBody;
  try {
    body = (await request.json()) as DryRunBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entityId = body.entityId?.trim();
  if (!entityId) {
    return NextResponse.json({ error: "entityId required" }, { status: 400 });
  }

  // Ownership check - only preview entities that belong to the current user.
  const supabase = await createClient();
  const { data: entity, error: entityError } = await withAdScope(
    supabase.from("ad_entities").select("id").eq("id", entityId),
    scope,
  ).maybeSingle();

  if (entityError) {
    console.error("[adpilot] dry-run ownership check:", entityError);
    return NextResponse.json(
      { error: "Failed to verify entity" },
      { status: 500 },
    );
  }

  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  let apiUrl: string;
  let apiKey: string;
  try {
    apiUrl = getAdpilotApiUrl();
    apiKey = getAdpilotApiKey();
  } catch (error) {
    console.error("[adpilot] dry-run config:", error);
    return NextResponse.json(
      { error: "Preview service is not configured." },
      { status: 503 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/dry-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ entityId }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[adpilot] dry-run upstream fetch:", error);
    return NextResponse.json(
      { error: "Could not reach the preview service." },
      { status: 502 },
    );
  }

  let payload: unknown = null;
  try {
    payload = await upstream.json();
  } catch {
    payload = null;
  }

  if (payload == null) {
    return NextResponse.json(
      { error: "Empty response from preview service." },
      { status: 502 },
    );
  }

  return NextResponse.json(payload, { status: upstream.status });
}
