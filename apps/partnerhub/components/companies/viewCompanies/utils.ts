export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function formatFundingAmount(amount: string | null, currency: string | null) {
  if (!amount) return "—";
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;
  const formatted = num.toLocaleString();
  return currency ? `${currency} ${formatted}` : formatted;
}

export function formatFundingDate(date: string | null) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export function buildWebsiteHref(website: string | null | undefined) {
  if (!website) return null;
  return website.startsWith("http") ? website : `https://${website}`;
}

export function formatPlatformLabel(platform: string | null | undefined) {
  if (!platform) return null;
  const normalized = platform.trim();
  if (!normalized) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export function formatPartnershipDate(date: string | null | undefined) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}
