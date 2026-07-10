import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Initialize Supabase client with service role key for server-side access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get the Supabase user_id by matching email
    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !supabaseUser) {
      console.error('No Supabase user found for:', email, userError);
      return NextResponse.json({ 
        error: 'User not found in Supabase',
        details: 'Please ensure your email exists in the users table'
      }, { status: 404 });
    }

    // Find all active Gmail connections for this user
    const { data: gmailConnections, error: connectionError } = await supabase
      .from('user_connections')
      .select('id')
      .eq('user_id', supabaseUser.id)
      .eq('provider', 'google')
      .eq('service', 'gmail')
      .is('revoked_at', null);

    if (connectionError) {
      console.error('Error finding Gmail connections:', connectionError);
      return NextResponse.json(
        { error: 'Failed to find Gmail connections', details: connectionError.message },
        { status: 500 }
      );
    }

    if (!gmailConnections || gmailConnections.length === 0) {
      // No active connections to revoke
      return NextResponse.json({ 
        success: true,
        message: 'No active Gmail connections found to disconnect'
      });
    }

    // Revoke all Gmail connections by setting revoked_at timestamp
    const connectionIds = gmailConnections.map(conn => conn.id);
    const { error: revokeError } = await supabase
      .from('user_connections')
      .update({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', connectionIds);

    if (revokeError) {
      console.error('Error revoking Gmail connections:', revokeError);
      return NextResponse.json(
        { error: 'Failed to revoke Gmail connections', details: revokeError.message },
        { status: 500 }
      );
    }

    // Note: email_sync_state records will be automatically deleted due to CASCADE foreign key
    // But we can optionally clean them up explicitly if needed
    const { error: syncStateError } = await supabase
      .from('email_sync_state')
      .delete()
      .in('connection_id', connectionIds);

    if (syncStateError) {
      // Log but don't fail - CASCADE should handle this, but explicit cleanup is good
      console.warn('Error cleaning up email_sync_state (may already be deleted by CASCADE):', syncStateError);
    }

    console.log(`Successfully disconnected ${gmailConnections.length} Gmail connection(s) for:`, email);

    return NextResponse.json({ 
      success: true,
      connectionsRevoked: gmailConnections.length
    });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 