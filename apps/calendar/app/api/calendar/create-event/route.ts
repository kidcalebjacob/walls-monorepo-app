import { NextResponse } from "next/server";

import type { GoogleCalendarEvent } from "@/lib/services/googleCalendar";
import {
  getCalendarTokensForUser,
  googleCalendarClient,
  requireCalendarUser,
} from "@/lib/google-calendar-auth";

export async function POST(request: Request) {
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
  const { eventData } = body as { eventData?: Record<string, unknown> };

  if (!eventData) {
    return NextResponse.json({ error: "Event data is required" }, { status: 400 });
  }

  const tokens = await getCalendarTokensForUser(user.id);
  if (!tokens.ok) {
    return NextResponse.json(
      {
        error: tokens.error,
        requiresGoogleAuth: tokens.requiresGoogleAuth,
        requiresReauth: tokens.requiresReauth,
      },
      { status: tokens.status },
    );
  }

  if (accessToken !== tokens.accessToken) {
    return NextResponse.json(
      { error: "Invalid or expired Google Calendar token", requiresReauth: true },
      { status: 401 },
    );
  }

  const parsedEventData: GoogleCalendarEvent = {
    ...(eventData as unknown as GoogleCalendarEvent),
    startTime: new Date(eventData.startTime as string),
    endTime: new Date(eventData.endTime as string),
  };

  try {
    const calendar = googleCalendarClient(accessToken);

    const event: Record<string, unknown> = {
      summary: parsedEventData.summary,
      description: parsedEventData.description,
      location: parsedEventData.location,
      start: {
        dateTime: parsedEventData.startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: parsedEventData.endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: parsedEventData.attendees,
    };

    if (parsedEventData.conferenceData) {
      event.conferenceData = {
        createRequest: {
          requestId: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: parsedEventData.conferenceData ? 1 : 0,
      sendUpdates: "all",
      requestBody: event,
    });

    return NextResponse.json({
      success: true,
      eventId: response.data.id,
      message: "Event created successfully",
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

    return NextResponse.json(
      {
        error: "Google Calendar API error",
        details: err.message || "Unknown API error",
      },
      { status: 500 },
    );
  }
}
