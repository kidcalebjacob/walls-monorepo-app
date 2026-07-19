export function formatCalories(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatGrams(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)}g`;
}

export function formatSteps(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatDistanceMeters(
  meters: number,
  unitSystem: "metric" | "imperial" = "imperial",
): string {
  if (unitSystem === "imperial") {
    const miles = meters / 1609.344;
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: miles >= 10 ? 0 : 1,
    }).format(miles)} mi`;
  }
  const km = meters / 1000;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: km >= 10 ? 0 : 1,
  }).format(km)} km`;
}

export function formatDurationMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatHeartRate(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

export function formatWeightKg(kg: number, unitSystem: "metric" | "imperial"): string {
  if (unitSystem === "imperial") {
    const lbs = kg * 2.20462;
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(lbs)} lb`;
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(kg)} kg`;
}

export function formatHeightCm(cm: number, unitSystem: "metric" | "imperial"): string {
  if (unitSystem === "imperial") {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

export function mealTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
    other: "Other",
  };
  return labels[type] ?? type;
}

export function activityTypeLabel(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
