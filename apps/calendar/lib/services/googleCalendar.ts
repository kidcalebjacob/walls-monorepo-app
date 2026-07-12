// Browser-compatible Google Calendar API service
import { addMinutes, format } from 'date-fns';

// Types for Google Calendar integration
export interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendees?: { email: string }[];
  conferenceData?: boolean;
}

// Environment variables
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const REDIRECT_URI = 'https://www.wallsentertainment.com/api/auth/gmail/callback';

// Scopes required for Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Generate Google authorization URL
 */
export const getGoogleAuthUrl = (): string => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  
  authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('access_type', 'offline');
  authUrl.searchParams.append('prompt', 'consent');
  authUrl.searchParams.append('scope', SCOPES.join(' '));
  
  return authUrl.toString();
};

/**
 * Create a Google Calendar event with optional Google Meet conferencing
 * This function is called from the client but the actual API call happens in the API route
 */
export const createGoogleCalendarEvent = async (
  tokens: any,
  eventData: GoogleCalendarEvent
): Promise<string> => {
  try {
    // Call our API route to create the event
    const response = await fetch('/api/calendar/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventData,
        tokens,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || 'Failed to create Google Calendar event');
    }
    
    const data = await response.json();
    return data.eventId || '';
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw error;
  }
}; 