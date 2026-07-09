import {
  parseWallieEmailDraft,
  parseWallieStreamResponse,
  parseWallieStreamText,
  type WallieChatPayload,
  type WallieLoadingStatus,
  type WallieStreamLine,
} from "@walls/wallie-core";

import { getWallieApiUrl } from "./env";

function logChat(event: string, details?: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[wallie-mobile] ${event}`, details ?? "");
  }
}

export async function sendWallieChat(
  payload: WallieChatPayload,
  options: {
    onDelta?: (delta: string) => void;
    onStatus?: (status: WallieLoadingStatus) => void;
  } = {},
): Promise<WallieStreamLine> {
  const url = getWallieApiUrl();

  logChat("chat → Hetzner", {
    url,
    model: payload.model,
    userId: payload.userId,
    threadId: payload.threadId ?? null,
    messageLength: payload.message.length,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  logChat("chat ← Hetzner", {
    status: response.status,
    ok: response.ok,
    hasStreamingBody: !!response.body,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(
      `Wallie API error ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
    console.error("[wallie-mobile] chat error:", error.message);
    throw error;
  }

  if (response.body) {
    return parseWallieStreamResponse(response.body, options);
  }

  // React Native fetch often omits response.body; buffer the NDJSON stream instead.
  logChat("chat fallback", { reason: "response.body missing, using text()" });
  const text = await response.text();
  logChat("chat fallback done", { bytes: text.length });
  return parseWallieStreamText(text, options);
}

export { parseWallieEmailDraft };
