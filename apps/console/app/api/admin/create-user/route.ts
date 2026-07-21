import { NextResponse } from "next/server";

import {
  generateTempPassword,
  requireAdminCaller,
} from "@/lib/require-admin";

export async function POST(request: Request) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    email?: string;
    firstName?: string;
    lastName?: string;
    platformId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim() || null;
  const platformId = body.platformId?.trim() || null;

  if (!email || !firstName) {
    return NextResponse.json(
      { error: "Email and first name are required" },
      { status: 400 },
    );
  }

  const tempPassword = generateTempPassword();

  const { data: created, error: createError } =
    await auth.admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

  if (createError || !created.user) {
    console.error("[admin/create-user]", createError);
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create auth user" },
      { status: 400 },
    );
  }

  const userId = created.user.id;

  const { data: userRow, error: upsertError } = await auth.admin
    .from("users")
    .upsert(
      {
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        user_platform_id: platformId,
        status: "active",
        is_admin: false,
      },
      { onConflict: "id" },
    )
    .select("id, email, first_name, last_name, user_platform_id")
    .single();

  if (upsertError || !userRow) {
    console.error("[admin/create-user] profile upsert", upsertError);
    await auth.admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: upsertError?.message ?? "Failed to create user profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    tempPassword,
    user: {
      id: userRow.id,
      email: userRow.email,
      first_name: userRow.first_name,
      last_name: userRow.last_name,
      user_platform_id: userRow.user_platform_id,
    },
  });
}
