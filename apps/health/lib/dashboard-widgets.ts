export type DashboardWidgetId =
  | "energy_balance"
  | "steps"
  | "protein"
  | "carbs"
  | "meals_logged"
  | "fat"
  | "active_burn"
  | "distance"
  | "flights"
  | "exercise"
  | "stand_hours"
  | "resting_hr"
  | "avg_hr"
  | "hrv"
  | "blood_oxygen"
  | "sleep"
  | "mindfulness"
  | "insights"
  | "steps_chart"
  | "calories_chart";

export type DashboardWidgetGroup =
  | "Nutrition"
  | "Activity"
  | "Vitals"
  | "Recovery"
  | "Charts";

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  label: string;
  description: string;
  group: DashboardWidgetGroup;
  /** When true, only renders if matching Apple Health data exists. */
  requiresData?: boolean;
};

export const DASHBOARD_WIDGET_CATALOG: DashboardWidgetDefinition[] = [
  {
    id: "energy_balance",
    label: "Energy balance",
    description: "Calories remaining vs target",
    group: "Nutrition",
  },
  {
    id: "protein",
    label: "Protein",
    description: "Daily protein intake",
    group: "Nutrition",
  },
  {
    id: "carbs",
    label: "Carbs",
    description: "Daily carbohydrate intake",
    group: "Nutrition",
  },
  {
    id: "fat",
    label: "Fat",
    description: "Daily fat intake",
    group: "Nutrition",
  },
  {
    id: "meals_logged",
    label: "Meals logged",
    description: "How many meals you logged today",
    group: "Nutrition",
  },
  {
    id: "steps",
    label: "Steps",
    description: "Step count and goal progress",
    group: "Activity",
  },
  {
    id: "active_burn",
    label: "Active burn",
    description: "Calories burned from activity",
    group: "Activity",
  },
  {
    id: "distance",
    label: "Distance",
    description: "Walking and running distance",
    group: "Activity",
    requiresData: true,
  },
  {
    id: "flights",
    label: "Flights",
    description: "Flights of stairs climbed",
    group: "Activity",
    requiresData: true,
  },
  {
    id: "exercise",
    label: "Exercise",
    description: "Apple exercise minutes",
    group: "Activity",
    requiresData: true,
  },
  {
    id: "stand_hours",
    label: "Stand hours",
    description: "Hours with standing activity",
    group: "Activity",
    requiresData: true,
  },
  {
    id: "resting_hr",
    label: "Resting HR",
    description: "Resting heart rate",
    group: "Vitals",
    requiresData: true,
  },
  {
    id: "avg_hr",
    label: "Avg HR",
    description: "Average heart rate",
    group: "Vitals",
    requiresData: true,
  },
  {
    id: "hrv",
    label: "HRV",
    description: "Heart rate variability (SDNN)",
    group: "Vitals",
    requiresData: true,
  },
  {
    id: "blood_oxygen",
    label: "Blood oxygen",
    description: "Blood oxygen saturation",
    group: "Vitals",
    requiresData: true,
  },
  {
    id: "sleep",
    label: "Sleep",
    description: "Time asleep and stages",
    group: "Recovery",
    requiresData: true,
  },
  {
    id: "mindfulness",
    label: "Mindfulness",
    description: "Mindful minutes",
    group: "Recovery",
    requiresData: true,
  },
  {
    id: "insights",
    label: "Insights",
    description: "Science-backed daily insights",
    group: "Recovery",
  },
  {
    id: "steps_chart",
    label: "Steps chart",
    description: "Steps trend over the selected range",
    group: "Charts",
  },
  {
    id: "calories_chart",
    label: "Calories chart",
    description: "Calorie trend over the selected range",
    group: "Charts",
  },
];

export const DEFAULT_VISIBLE_WIDGETS: DashboardWidgetId[] = [
  "energy_balance",
  "steps",
  "protein",
  "carbs",
  "meals_logged",
  "fat",
  "active_burn",
  "distance",
  "flights",
  "exercise",
  "stand_hours",
  "resting_hr",
  "avg_hr",
  "hrv",
  "blood_oxygen",
  "sleep",
  "mindfulness",
  "insights",
  "steps_chart",
  "calories_chart",
];

const WIDGET_ID_SET = new Set(
  DASHBOARD_WIDGET_CATALOG.map((widget) => widget.id),
);

export function isDashboardWidgetId(value: string): value is DashboardWidgetId {
  return WIDGET_ID_SET.has(value as DashboardWidgetId);
}

export function normalizeVisibleWidgets(
  values: string[] | null | undefined,
): DashboardWidgetId[] {
  if (!values || values.length === 0) {
    return [...DEFAULT_VISIBLE_WIDGETS];
  }

  const unique = new Set<DashboardWidgetId>();
  for (const value of values) {
    if (isDashboardWidgetId(value)) unique.add(value);
  }

  return unique.size > 0 ? [...unique] : [...DEFAULT_VISIBLE_WIDGETS];
}

export function isWidgetVisible(
  visible: DashboardWidgetId[],
  id: DashboardWidgetId,
): boolean {
  return visible.includes(id);
}

/** Map Apple Health card labels to widget ids. */
export const APPLE_CARD_WIDGET_IDS: Record<string, DashboardWidgetId> = {
  Distance: "distance",
  Flights: "flights",
  Exercise: "exercise",
  "Stand hours": "stand_hours",
  "Resting HR": "resting_hr",
  "Avg HR": "avg_hr",
  HRV: "hrv",
  "Blood oxygen": "blood_oxygen",
  Sleep: "sleep",
  Mindfulness: "mindfulness",
};

export const WIDGET_GROUPS: DashboardWidgetGroup[] = [
  "Nutrition",
  "Activity",
  "Vitals",
  "Recovery",
  "Charts",
];
