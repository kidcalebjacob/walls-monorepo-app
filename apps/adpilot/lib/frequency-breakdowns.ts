export type FrequencyBreakdownBucket = {
  frequencyValue: string;
  label: string;
  reach: number;
  percentOfTotal: number;
};

export type FrequencyBreakdownsAnalytics = {
  hasData: boolean;
  totalReach: number;
  buckets: FrequencyBreakdownBucket[];
};

/** Sort key from Meta bucket labels like "1", "6-10", "21+". */
export function frequencyBucketSortKey(frequencyValue: string): number {
  const match = frequencyValue.trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function formatFrequencyBucketLabel(frequencyValue: string): string {
  const value = frequencyValue.trim();
  if (!value) return "Unknown";
  if (value === "1") return "1 Time";
  if (/^\d+$/.test(value)) return `${value} Times`;
  return `${value} Times`;
}

export function formatFrequencyReach(reach: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(reach));
}

export function formatFrequencyPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  if (percent < 0.01) return "<0.01%";
  if (percent < 1) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(2)}%`;
}
