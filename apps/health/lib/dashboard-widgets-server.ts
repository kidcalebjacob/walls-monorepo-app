import { createClient } from "@walls/supabase/server";

import {
  normalizeVisibleWidgets,
  type DashboardWidgetId,
} from "@/lib/dashboard-widgets";
import {
  type HealthDataScope,
  healthScopeFields,
  withHealthScope,
} from "@/lib/health-scope";

export type HealthDashboardWidgets = {
  id: string;
  user_id: string;
  visible_widgets: DashboardWidgetId[];
  updated_at: string | null;
};

export async function getVisibleDashboardWidgets(
  scope: HealthDataScope,
): Promise<DashboardWidgetId[]> {
  const supabase = await createClient();
  const { data, error } = await withHealthScope(
    supabase.from("health_dashboard_widgets").select("visible_widgets"),
    scope,
  ).maybeSingle();

  if (error) {
    console.error("[health] get dashboard widgets:", error);
    return normalizeVisibleWidgets(null);
  }

  const raw = (data as { visible_widgets?: string[] } | null)?.visible_widgets;
  return normalizeVisibleWidgets(raw);
}

export async function saveVisibleDashboardWidgets(
  scope: HealthDataScope,
  visibleWidgets: DashboardWidgetId[],
): Promise<DashboardWidgetId[]> {
  const normalized = normalizeVisibleWidgets(visibleWidgets);
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("health_dashboard_widgets")
    .upsert(
      {
        ...healthScopeFields(scope),
        visible_widgets: normalized,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("visible_widgets")
    .single();

  if (error) {
    console.error("[health] save dashboard widgets:", error);
    throw error;
  }

  return normalizeVisibleWidgets(
    (data as { visible_widgets?: string[] } | null)?.visible_widgets,
  );
}
