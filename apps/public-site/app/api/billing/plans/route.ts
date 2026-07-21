import { NextResponse } from "next/server";

import { getConfiguredKenooPlans, listKenooPlans } from "@walls/billing";

/** Public plan catalog for pricing pages / CTAs. */
export async function GET() {
  return NextResponse.json({
    plans: listKenooPlans(),
    configuredPlans: getConfiguredKenooPlans(),
  });
}
