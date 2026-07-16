"use client";

import * as React from "react";
import { Activity, Flame, Loader2, MapPin } from "lucide-react";

import { Card, CardContent } from "@walls/ui/card";

import type { HealthActivity } from "@/lib/activities-server";
import {
  activityTypeLabel,
  formatCalories,
} from "@/lib/format-health";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function formatDistance(meters: number | null): string {
  if (!meters) return "—";
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

export function ActivitiesPage() {
  const [activities, setActivities] = React.useState<HealthActivity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/activities");
        if (!response.ok) return;
        const payload = (await response.json()) as {
          activities?: HealthActivity[];
        };
        setActivities(payload.activities ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-kenoo-white px-6 py-8 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-neutral-900">
            Activities
          </h1>
          <p className="mt-1 text-sm font-light text-neutral-500">
            Workouts from Strava sync and manual entries. Connect Strava in Settings.
          </p>
        </div>

        {activities.length === 0 ? (
          <Card className="rounded-xl border-dashed border-neutral-200 shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Activity className="h-8 w-8 text-neutral-300" />
              <p className="text-sm font-light text-neutral-500">
                No activities yet. Connect Strava or log workouts manually.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Card
                key={activity.id}
                className="rounded-xl border-neutral-200 shadow-none"
              >
                <CardContent className="flex items-start justify-between gap-4 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {activity.name ?? activityTypeLabel(activity.activity_type)}
                    </p>
                    <p className="mt-0.5 text-xs font-light text-neutral-500">
                      {activityTypeLabel(activity.activity_type)} ·{" "}
                      {new Date(activity.started_at).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs font-light text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5" />
                        {activity.calories_burned != null
                          ? `${formatCalories(activity.calories_burned)} cal`
                          : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {formatDistance(
                          activity.distance_meters != null
                            ? Number(activity.distance_meters)
                            : null,
                        )}
                      </span>
                      <span>{formatDuration(activity.duration_seconds)}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                    {activity.provider}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
