import { NextResponse } from "next/server";

import {
  isOrganizationSlugAvailable,
  normalizeOrganizationSlug,
} from "@/lib/organizations";
import { requireAdminCaller } from "@/lib/require-admin";

export async function GET(request: Request) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";
  const excludeOrganizationId = searchParams.get("excludeOrganizationId");

  const normalized = normalizeOrganizationSlug(slug);
  if (!normalized) {
    return NextResponse.json({
      available: false,
      normalized: null,
      reason: "invalid",
    });
  }

  const available = await isOrganizationSlugAvailable(
    normalized,
    excludeOrganizationId ?? undefined,
  );

  return NextResponse.json({
    available,
    normalized,
    reason: available ? null : "taken",
  });
}
