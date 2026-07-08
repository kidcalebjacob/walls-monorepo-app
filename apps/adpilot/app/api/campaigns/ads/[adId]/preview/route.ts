import { NextResponse } from "next/server";

import { createAdminClient } from "@walls/supabase/admin";

import { getCurrentUserId } from "@/lib/connections-server";
import { fetchMetaAdPreview } from "@/lib/meta-graph";

type RouteContext = {
  params: Promise<{ adId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { adId } = await context.params;

  try {
    const admin = createAdminClient();

    const { data: entity, error: entityError } = await admin
      .from("ad_entities")
      .select("id, user_id, entity_type, provider_entity_id, user_connection_id")
      .eq("id", adId)
      .maybeSingle();

    if (entityError) {
      console.error("[adpilot] ad preview entity lookup:", entityError);
      return NextResponse.json({ error: "Failed to load ad" }, { status: 500 });
    }

    // Enforce ownership: the ad must belong to the requesting user.
    if (!entity || entity.user_id !== userId || entity.entity_type !== "ad") {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }

    const { data: connection, error: connectionError } = await admin
      .from("user_connections")
      .select("access_token")
      .eq("id", entity.user_connection_id)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();

    if (connectionError) {
      console.error("[adpilot] ad preview connection lookup:", connectionError);
      return NextResponse.json({ error: "Failed to load ad" }, { status: 500 });
    }

    const accessToken = connection?.access_token as string | undefined;
    if (!accessToken) {
      return NextResponse.json(
        { error: "Ad account is not connected" },
        { status: 404 },
      );
    }

    const html = await fetchMetaAdPreview(
      entity.provider_entity_id as string,
      accessToken,
    );

    if (!html) {
      return NextResponse.json(
        { error: "Preview unavailable for this ad" },
        { status: 404 },
      );
    }

    return NextResponse.json({ html });
  } catch (error) {
    console.error("[adpilot] ad preview:", error);
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}
