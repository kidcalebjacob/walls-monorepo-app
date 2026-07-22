import { NextResponse } from "next/server";

import {
  handleUploadImageRequest,
  UploadImageRequestError,
} from "@walls/storage/server";

export async function POST(request: Request) {
  try {
    const result = await handleUploadImageRequest(request);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UploadImageRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[upload/image]", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 },
    );
  }
}
