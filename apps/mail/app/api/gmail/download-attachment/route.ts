import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const attachmentId = searchParams.get("attachmentId");
    const userEmail = searchParams.get("email");

    if (!messageId || !attachmentId || !userEmail) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const user = toUser(supabaseUser);

    if (!user?.email) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    // Look up Gmail connection in user_connections (same pattern as getGmailClient)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (userError || !userData?.id) {
      return NextResponse.json(
        { error: "User not found for email" },
        { status: 404 }
      );
    }

    const { data: connectionData, error: connectionError } = await supabase
      .from("user_connections")
      .select("refresh_token")
      .eq("user_id", userData.id)
      .eq("provider", "google")
      .eq("service", "gmail")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connectionError || !connectionData?.refresh_token) {
      return NextResponse.json(
        { error: "Gmail not connected" },
        { status: 400 }
      );
    }

    const refreshToken = connectionData.refresh_token;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const attachment = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    const data = attachment.data?.data;

    if (!data) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Return base64 data; client will convert to Blob and trigger download.
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error downloading attachment:", error);
    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}

