import { NextResponse } from "next/server";

import {
  createOrganizationForUser,
  listOrganizationsForUser,
} from "@/lib/organizations";
import { getCurrentUserId } from "@/lib/session";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizations = await listOrganizationsForUser(userId);
  return NextResponse.json({ organizations });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    iconUrl?: string | null;
    website?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 },
    );
  }

  const result = await createOrganizationForUser({
    userId,
    name: body.name.trim(),
    iconUrl: body.iconUrl ?? null,
    website: body.website ?? null,
  });

  if ("error" in result && result.error) {
    const status = result.error.includes("taken") ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (!result.organization) {
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }

  return NextResponse.json({ organization: result.organization });
}
