import { NextResponse } from "next/server";

import {
  getAdDataScope,
  listOrganizationsForUser,
} from "@/lib/organizations-server";

export async function GET() {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizations = await listOrganizationsForUser(scope.userId);
  return NextResponse.json({
    organizations,
    activeOrganizationId: scope.organizationId,
  });
}
