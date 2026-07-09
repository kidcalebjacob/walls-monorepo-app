import * as FileSystem from "expo-file-system";

import { getWallieWebUrl } from "./env";
import { getAccessToken } from "./supabase";

function logVoice(event: string, details?: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[wallie-mobile] voice ${event}`, details ?? "");
  }
}

async function voiceFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const baseUrl = getWallieWebUrl();
  const url = `${baseUrl}${path}`;

  logVoice("→", { url, method: init.method ?? "GET" });

  try {
    const response = await fetch(url, init);
    logVoice("←", { url, status: response.status, ok: response.ok });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Network request failed";
    console.error("[wallie-mobile] voice network error:", { url, message });
    throw new Error(
      `Voice network error (${baseUrl}). On a physical device, localhost will not work — use production Wallie or set NEXT_PUBLIC_WALLIE_MOBILE_WEB_URL. ${message}`,
    );
  }
}

export async function transcribeAudio(uri: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("audio", {
    uri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  const response = await voiceFetch("/api/walli/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const details =
      typeof (err as { details?: string }).details === "string"
        ? (err as { details: string }).details
        : undefined;
    throw new Error(
      typeof (err as { error?: string }).error === "string"
        ? details
          ? `${(err as { error: string }).error}: ${details}`
          : (err as { error: string }).error
        : `Transcription failed (${response.status})`,
    );
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

export async function fetchSpeechFileUri(text: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const response = await voiceFetch("/api/walli/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const details =
      typeof (err as { details?: string }).details === "string"
        ? (err as { details: string }).details
        : undefined;
    throw new Error(
      typeof (err as { error?: string }).error === "string"
        ? details
          ? `${(err as { error: string }).error}: ${details}`
          : (err as { error: string }).error
        : `Speech generation failed (${response.status})`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const fileUri = `${FileSystem.cacheDirectory}wallie-tts-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, btoa(binary), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}
