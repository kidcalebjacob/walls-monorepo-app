"use client";

import { getSupabaseClient, useAuth } from "@/lib/auth";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";

export function ConnectForm() {
  const { user } = useAuth();
  const [isGmailConnected, setIsGmailConnected] = useState<boolean | null>(null);
  const [isCalendarConnected, setIsCalendarConnected] = useState<boolean | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Initial loading states for each service
  const [gmailChecking, setGmailChecking] = useState(true);
  const [calendarChecking, setCalendarChecking] = useState(true);

  // Hover states for icon animations
  const [gmailHover, setGmailHover] = useState(false);
  const [calendarHover, setCalendarHover] = useState(false);

  useEffect(() => {
    const checkConnections = async () => {
      if (!user?.email) {
        setGmailChecking(false);
        setCalendarChecking(false);
        return;
      }

      try {
        const supabase = getSupabaseClient();

        // First, get the user_id from Supabase users table by matching email
        const { data: supabaseUser, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .limit(1)
          .single();

        if (userError || !supabaseUser) {
          console.log('No Supabase user found for connection check:', userError);
          setIsGmailConnected(false);
          setIsCalendarConnected(false);
          setGmailChecking(false);
          setCalendarChecking(false);
          return;
        }

        // Check Gmail connection from Supabase
        try {
          const { data: gmailConnection, error: gmailError } = await supabase
            .from('user_connections')
            .select('id, revoked_at')
            .eq('user_id', supabaseUser.id)
            .eq('provider', 'google')
            .eq('service', 'gmail')
            .is('revoked_at', null)
            .limit(1)
            .maybeSingle();

          if (gmailError) {
            console.error('Error checking Gmail connection:', gmailError);
            setIsGmailConnected(false);
          } else {
            setIsGmailConnected(!!gmailConnection && !gmailConnection.revoked_at);
          }
        } catch (gmailError) {
          console.error('Error checking Supabase Gmail connection:', gmailError);
          setIsGmailConnected(false);
        } finally {
          // Only set checking to false after connection state is set
          setGmailChecking(false);
        }

        // Check Calendar connection from Supabase
        try {
          const { data: calendarConnection, error: connectionError } = await supabase
            .from('user_connections')
            .select('id, revoked_at')
            .eq('user_id', supabaseUser.id)
            .eq('provider', 'google')
            .eq('service', 'calendar')
            .is('revoked_at', null)
            .limit(1)
            .maybeSingle();

          if (connectionError) {
            console.error('Error checking calendar connection:', connectionError);
            setIsCalendarConnected(false);
          } else {
            // Connection exists and is not revoked
            setIsCalendarConnected(!!calendarConnection && !calendarConnection.revoked_at);
          }
        } catch (supabaseError) {
          console.error('Error checking Supabase calendar connection:', supabaseError);
          setIsCalendarConnected(false);
        } finally {
          // Only set checking to false after connection state is set
          setCalendarChecking(false);
        }

      } catch (error) {
        console.error('Error checking connections:', error);
        setGmailChecking(false);
        setCalendarChecking(false);
      }
    };

    checkConnections();
  }, [user?.email]);

  const connectGmail = () => {
    setGmailLoading(true);
    const scopes = [
      'openid', // Required to get ID token with Google account info
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.settings.basic',
      'https://www.googleapis.com/auth/gmail.settings.sharing',
      'https://www.googleapis.com/auth/contacts'
    ];

    const settingsOrigin =
      process.env.NEXT_PUBLIC_SETTINGS_URL?.replace(/\/$/, "") ??
      window.location.origin;
    const redirectUri = `${settingsOrigin}/api/google/gmail/callback`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    const params = {
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes.join(' '),
      state: user?.email || ''
    };

    const fullUrl = authUrl.toString() + '?' + new URLSearchParams(params).toString();
    window.location.href = fullUrl;
  };

  const connectCalendar = () => {
    setCalendarLoading(true);
    const scopes = [
      'openid', // Required to get ID token with Google account info
      'https://www.googleapis.com/auth/calendar'
    ];

    const settingsOrigin =
      process.env.NEXT_PUBLIC_SETTINGS_URL?.replace(/\/$/, "") ??
      window.location.origin;
    const redirectUri = `${settingsOrigin}/api/google/calendar/callback`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    const params = {
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes.join(' '),
      state: user?.email || ''
    };

    const fullUrl = authUrl.toString() + '?' + new URLSearchParams(params).toString();
    window.location.href = fullUrl;
  };

  const disconnectGmail = async () => {
    if (!user?.email) return;
    
    try {
      const res = await fetch("/api/google/gmail/disconnect", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email }),
      });
      
      if (res.ok) {
        setIsGmailConnected(false);
      } else {
        console.error('Failed to disconnect Gmail');
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
    }
  };

  const disconnectCalendar = async () => {
    if (!user?.email) return;
    
    try {
      const res = await fetch("/api/google/calendar/disconnect", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email }),
      });
      
      if (res.ok) {
        setIsCalendarConnected(false);
      } else {
        console.error('Failed to disconnect Calendar');
      }
    } catch (error) {
      console.error('Error disconnecting Calendar:', error);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-none bg-kenoo-white">
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-8 pt-20 pb-8">
          <div className="space-y-12">
            {/* Gmail */}
            <div className="flex items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 flex-shrink-0">
                  <Image
                    src="https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png"
                    alt="Gmail Logo"
                    width={48}
                    height={48}
                    priority
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-black uppercase">
                    Gmail
                  </h2>
                </div>
              </div>
              <div className="flex-1 border-t border-black h-[1px] mx-4" />
              <motion.button
                onClick={isGmailConnected ? disconnectGmail : connectGmail}
                disabled={gmailLoading || gmailChecking || isGmailConnected === null}
                onMouseEnter={() => setGmailHover(true)}
                onMouseLeave={() => setGmailHover(false)}
                initial={{ width: 36, height: 36 }}
                animate={{
                  width: (gmailChecking || isGmailConnected === null) ? 36 : "auto",
                  height: (gmailChecking || isGmailConnected === null) ? 36 : "auto"
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="px-0 py-0 text-sm font-medium text-gray-800 bg-kenoo-yellow hover:bg-kenoo-yellow/90 rounded z-10 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  paddingLeft: (gmailChecking || isGmailConnected === null) ? 0 : 16,
                  paddingRight: (gmailChecking || isGmailConnected === null) ? 0 : 16,
                  paddingTop: (gmailChecking || isGmailConnected === null) ? 0 : 8,
                  paddingBottom: (gmailChecking || isGmailConnected === null) ? 0 : 8,
                }}
              >
                {gmailChecking || isGmailConnected === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : gmailLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    Connect
                  </>
                ) : isGmailConnected ? (
                  <>
                    <motion.div
                      animate={{ rotate: gmailHover ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <X className="h-4 w-4 text-black" />
                    </motion.div>
                    Disconnect
                  </>
                ) : (
                  <>
                    <motion.div
                      animate={{ rotate: gmailHover ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <Plus className="h-4 w-4" />
                    </motion.div>
                    Connect
                  </>
                )}
              </motion.button>
            </div>

            {/* Google Calendar */}
            <div className="flex items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 flex-shrink-0">
                  <Image
                    src="https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png"
                    alt="Google Calendar Logo"
                    width={48}
                    height={48}
                    priority
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-black uppercase">
                    Calendar
                  </h2>
                </div>
              </div>
              <div className="flex-1 border-t border-black h-[1px] mx-4" />
              <motion.button
                onClick={isCalendarConnected ? disconnectCalendar : connectCalendar}
                disabled={calendarLoading || calendarChecking || isCalendarConnected === null}
                onMouseEnter={() => setCalendarHover(true)}
                onMouseLeave={() => setCalendarHover(false)}
                initial={{ width: 36, height: 36 }}
                animate={{
                  width: (calendarChecking || isCalendarConnected === null) ? 36 : "auto",
                  height: (calendarChecking || isCalendarConnected === null) ? 36 : "auto"
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="px-0 py-0 text-sm font-medium text-gray-800 bg-kenoo-yellow hover:bg-kenoo-yellow/90 rounded z-10 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  paddingLeft: (calendarChecking || isCalendarConnected === null) ? 0 : 16,
                  paddingRight: (calendarChecking || isCalendarConnected === null) ? 0 : 16,
                  paddingTop: (calendarChecking || isCalendarConnected === null) ? 0 : 8,
                  paddingBottom: (calendarChecking || isCalendarConnected === null) ? 0 : 8,
                }}
              >
                {calendarChecking || isCalendarConnected === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : calendarLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    Connect
                  </>
                ) : isCalendarConnected ? (
                  <>
                    <motion.div
                      animate={{ rotate: calendarHover ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <X className="h-4 w-4 text-black" />
                    </motion.div>
                    Disconnect
                  </>
                ) : (
                  <>
                    <motion.div
                      animate={{ rotate: calendarHover ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <Plus className="h-4 w-4" />
                    </motion.div>
                    Connect
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
