import { google } from "googleapis";

import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated Gmail client from Settings `user_connections`
 * (provider=google, service=gmail).
 */
export async function getGmailClient(userEmail: string) {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (userError || !userData) {
    console.error("No user found for email:", userEmail);
    throw new Error("User not found");
  }

  const { data: connectionData, error: connectionError } = await supabase
    .from("user_connections")
    .select("refresh_token, access_token, token_expiry")
    .eq("user_id", userData.id)
    .eq("provider", "google")
    .eq("service", "gmail")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (connectionError || !connectionData?.refresh_token) {
    console.error("No Gmail refresh token found for user:", userEmail);
    throw new Error("Gmail refresh token not found");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_GMAIL_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_SETTINGS_URL || process.env.NEXT_PUBLIC_BASE_URL}/api/google/gmail/callback`,
  );

  oauth2Client.setCredentials({
    refresh_token: connectionData.refresh_token,
    access_token: connectionData.access_token ?? undefined,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function getGmailClientByUserId(userId: string) {
  const supabase = await createClient();

  const { data: connectionData, error: connectionError } = await supabase
    .from("user_connections")
    .select("refresh_token, access_token, token_expiry")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("service", "gmail")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (connectionError || !connectionData?.refresh_token) {
    console.error("No Gmail refresh token found for user_id:", userId);
    throw new Error("Gmail refresh token not found");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_GMAIL_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_SETTINGS_URL || process.env.NEXT_PUBLIC_BASE_URL}/api/google/gmail/callback`,
  );

  oauth2Client.setCredentials({
    refresh_token: connectionData.refresh_token,
    access_token: connectionData.access_token ?? undefined,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
