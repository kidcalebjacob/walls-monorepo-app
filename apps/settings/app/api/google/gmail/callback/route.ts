// app/api/google/gmail/callback/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

import {
  getConnectPageUrl,
  getGmailOAuthRedirectUri,
} from '@/lib/google-oauth';

export async function GET(request: Request) {
  console.log('Gmail Callback route hit!');

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
        getGmailOAuthRedirectUri()
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
        .eq('service', 'gmail')
        .eq('account_id', googleAccountId) // Match by Google account ID, not just user
        .is('revoked_at', null)
        .limit(1);

      const connectionData = {
        user_id: supabaseUser.id,
        provider: 'google',
        service: 'gmail',
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

      // Get the connection ID - either from existing or from insert
      let connectionId: string;

      // If connection exists and is not revoked, update it; otherwise insert new
      if (existingConnections && existingConnections.length > 0 && !checkError) {
        // Update existing connection
        connectionId = existingConnections[0].id;
        const { error: updateError } = await supabase
          .from('user_connections')
          .update(connectionData)
          .eq('id', connectionId);

        if (updateError) {
          console.error('Error updating Gmail connection:', updateError);
          return NextResponse.json({ 
            error: 'Failed to update Gmail connection',
            details: updateError.message
          }, { status: 500 });
        }

        console.log('Gmail connection updated successfully for:', userEmail);
      } else {
        // Insert new connection and get the ID
        const { data: insertedConnection, error: insertError } = await supabase
          .from('user_connections')
          .insert(connectionData)
          .select('id')
          .single();

        if (insertError || !insertedConnection) {
          console.error('Error creating Gmail connection:', insertError);
          return NextResponse.json({ 
            error: 'Failed to create Gmail connection',
            details: insertError?.message
          }, { status: 500 });
        }

        connectionId = insertedConnection.id;
        console.log('Gmail connection created successfully for:', userEmail);
      }

      // Set up Gmail watch and store in email_sync_state
      try {
        // Re-initialize OAuth client with the refresh token for watch setup
        const watchOAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          getGmailOAuthRedirectUri()
        );

        watchOAuth2Client.setCredentials({
          refresh_token: refreshToken
        });

        const gmail = google.gmail({ version: 'v1', auth: watchOAuth2Client });

        // Set up Gmail push notifications
        const watchResponse = await gmail.users.watch({
          userId: 'me',
          requestBody: {
            topicName: process.env.GMAIL_PUBSUB_TOPIC,
            labelIds: ['INBOX'], // Watch for changes in INBOX
          }
        });

        // Validate that we have the required expiration timestamp
        if (!watchResponse.data.expiration) {
          console.error('Gmail watch response missing expiration timestamp');
          // Don't fail the whole connection, just log the error
        } else {
          // Convert expiration from milliseconds to ISO timestamp
          const watchExpiration = new Date(parseInt(watchResponse.data.expiration)).toISOString();
          const watchRenewedAt = new Date().toISOString();

          // Upsert watch data to email_sync_state table
          const { error: syncStateError } = await supabase
            .from('email_sync_state')
            .upsert({
              connection_id: connectionId,
              account_id: googleAccountId,
              history_id: watchResponse.data.historyId || null,
              watch_renewed_at: watchRenewedAt,
              watch_expiration: watchExpiration,
            }, {
              onConflict: 'connection_id,account_id'
            });

          if (syncStateError) {
            console.error('Error storing watch data to email_sync_state:', syncStateError);
            // Don't fail the whole connection, just log the error
          } else {
            console.log('Gmail watch set up successfully for:', userEmail);
          }
        }
      } catch (watchError) {
        console.error('Error setting up Gmail watch (non-fatal):', watchError);
        // Don't fail the whole connection if watch setup fails
        // The watch can be set up later via the setup-watch endpoint
      }

      // Redirect back to inbox
      console.log('Redirecting to inbox...');
      return NextResponse.redirect(new URL(getConnectPageUrl()));

    } catch (innerError) {
      console.error('Inner error:', innerError);
      throw innerError;
    }

  } catch (error) {
    console.error('Gmail callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ 
      error: 'Failed to handle callback',
      details: message,
      stack
    }, { status: 500 });
  }
}