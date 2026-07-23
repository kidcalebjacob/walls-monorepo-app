import type { DashboardSpendDay } from "@/lib/analytics-server";

export const ZERO_DASHBOARD_STATS = [
  { label: "Ad spend", value: "$0", change: "-", positive: true },
  { label: "Impressions", value: "0", change: "-", positive: true },
  { label: "CTR", value: "0.00%", change: "-", positive: true },
  { label: "ROAS", value: "-", change: "-", positive: true },
  { label: "Website purchases", value: "-", change: "-", positive: true },
  { label: "Purchase value", value: "-", change: "-", positive: true },
] as const;

function buildPreviewSpendCurve(): DashboardSpendDay[] {
  const points: DashboardSpendDay[] = [];

  for (let index = 0; index < 30; index += 1) {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    const isoDate = date.toISOString().slice(0, 10);
    const wave =
      180 +
      Math.sin(index / 3.2) * 95 +
      Math.cos(index / 6.5) * 55 +
      index * 4.5;
    const spend = Math.max(40, Math.round(wave));
    const purchaseValue = Math.round(spend * 2.35);
    const impressions = Math.round(spend * 165);
    const clicks = Math.round(spend * 2.8);
    const websitePurchases = Math.max(1, Math.round(spend / 42));

    points.push({
      date: isoDate,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      spend,
      spendMicros: spend * 1_000_000,
      purchaseValue,
      purchaseValueMicros: purchaseValue * 1_000_000,
      impressions,
      clicks,
      websitePurchases,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      roas: spend > 0 ? purchaseValue / spend : null,
    });
  }

  return points;
}

export const PREVIEW_SPEND_BY_DAY = buildPreviewSpendCurve();
