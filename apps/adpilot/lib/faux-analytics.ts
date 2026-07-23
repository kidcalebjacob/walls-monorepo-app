export const FAUX_ANALYTICS = {
  periodLabel: "Last 30 days",
  stats: [
    { label: "Ad spend", value: "$48,290", change: "+12.4%", positive: true },
    { label: "Impressions", value: "2.4M", change: "+8.1%", positive: true },
    { label: "CTR", value: "2.38%", change: "-0.3%", positive: false },
    { label: "ROAS", value: "3.42x", change: "+0.6x", positive: true },
  ],
  spendByWeek: [
    { label: "W1", value: 62 },
    { label: "W2", value: 78 },
    { label: "W3", value: 55 },
    { label: "W4", value: 91 },
  ],
  accounts: [
    {
      name: "WALLS - Brand",
      platform: "Meta",
      spend: "$18,420",
      impressions: "842K",
      ctr: "2.51%",
      status: "Active",
    },
    {
      name: "Artist Launch Q2",
      platform: "Meta",
      spend: "$21,080",
      impressions: "1.1M",
      ctr: "2.19%",
      status: "Active",
    },
    {
      name: "Retargeting - Warm",
      platform: "Meta",
      spend: "$8,790",
      impressions: "468K",
      ctr: "2.84%",
      status: "Learning",
    },
  ],
} as const;
