import type { WallieLoadingStatus, WallieStreamLine } from "./types";

export interface ParseWallieStreamOptions {
  onDelta?: (delta: string) => void;
  onStatus?: (status: WallieLoadingStatus) => void;
}

function mapStatus(status?: string): WallieLoadingStatus {
  if (status === "searching") return "searching";
  if (status === "people_search") return "people_search";
  if (status === "thinking") return "thinking";
  return null;
}

function handleLine(
  line: string,
  lastData: WallieStreamLine,
  options: ParseWallieStreamOptions,
): WallieStreamLine {
  const data = JSON.parse(line) as WallieStreamLine;

  if (data.delta) {
    options.onDelta?.(data.delta);
    return lastData;
  }

  const status = mapStatus(data.status);
  if (status) options.onStatus?.(status);
  if (data.error) throw new Error(data.error);
  return data;
}

function parseWallieStreamLines(
  lines: string[],
  options: ParseWallieStreamOptions,
  initial: WallieStreamLine = {},
): WallieStreamLine {
  let lastData = initial;

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      lastData = handleLine(line, lastData, options);
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }

  if (lastData.error) throw new Error(lastData.error);
  return lastData;
}

/** Parse newline-delimited JSON already loaded as text (React Native fetch fallback). */
export function parseWallieStreamText(
  text: string,
  options: ParseWallieStreamOptions = {},
): WallieStreamLine {
  return parseWallieStreamLines(text.split("\n"), options);
}

/** Parse newline-delimited JSON from a wallie-api streaming response body. */
export async function parseWallieStreamResponse(
  body: ReadableStream<Uint8Array> | null,
  options: ParseWallieStreamOptions = {},
): Promise<WallieStreamLine> {
  if (!body) {
    throw new Error("No response body from Wallie API");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastData: WallieStreamLine = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    lastData = parseWallieStreamLines(lines, options, lastData);
  }

  if (buffer.trim()) {
    try {
      lastData = handleLine(buffer, lastData, options);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }

  if (lastData.error) throw new Error(lastData.error);
  return lastData;
}
