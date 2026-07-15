import { NextResponse } from "next/server";

import {
  getOrganizationForUser,
  setDefaultOrganizationForUser,
} from "@/lib/organizations";
import { getCurrentUserId } from "@/lib/session";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await context.params;
  const result = await setDefaultOrganizationForUser(userId, organizationId);

  if (!result.ok) {
    const status = result.error === "Organization not found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  const organization = await getOrganizationForUser(userId, organizationId);
  return NextResponse.json({ organization });
}
