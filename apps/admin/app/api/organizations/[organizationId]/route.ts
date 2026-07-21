import { NextResponse } from "next/server";

import {
  deleteOrganization,
  getOrganizationById,
  updateOrganization,
  type OrganizationUpdateInput,
} from "@/lib/organizations";
import { requireAdminCaller } from "@/lib/require-admin";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { organizationId } = await context.params;
  const organization = await getOrganizationById(organizationId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ organization });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { organizationId } = await context.params;
  const organization = await getOrganizationById(organizationId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as OrganizationUpdateInput & {
    iconUrl?: string | null;
  };

  const result = await updateOrganization(organizationId, body);
  if (!result.ok) {
    const status = result.error.includes("taken") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const updated = await getOrganizationById(organizationId);
  return NextResponse.json({ organization: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { organizationId } = await context.params;
  const organization = await getOrganizationById(organizationId);

  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await deleteOrganization(organizationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
