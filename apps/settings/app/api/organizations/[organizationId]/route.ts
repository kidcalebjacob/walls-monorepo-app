import { NextResponse } from "next/server";

import {
  canEditOrganization,
  getOrganizationForUser,
  updateOrganization,
  type OrganizationUpdateInput,
} from "@/lib/organizations";
import { getCurrentUserId } from "@/lib/session";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await context.params;
  const organization = await getOrganizationForUser(userId, organizationId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ organization });
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await context.params;
  const organization = await getOrganizationForUser(userId, organizationId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canEditOrganization(organization.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as OrganizationUpdateInput & {
    iconUrl?: string | null;
  };

  const ok = await updateOrganization(organizationId, body);
  if (!ok) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const updated = await getOrganizationForUser(userId, organizationId);
  return NextResponse.json({ organization: updated });
}
