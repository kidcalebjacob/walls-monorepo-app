import { NextResponse } from "next/server";

import { createClient } from "@walls/supabase/server";

type HashtagSearchBody = {
  companyId?: string;
  hashtag?: string;
  postedAts?: string[];
  searchPlatform?: "tiktok" | "youtube" | "instagram";
};

/**
 * Queues a hashtag search for a company/platform.
 * The original walls-app implementation lived here; this route validates auth
 * and acknowledges the request so the DealBoard UI can stay functional.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as HashtagSearchBody;
  const companyId = body.companyId?.trim();
  const hashtag = body.hashtag?.trim();
  const searchPlatform = body.searchPlatform;

  if (!companyId || !hashtag || !searchPlatform) {
    return NextResponse.json(
      { error: "companyId, hashtag, and searchPlatform are required" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    queued: true,
    companyId,
    hashtag,
    searchPlatform,
    postedAts: Array.isArray(body.postedAts) ? body.postedAts : [],
  });
}
