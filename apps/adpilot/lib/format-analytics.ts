export function formatCurrencyFromMicros(micros: number, currency = "USD"): string {
  const amount = micros / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatRoas(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}x`;
}

/** Average times each person saw the ads, e.g. 2.34x. */
export function formatFrequency(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "-";
  return `${value.toFixed(2)}x`;
}

export function formatResultCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function formatChange(
  current: number,
  previous: number,
): { label: string; positive: boolean } {
  if (previous <= 0) {
    return { label: "-", positive: true };
  }
  const pct = ((current - previous) / previous) * 100;
  const positive = pct >= 0;
  const sign = positive ? "+" : "";
  return { label: `${sign}${pct.toFixed(1)}%`, positive };
}
