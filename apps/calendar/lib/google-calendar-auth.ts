import { createAdminClient } from "@walls/supabase/admin";
import { createClient } from "@walls/supabase/server";
import { google } from "googleapis";

export type CalendarTokenResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      tokenExpiry: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      requiresGoogleAuth?: boolean;
      requiresReauth?: boolean;
      details?: string;
    };

export async function getCalendarTokensForUser(
  userId: string,
): Promise<CalendarTokenResult> {
  const admin = createAdminClient();

  const { data: connection, error } = await admin
    .from("user_connections")
    .select(
      "id, access_token, refresh_token, token_expiry, revoked_at, account_id",
    )
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("service", "calendar")
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to load calendar connection",
      details: error.message,
    };
  }

  if (!connection?.access_token || !connection.refresh_token) {
    return {
      ok: false,
      status: 401,
      error: "Google Calendar not connected",
      requiresGoogleAuth: true,
      details: "Connect Google Calendar in Settings first",
    };
  }

  const now = new Date();
  const expiryDate = connection.token_expiry
    ? new Date(connection.token_expiry)
    : null;

  if (expiryDate && expiryDate <= now) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );

      oauth2Client.setCredentials({
        refresh_token: connection.refresh_token,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null;

      await admin
        .from("user_connections")
        .update({
          access_token: credentials.access_token,
          token_expiry: newExpiry,
          last_token_refresh: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return {
        ok: true,
        accessToken: credentials.access_token!,
        refreshToken: connection.refresh_token,
        tokenExpiry: newExpiry,
      };
    } catch (refreshError) {
      return {
        ok: false,
        status: 401,
        error: "Token refresh failed",
        requiresReauth: true,
        details:
          refreshError instanceof Error
            ? refreshError.message
            : "Failed to refresh expired token",
      };
    }
  }

  return {
    ok: true,
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
    tokenExpiry: connection.token_expiry,
  };
}

export async function requireCalendarUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return { user: null, error: "Unauthorized" as const };
  }

  return { user, error: null };
}

export function googleCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}
