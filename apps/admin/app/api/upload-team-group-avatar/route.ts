import { NextResponse } from "next/server";

import {
  deleteObjectsWithPrefix,
  getR2PublicUrl,
  putImageObject,
} from "@walls/storage/server";

import { requireAdminCaller } from "@/lib/require-admin";

function teamGroupAvatarPrefix(teamGroupId: string): string {
  return `team-group-avatars/${teamGroupId}/`;
}

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  const fromType = file.type.split("/").pop()?.toLowerCase();
  if (fromType && fromType !== "octet-stream") {
    return fromType === "jpeg" ? "jpg" : fromType;
  }
  return "jpg";
}

export async function POST(request: Request) {
  const auth = await requireAdminCaller();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const teamGroupId = formData.get("teamGroupId");

  if (
    !(file instanceof File) ||
    typeof teamGroupId !== "string" ||
    !teamGroupId.trim()
  ) {
    return NextResponse.json(
      { error: "file and teamGroupId are required" },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are supported" },
      { status: 400 },
    );
  }

  try {
    const prefix = teamGroupAvatarPrefix(teamGroupId);
    await deleteObjectsWithPrefix(prefix);
    const key = `${prefix}${crypto.randomUUID()}.${fileExtension(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await putImageObject(key, buffer, file.type || "application/octet-stream");
    const url = getR2PublicUrl(key);

    return NextResponse.json({ downloadUrl: url });
  } catch (error) {
    console.error("[upload-team-group-avatar]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
