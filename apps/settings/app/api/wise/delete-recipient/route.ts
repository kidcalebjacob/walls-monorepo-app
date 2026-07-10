import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function DELETE(request: NextRequest) {
  try {
    console.error('🔵 Starting delete-recipient request');
    
    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Get and validate the raw auth cookie
    const rawCookie = cookieStore.getAll().find(c => c.name.includes("-auth-token"))?.value;
    if (!rawCookie) {
      console.error('🔴 No auth cookie found');
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error('🔍 Found auth cookie:', rawCookie.substring(0, 20) + '...');

    // Decode the base64 cookie and extract the access token
    let access_token;
    try {
      const decoded = JSON.parse(Buffer.from(rawCookie.split("base64-")[1], "base64").toString("utf-8"));
      access_token = decoded.access_token;
      console.error('🔵 Successfully decoded access token');
    } catch (e) {
      console.error('🔴 Failed to decode auth token from cookie', e);
      return NextResponse.json({ error: "Invalid auth token format" }, { status: 401 });
    }

    // Verify the session with the decoded access token
    const { data: { user }, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !user) {
      console.error('🔴 Invalid session:', authError);
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    console.error('🔵 Authenticated user:', { userId: user.id });

    // Get the user's Wise details from Supabase
    const { data: wiseDetails, error: wiseError } = await supabase
      .from('wise_recipients')
      .select('wise_recipient_id')
      .eq('user_id', user.id)
      .single();

    if (wiseError || !wiseDetails) {
      console.error('🔴 No Wise details found for user:', wiseError);
      return NextResponse.json({ error: "No payment details found" }, { status: 404 });
    }

    const wiseRecipientId = wiseDetails.wise_recipient_id;
    
    if (!wiseRecipientId) {
      console.error('🔴 No Wise recipient ID found');
      // If there's no Wise recipient ID, just delete from Supabase
      const { error: deleteError } = await supabase
        .from('wise_recipients')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('🔴 Error deleting from Supabase:', deleteError);
        return NextResponse.json({ error: "Failed to delete payment details" }, { status: 500 });
      }

      return NextResponse.json({
        message: "Payment details deleted successfully",
      });
    }

    // Delete from Wise API
    console.error('🔵 Deleting Wise recipient:', wiseRecipientId);
    try {
      const wiseResponse = await fetch(`https://api.transferwise.com/v1/accounts/${wiseRecipientId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.WISE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      });

      if (!wiseResponse.ok) {
        const responseText = await wiseResponse.text();
        let parsedError;
        try {
          const parsed = JSON.parse(responseText);
          console.error('🔴 Wise API Error Details:', {
            ...parsed,
            status: wiseResponse.status,
            statusText: wiseResponse.statusText,
          });
          parsedError = parsed.errors?.map((e: any) => e.message).join("; ") || parsed.message || "Failed to delete from Wise";
        } catch (e) {
          console.error('🔴 Failed to parse error response:', responseText);
          parsedError = responseText || "Failed to delete from Wise";
        }
        
        // Even if Wise deletion fails, we should still try to delete from Supabase
        console.error('⚠️ Wise deletion failed, but continuing with Supabase deletion');
      } else {
        console.error('✅ Successfully deleted from Wise API');
      }
    } catch (error) {
      console.error('🔴 Error calling Wise API:', error);
      // Continue with Supabase deletion even if Wise API fails
      console.error('⚠️ Wise API error, but continuing with Supabase deletion');
    }

    // Delete from Supabase
    console.error('🔵 Deleting from Supabase');
    const { error: deleteError } = await supabase
      .from('wise_recipients')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('🔴 Error deleting from Supabase:', deleteError);
      return NextResponse.json({ error: "Failed to delete payment details from database" }, { status: 500 });
    }

    console.error('✅ Successfully deleted payment details');
    return NextResponse.json({
      message: "Payment details deleted successfully",
    });
  } catch (error) {
    console.error("🔴 Error deleting payment details:", error);
    return NextResponse.json(
      { error: "Failed to delete payment details" },
      { status: 500 },
    );
  }
}
