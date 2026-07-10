import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyCalendarSyncTeardown } from '@/lib/calendar-sync-notify';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)
      .single();

    if (userError || !supabaseUser) {
      console.error('No Supabase user found for:', email, userError);
      return NextResponse.json({
        error: 'User not found in Supabase',
        details: 'Please ensure your email exists in the users table',
      }, { status: 404 });
    }

    const { data: calendarConnections, error: connectionError } = await supabase
      .from('user_connections')
      .select('id')
      .eq('user_id', supabaseUser.id)
      .eq('provider', 'google')
      .eq('service', 'calendar')
      .is('revoked_at', null);

    if (connectionError) {
      console.error('Error finding calendar connections:', connectionError);
      return NextResponse.json({
        error: 'Failed to find calendar connections',
        details: connectionError.message,
      }, { status: 500 });
    }

    if (!calendarConnections || calendarConnections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active calendar connections found to disconnect',
      });
    }

    const connectionIds = calendarConnections.map((conn) => conn.id);

    for (const connectionId of connectionIds) {
      await notifyCalendarSyncTeardown(connectionId);
    }

    // Soft revoke does not trigger FK cascades — delete synced calendar data explicitly.
    const { error: exceptionsError } = await supabase
      .from('calendar_recurrence_exceptions')
      .delete()
      .in('connection_id', connectionIds);

    if (exceptionsError) {
      console.error('Error deleting calendar recurrence exceptions:', exceptionsError);
      return NextResponse.json({
        error: 'Failed to clear calendar recurrence exceptions',
        details: exceptionsError.message,
      }, { status: 500 });
    }

    const { error: recurrencesError } = await supabase
      .from('calendar_recurrences')
      .delete()
      .in('connection_id', connectionIds);

    if (recurrencesError) {
      console.error('Error deleting calendar recurrences:', recurrencesError);
      return NextResponse.json({
        error: 'Failed to clear calendar recurrences',
        details: recurrencesError.message,
      }, { status: 500 });
    }

    const { error: eventsError } = await supabase
      .from('calendar_events')
      .delete()
      .in('connection_id', connectionIds);

    if (eventsError) {
      console.error('Error deleting calendar events:', eventsError);
      return NextResponse.json({
        error: 'Failed to clear calendar events',
        details: eventsError.message,
      }, { status: 500 });
    }

    const { error: syncStateError } = await supabase
      .from('calendar_sync_state')
      .delete()
      .in('connection_id', connectionIds);

    if (syncStateError) {
      console.error('Error deleting calendar sync state:', syncStateError);
      return NextResponse.json({
        error: 'Failed to clear calendar sync state',
        details: syncStateError.message,
      }, { status: 500 });
    }

    const { error: refreshError } = await supabase.rpc('refresh_calendar_view');

    if (refreshError) {
      console.error('Error refreshing calendar_view:', refreshError);
      return NextResponse.json({
        error: 'Failed to refresh calendar view',
        details: refreshError.message,
      }, { status: 500 });
    }

    const { error: revokeError } = await supabase
      .from('user_connections')
      .update({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', connectionIds);

    if (revokeError) {
      console.error('Error revoking calendar connections:', revokeError);
      return NextResponse.json({
        error: 'Failed to disconnect Calendar',
        details: revokeError.message,
      }, { status: 500 });
    }

    console.log(
      `Successfully disconnected ${calendarConnections.length} calendar connection(s) and cleared synced events for:`,
      email,
    );

    return NextResponse.json({
      success: true,
      connectionsRevoked: calendarConnections.length,
    });
  } catch (error) {
    console.error('Error disconnecting Calendar:', error);
    return NextResponse.json(
      {
        error: 'Failed to disconnect Calendar',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
