import { NextResponse } from "next/server";
import OpenAI from "openai";

import { getWallieApiUser } from "@/lib/wallie-api-auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getWallieApiUser(req);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key not configured" },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 },
      );
    }

    const mime = audio.type || "audio/m4a";
    const extension = mime.includes("m4a") || mime.includes("mp4")
      ? "m4a"
      : mime.includes("wav")
        ? "wav"
        : mime.includes("webm")
          ? "webm"
          : "m4a";

    const file = new File([audio], `recording.${extension}`, { type: mime });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    return NextResponse.json({ text: transcription.text?.trim() ?? "" });
  } catch (error) {
    console.error("Wallie transcribe error:", error);
    return NextResponse.json(
      {
        error: "Failed to transcribe audio",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
