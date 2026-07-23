import { NextResponse } from "next/server";

import { getAdDataScope } from "@/lib/ad-scope";
import {
  getAdpilotAlertsPageData,
  upsertMemberAlertSubscription,
} from "@/lib/alert-subscriptions-server";

export async function GET() {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getAdpilotAlertsPageData(scope);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[adpilot] list alert subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to load alert subscriptions" },
      { status: 500 },
    );
  }
}

type UpsertBody = {
  userId?: string;
  alertKey?: string;
  notifyEmail?: boolean;
  notifySms?: boolean;
};

export async function POST(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.alertKey) {
    return NextResponse.json({ error: "alertKey is required" }, { status: 400 });
  }

  const userId = body.userId ?? scope.userId;

  try {
    const subscription = await upsertMemberAlertSubscription({
      scope,
      userId,
      alertKey: body.alertKey,
      notifyEmail: Boolean(body.notifyEmail),
      notifySms: Boolean(body.notifySms),
    });
    return NextResponse.json({ subscription });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save alert subscription";
    console.error("[adpilot] upsert alert subscription:", error);
    const status =
      message === "Unsupported alert key" ||
      message === "User is not a member of this account"
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
