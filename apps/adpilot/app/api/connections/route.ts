import { NextResponse } from "next/server";

import { getAdDataScope } from "@/lib/ad-scope";
import {
  listSafeConnectionsForAccount,
  revokeGoogleAdsConnection,
  revokeMetaConnection,
} from "@/lib/connections-server";
import {
  GOOGLE_ADS_SERVICE,
  GOOGLE_PROVIDER,
  META_PROVIDER,
  META_SERVICE,
} from "@/lib/connections";

export async function GET() {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await listSafeConnectionsForAccount(scope.accountId);
  return NextResponse.json({ connections });
}

export async function DELETE(request: Request) {
  const scope = await getAdDataScope();
  if (!scope) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    service?: string;
  };

  if (body.provider === META_PROVIDER && body.service === META_SERVICE) {
    await revokeMetaConnection(scope.accountId);
    return NextResponse.json({ ok: true });
  }

  if (body.provider === GOOGLE_PROVIDER && body.service === GOOGLE_ADS_SERVICE) {
    await revokeGoogleAdsConnection(scope.accountId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported connection" }, { status: 400 });
}
