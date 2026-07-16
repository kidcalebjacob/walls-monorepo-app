export type DashboardCalorieDay = {
  date: string;
  label: string;
  consumed: number;
  burned: number;
  target: number;
  remaining: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
};

export const ZERO_DASHBOARD_STATS = [
  { label: "Consumed", value: "0", change: "—", positive: true },
  { label: "Remaining", value: "0", change: "—", positive: true },
  { label: "Burned", value: "0", change: "—", positive: true },
  { label: "Protein", value: "0g", change: "—", positive: true },
  { label: "Carbs", value: "0g", change: "—", positive: true },
  { label: "Fat", value: "0g", change: "—", positive: true },
] as const;

function buildPreviewCalorieCurve(): DashboardCalorieDay[] {
  const points: DashboardCalorieDay[] = [];
  const today = new Date();

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const consumed = Math.round(1600 + Math.sin(index / 2) * 280 + index * 35);
    const burned = Math.round(220 + Math.cos(index / 1.8) * 90);
    const target = 2200;

    points.push({
      date: isoDate,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      }),
      consumed,
      burned,
      target,
      remaining: target - consumed + burned,
      protein_g: Math.round((consumed * 0.28) / 4),
      carbs_g: Math.round((consumed * 0.42) / 4),
      fat_g: Math.round((consumed * 0.3) / 9),
      sugar_g: Math.round((consumed * 0.08) / 4),
    });
  }

  return points;
}

export const PREVIEW_CALORIES_BY_DAY = buildPreviewCalorieCurve();
