import { NextResponse } from "next/server";

import {
  deleteObjectsWithPrefix,
  getR2PublicUrl,
  putImageObject,
  userAvatarPrefix,
} from "@walls/storage/server";

import { requireAdminCaller } from "@/lib/require-admin";

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
  const userId = formData.get("userId");

  if (!(file instanceof File) || typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json(
      { error: "file and userId are required" },
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
    const prefix = userAvatarPrefix(userId);
    await deleteObjectsWithPrefix(prefix);
    const key = `${prefix}${crypto.randomUUID()}.${fileExtension(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await putImageObject(key, buffer, file.type || "application/octet-stream");
    const url = getR2PublicUrl(key);

    const { error } = await auth.admin
      .from("users")
      .update({ avatar_url: url })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ downloadUrl: url });
  } catch (error) {
    console.error("[upload-team-member-avatar]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
