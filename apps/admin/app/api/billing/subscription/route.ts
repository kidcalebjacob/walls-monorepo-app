import { NextResponse } from "next/server";

import {
  getAccountSubscription,
  getConfiguredKenooPlans,
  listKenooPlans,
} from "@walls/billing";
import { createAdminClient } from "@walls/supabase/admin";

import { getCurrentUserId } from "@/lib/account-context";
import { getAdminDataScope } from "@/lib/admin-scope";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = await getAdminDataScope();
  if (!scope) {
    return NextResponse.json({
      subscription: null,
      plans: listKenooPlans(),
      configuredPlans: getConfiguredKenooPlans(),
    });
  }

  const admin = createAdminClient();
  const subscription = await getAccountSubscription(admin, scope.accountId);

  return NextResponse.json({
    subscription,
    plans: listKenooPlans(),
    configuredPlans: getConfiguredKenooPlans(),
  });
}
