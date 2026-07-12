"use client";

import * as React from "react";
import { Check, Loader2, Save } from "lucide-react";

import { Button } from "@walls/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@walls/ui/card";
import { Input } from "@walls/ui/input";

import type { HealthProfile } from "@/lib/profile-server";
import type { SafeUserConnection } from "@/lib/connections";
import { formatCalories } from "@/lib/format-health";

const STRAVA_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Your session expired. Please sign in again.",
  invalid_oauth_state: "Strava sign-in expired. Please try again.",
  access_denied: "Strava access was denied.",
  strava_oauth_failed: "Could not connect Strava. Please try again.",
};

export function SettingsPage() {
  const [profile, setProfile] = React.useState<HealthProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const [heightCm, setHeightCm] = React.useState("");
  const [weightKg, setWeightKg] = React.useState("");
  const [sex, setSex] = React.useState("male");
  const [activityLevel, setActivityLevel] = React.useState("moderate");
  const [goalType, setGoalType] = React.useState("maintain");
  const [calorieDeficit, setCalorieDeficit] = React.useState("500");
  const [proteinTarget, setProteinTarget] = React.useState("150");
  const [carbsTarget, setCarbsTarget] = React.useState("200");
  const [fatTarget, setFatTarget] = React.useState("65");
  const [sugarLimit, setSugarLimit] = React.useState("50");

  const [strava, setStrava] = React.useState<SafeUserConnection | null>(null);
  const [stravaLoading, setStravaLoading] = React.useState(true);
  const [stravaDisconnecting, setStravaDisconnecting] = React.useState(false);
  const [stravaNotice, setStravaNotice] = React.useState<string | null>(null);

  const loadStrava = React.useCallback(async () => {
    setStravaLoading(true);
    try {
      const response = await fetch("/api/strava");
      if (!response.ok) return;
      const payload = (await response.json()) as {
        connection?: SafeUserConnection | null;
      };
      setStrava(payload.connection ?? null);
    } finally {
      setStravaLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStrava();
  }, [loadStrava]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected === "strava") {
      setStravaNotice("Strava connected.");
    } else if (error) {
      setStravaNotice(
        STRAVA_ERROR_MESSAGES[error] ?? "Could not connect Strava.",
      );
    }

    if (connected || error) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleConnectStrava = () => {
    window.location.href = "/api/strava/login";
  };

  const handleDisconnectStrava = async () => {
    setStravaDisconnecting(true);
    setStravaNotice(null);
    try {
      const response = await fetch("/api/strava", { method: "DELETE" });
      if (!response.ok) {
        setStravaNotice("Could not disconnect Strava.");
        return;
      }
      setStrava(null);
      setStravaNotice("Strava disconnected.");
    } finally {
      setStravaDisconnecting(false);
    }
  };

  const loadProfile = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) return;
      const payload = (await response.json()) as { profile?: HealthProfile };
      const row = payload.profile;
      if (!row) return;
      setProfile(row);
      setHeightCm(row.height_cm != null ? String(row.height_cm) : "");
      setWeightKg(row.current_weight_kg != null ? String(row.current_weight_kg) : "");
      setSex(row.sex ?? "male");
      setActivityLevel(row.activity_level ?? "moderate");
      setGoalType(row.goal_type ?? "maintain");
      setCalorieDeficit(String(row.calorie_deficit_daily ?? 500));
      setProteinTarget(row.protein_target_g != null ? String(row.protein_target_g) : "150");
      setCarbsTarget(row.carbs_target_g != null ? String(row.carbs_target_g) : "200");
      setFatTarget(row.fat_target_g != null ? String(row.fat_target_g) : "65");
      setSugarLimit(row.sugar_limit_g != null ? String(row.sugar_limit_g) : "50");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height_cm: heightCm ? Number(heightCm) : null,
          current_weight_kg: weightKg ? Number(weightKg) : null,
          sex,
          activity_level: activityLevel,
          goal_type: goalType,
          calorie_deficit_daily:
            goalType === "lose_weight" ? Number(calorieDeficit) : 0,
          protein_target_g: proteinTarget ? Number(proteinTarget) : null,
          carbs_target_g: carbsTarget ? Number(carbsTarget) : null,
          fat_target_g: fatTarget ? Number(fatTarget) : null,
          sugar_limit_g: sugarLimit ? Number(sugarLimit) : null,
        }),
      });

      if (!response.ok) {
        setMessage("Could not save profile.");
        return;
      }

      const payload = (await response.json()) as { profile?: HealthProfile };
      setProfile(payload.profile ?? null);
      setMessage("Profile saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-walls-white px-6 py-8 md:px-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-neutral-900">
            Settings
          </h1>
          <p className="mt-1 text-sm font-light text-neutral-500">
            Body metrics, calorie targets, and integrations.
          </p>
        </div>

        <Card className="rounded-xl border-neutral-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Health profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Height (cm)">
                  <Input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="175"
                  />
                </Field>
                <Field label="Weight (kg)">
                  <Input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="78"
                  />
                </Field>
                <Field label="Sex">
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Activity level">
                  <select
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                    className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                  >
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="active">Active</option>
                    <option value="very_active">Very active</option>
                  </select>
                </Field>
                <Field label="Goal">
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
                  >
                    <option value="lose_weight">Lose weight</option>
                    <option value="maintain">Maintain</option>
                    <option value="gain_muscle">Gain muscle</option>
                    <option value="recomposition">Recomposition</option>
                  </select>
                </Field>
              </div>

              {goalType === "lose_weight" ? (
                <Field label="Daily calorie deficit">
                  <Input
                    type="number"
                    value={calorieDeficit}
                    onChange={(e) => setCalorieDeficit(e.target.value)}
                    placeholder="500"
                  />
                </Field>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Protein target (g)">
                  <Input
                    type="number"
                    value={proteinTarget}
                    onChange={(e) => setProteinTarget(e.target.value)}
                  />
                </Field>
                <Field label="Carbs target (g)">
                  <Input
                    type="number"
                    value={carbsTarget}
                    onChange={(e) => setCarbsTarget(e.target.value)}
                  />
                </Field>
                <Field label="Fat target (g)">
                  <Input
                    type="number"
                    value={fatTarget}
                    onChange={(e) => setFatTarget(e.target.value)}
                  />
                </Field>
                <Field label="Sugar limit (g)">
                  <Input
                    type="number"
                    value={sugarLimit}
                    onChange={(e) => setSugarLimit(e.target.value)}
                  />
                </Field>
              </div>

              {profile?.bmr_calories || profile?.tdee_calories || profile?.calorie_target_daily ? (
                <div className="rounded-lg bg-neutral-50 px-4 py-3 text-sm font-light text-neutral-600">
                  {profile.bmr_calories ? (
                    <p>BMR: {formatCalories(profile.bmr_calories)} cal/day</p>
                  ) : null}
                  {profile.tdee_calories ? (
                    <p>TDEE: {formatCalories(profile.tdee_calories)} cal/day</p>
                  ) : null}
                  {profile.calorie_target_daily ? (
                    <p className="font-medium text-neutral-900">
                      Daily target: {formatCalories(profile.calorie_target_daily)} cal
                    </p>
                  ) : null}
                </div>
              ) : null}

              {message ? (
                <p className="text-sm font-light text-neutral-600">{message}</p>
              ) : null}

              <Button
                type="submit"
                disabled={saving}
                className="rounded-full bg-walls-yellow text-black hover:bg-walls-yellow"
              >
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-neutral-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">Strava</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-light text-neutral-500">
              Connect Strava to sync your activities into calorie burn and
              weekly fitness goals automatically.
            </p>

            {stravaLoading ? (
              <div className="flex items-center gap-2 text-sm font-light text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking connection…
              </div>
            ) : strava ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-light text-green-700">
                  <Check className="h-4 w-4" />
                  Connected
                  {strava.token_payload?.athlete_name
                    ? ` as ${strava.token_payload.athlete_name}`
                    : ""}
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnectStrava}
                  disabled={stravaDisconnecting}
                  className="rounded-full font-light"
                >
                  {stravaDisconnecting ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Disconnecting…
                    </>
                  ) : (
                    "Disconnect Strava"
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleConnectStrava}
                className="rounded-full bg-[#FC4C02] text-white hover:bg-[#e34402]"
              >
                Connect Strava
              </Button>
            )}

            {stravaNotice ? (
              <p className="text-sm font-light text-neutral-600">
                {stravaNotice}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}
