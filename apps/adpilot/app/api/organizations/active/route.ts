import { NextResponse } from "next/server";

import {
  getAdDataScope,
  setActiveOrganizationCookie,
  userBelongsToOrganization,
} from "@/lib/organizations-server";

export async function POST(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { organizationId?: string | null };
  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId : null;

  if (organizationId) {
    const allowed = await userBelongsToOrganization(
      scope.userId,
      organizationId,
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await setActiveOrganizationCookie(organizationId);

  return NextResponse.json({
    ok: true,
    activeOrganizationId: organizationId,
  });
}
