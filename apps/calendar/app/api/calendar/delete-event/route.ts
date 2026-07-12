import { NextResponse } from "next/server";

import {
  googleCalendarClient,
  requireCalendarUser,
} from "@/lib/google-calendar-auth";

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
  }

  const { user, error } = await requireCalendarUser();
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Invalid Authorization header", requiresReauth: true },
      { status: 401 },
    );
  }

  const accessToken = authHeader.split(" ")[1];

  try {
    const calendar = googleCalendarClient(accessToken);
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (apiError: unknown) {
    const err = apiError as { code?: number; message?: string; response?: { status?: number } };

    if (err.code === 401 || err.response?.status === 401) {
      return NextResponse.json(
        {
          error: "Invalid or expired Google Calendar token",
          requiresReauth: true,
          details: err.message,
        },
        { status: 401 },
      );
    }

    if (err.code === 404 || err.response?.status === 404) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "Google Calendar API error",
        details: err.message || "Unknown API error",
      },
      { status: 500 },
    );
  }
}
