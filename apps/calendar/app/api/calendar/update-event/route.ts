import { NextResponse } from "next/server";

import {
  googleCalendarClient,
  requireCalendarUser,
} from "@/lib/google-calendar-auth";

export async function PUT(request: Request) {
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
  const body = await request.json();
  const { eventId, eventData } = body as {
    eventId?: string;
    eventData?: Record<string, unknown>;
  };

  if (!eventId || !eventData) {
    return NextResponse.json(
      { error: "Event ID and event data are required" },
      { status: 400 },
    );
  }

  try {
    const calendar = googleCalendarClient(accessToken);

    const existingEvent = await calendar.events.get({
      calendarId: "primary",
      eventId,
    });

    if (!existingEvent.data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updatedEvent = {
      ...existingEvent.data,
      summary: (eventData.summary as string) || existingEvent.data.summary,
      description: eventData.description as string | null | undefined,
      location: eventData.location as string | null | undefined,
      start:
        (eventData.start as typeof existingEvent.data.start) ||
        existingEvent.data.start,
      end:
        (eventData.end as typeof existingEvent.data.end) ||
        existingEvent.data.end,
    };

    const response = await calendar.events.update({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
      requestBody: updatedEvent,
    });

    return NextResponse.json({
      success: true,
      eventId: response.data.id,
      message: "Event updated successfully",
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
