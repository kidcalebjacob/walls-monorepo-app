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
    teamGroupId?: string;
    firstName?: string;
    lastName?: string | null;
    email?: string;
    personalEmail?: string | null;
    phoneNumber?: string | null;
    title?: string;
    linkedinUrl?: string | null;
    teamEmail?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const teamGroupId = body.teamGroupId?.trim();
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim() || null;
  const email = body.email?.trim().toLowerCase();
  const personalEmail = body.personalEmail?.trim().toLowerCase() || null;
  const phoneNumber = body.phoneNumber?.trim() || null;
  const title = body.title?.trim();
  const linkedinUrl = body.linkedinUrl?.trim() || null;
  const teamEmail = body.teamEmail?.trim().toLowerCase() || email || null;

  if (!teamGroupId || !firstName || !email || !title) {
    return NextResponse.json(
      {
        error:
          "teamGroupId, firstName, email, and title are required",
      },
      { status: 400 },
    );
  }

  const { data: group, error: groupError } = await auth.admin
    .from("team_groups")
    .select("id")
    .eq("id", teamGroupId)
    .maybeSingle();

  if (groupError || !group) {
    return NextResponse.json({ error: "Team group not found" }, { status: 404 });
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
    console.error("[admin/create-team-member]", createError);
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create auth user" },
      { status: 400 },
    );
  }

  const userId = created.user.id;

  const { error: profileError } = await auth.admin.from("users").upsert(
    {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      personal_email: personalEmail,
      phone_number: phoneNumber,
      status: "active",
      is_admin: false,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("[admin/create-team-member] profile", profileError);
    await auth.admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 },
    );
  }

  const { data: maxExt } = await auth.admin
    .from("team")
    .select("phone_extension")
    .not("phone_extension", "is", null)
    .order("phone_extension", { ascending: false })
    .limit(1)
    .maybeSingle();

  const phoneExtension =
    maxExt?.phone_extension != null ? Number(maxExt.phone_extension) + 1 : 100;

  const { error: teamError } = await auth.admin.from("team").insert({
    team_group_id: teamGroupId,
    user_id: userId,
    title,
    email: teamEmail,
    linkedin_url: linkedinUrl,
    phone_extension: phoneExtension,
  });

  if (teamError) {
    console.error("[admin/create-team-member] team row", teamError);
    await auth.admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  return NextResponse.json({
    userId,
    tempPassword,
    phoneExtension,
  });
}
