import { NextResponse } from "next/server";

import type { AdPilotPreview } from "@/lib/adpilot-preview";
import { applyAdPilotPreview } from "@/lib/adpilot-apply-server";
import { getAdDataScope } from "@/lib/ad-scope";

type ApplyBody = {
  entityId?: string;
  preview?: AdPilotPreview;
};

export async function POST(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entityId = body.entityId?.trim();
  if (!entityId) {
    return NextResponse.json({ error: "entityId required" }, { status: 400 });
  }

  if (!body.preview || typeof body.preview !== "object") {
    return NextResponse.json({ error: "preview required" }, { status: 400 });
  }

  try {
    const result = await applyAdPilotPreview({
      scope,
      entityId,
      preview: body.preview,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply AdPilot decision";
    const status =
      message === "Entity not found"
        ? 404
        : message.includes("Enable AdPilot")
          ? 409
          : 400;

    console.error("[adpilot] apply:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
