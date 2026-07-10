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
    slug?: string;
    iconUrl?: string | null;
    website?: string | null;
  };

  if (!body.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json(
      { error: "Name and slug are required" },
      { status: 400 },
    );
  }

  const organization = await createOrganizationForUser({
    userId,
    name: body.name.trim(),
    slug: body.slug.trim(),
    iconUrl: body.iconUrl ?? null,
    website: body.website ?? null,
  });

  if (!organization) {
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }

  return NextResponse.json({ organization });
}
