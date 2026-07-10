import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { notifyCalendarSyncSetup } from '@/lib/calendar-sync-notify';
import {
  getCalendarOAuthRedirectUri,
  getConnectPageUrl,
} from '@/lib/google-oauth';

export async function GET(request: Request) {
  console.log('Calendar Callback route hit!');

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const userEmail = searchParams.get('state');

    console.log('Got parameters:', { 
      hasCode: !!code, 
      userEmail,
      fullUrl: request.url 
    });

    if (!code || !userEmail) {
      console.log('Missing required parameters');
      return NextResponse.json({ error: 'Code and user email are required' }, { status: 400 });
    }

    try {
      // Initialize OAuth client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        getCalendarOAuthRedirectUri()
      );

      console.log('Getting tokens from Google...');
      const { tokens: googleTokens } = await oauth2Client.getToken(code);
      console.log('Got tokens:', {
        hasAccessToken: !!googleTokens.access_token,
        hasRefreshToken: !!googleTokens.refresh_token,
        hasIdToken: !!googleTokens.id_token
      });

      // Decode the ID token to get Google account info
      let googleAccountId: string;
      let googleAccountEmail: string;
      
      if (googleTokens.id_token) {
        try {
          const decoded = JSON.parse(
            Buffer.from(googleTokens.id_token.split('.')[1], 'base64').toString('utf-8')
          );
          // Use Google's stable account ID (sub) instead of email
          googleAccountId = decoded.sub; // e.g. "110169484474386276334"
          googleAccountEmail = decoded.email || userEmail;
          console.log('Decoded Google account:', { sub: googleAccountId, email: googleAccountEmail });
        } catch (decodeError) {
          console.error('Error decoding ID token, falling back to email:', decodeError);
          // Fallback to email if ID token decoding fails
          googleAccountId = userEmail;
          googleAccountEmail = userEmail;
        }
      } else {
        // Fallback if no ID token
        console.warn('No ID token received, using email as account_id');
        googleAccountId = userEmail;
        googleAccountEmail = userEmail;
      }

      // Initialize Supabase client
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Get the Supabase user_id by matching email
      const { data: supabaseUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .limit(1)
        .single();

      if (userError || !supabaseUser) {
        console.error('No Supabase user found for:', userEmail, userError);
        return NextResponse.json({ 
          error: 'User not found in Supabase',
          details: 'Please ensure your email exists in the users table'
        }, { status: 404 });
      }

      // Store tokens as plain text
      const accessToken = googleTokens.access_token || null;
      const refreshToken = googleTokens.refresh_token || null;

      // Generate scope hash for tracking
      const scopeHash = googleTokens.scope 
        ? crypto.createHash('sha256').update(googleTokens.scope).digest('hex')
        : null;

      // Calculate token expiry timestamp
      const tokenExpiry = googleTokens.expiry_date 
        ? new Date(googleTokens.expiry_date).toISOString()
        : null;

      // Check if connection already exists (not revoked) for this specific Google account
      const { data: existingConnections, error: checkError } = await supabase
        .from('user_connections')
        .select('id')
        .eq('user_id', supabaseUser.id)
        .eq('provider', 'google')
        .eq('service', 'calendar')
        .eq('account_id', googleAccountId) // Match by Google account ID, not just user
        .is('revoked_at', null)
        .limit(1);

      const connectionData = {
        user_id: supabaseUser.id,
        provider: 'google',
        service: 'calendar',
        account_id: googleAccountId, // Use Google's stable 'sub' instead of email
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: tokenExpiry,
        token_payload: {
          scope: googleTokens.scope,
          token_type: googleTokens.token_type || 'Bearer',
          email: googleAccountEmail // Store email in payload for reference/search
        },
        scope_hash: scopeHash,
        last_token_refresh: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revoked_at: null
      };

      let connectionId: string;

      if (existingConnections && existingConnections.length > 0 && !checkError) {
        connectionId = existingConnections[0].id;

        const { error: updateError } = await supabase
          .from('user_connections')
          .update(connectionData)
          .eq('id', connectionId);

        if (updateError) {
          console.error('Error updating calendar connection:', updateError);
          return NextResponse.json({
            error: 'Failed to update calendar connection',
            details: updateError.message,
          }, { status: 500 });
        }

        console.log('Calendar connection updated successfully for:', userEmail);
      } else {
        const { data: newConnection, error: insertError } = await supabase
          .from('user_connections')
          .insert(connectionData)
          .select('id')
          .single();

        if (insertError || !newConnection) {
          console.error('Error creating calendar connection:', insertError);
          return NextResponse.json({
            error: 'Failed to create calendar connection',
            details: insertError?.message,
          }, { status: 500 });
        }

        connectionId = newConnection.id;
        console.log('Calendar connection created successfully for:', userEmail);
      }

      await notifyCalendarSyncSetup(connectionId);

      // Redirect back to settings
      console.log('Redirecting to settings...');
      return NextResponse.redirect(new URL(getConnectPageUrl()));

    } catch (innerError) {
      console.error('Inner error:', innerError);
      throw innerError;
    }

  } catch (error) {
    console.error('Calendar callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ 
      error: 'Failed to handle callback',
      details: message,
      stack
    }, { status: 500 });
  }
} 