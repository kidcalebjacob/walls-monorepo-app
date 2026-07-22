import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";
import { prepareEmailRequest, formatSenderName } from "@/utils/composition-formatting";
import { v4 as uuidv4 } from 'uuid';

// Function to generate the email signature
const generateSignature = (userData: { 
  displayName: string; 
  title: string; 
  department: string;
  email: string;
}) => `
<table cellpadding="0" cellspacing="0" border="0" style="width: 500px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #000; margin-top: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);">
  <tr>
    <td style="padding: 20px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <!-- Logo and Name Section -->
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td style="vertical-align: middle; width: 80px;">
                  <img src="https://www.wallsentertainment.com/images/emailSignature/logo.png" 
                       alt="WALLS Entertainment Logo" 
                       width="70" 
                       style="display: block;">
                </td>
                <td style="vertical-align: middle; padding-left: 14px;">
                  <div style="font-size: 17px; font-weight: 600; color: #000000; margin-bottom: 2px; letter-spacing: -0.2px;">
                    ${userData.displayName}
                  </div>
                  <div style="font-size: 13px; color: #1a1a1a; font-weight: 400; letter-spacing: -0.1px;">
                    WALLS Entertainment
                  </div>
                  <div style="font-size: 13px; color: #1a1a1a; font-weight: 400; letter-spacing: -0.1px;">
                    ${userData.title}, ${userData.department}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td>
            <div style="height: 1px; background-color: rgba(0, 0, 0, 0.2); margin: 16px 0;"></div>
          </td>
        </tr>

        <!-- Contact Info and Social Media Section -->
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td>
                  <!-- Contact Info -->
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="color: rgba(0,0,0,0.7); font-size: 12px; font-weight: 500; padding-right: 8px; font-family: 'SF Mono', Monaco, monospace;">E:</td>
                      <td>
                        <a href="mailto:${userData.email}" 
                           style="color: #000000; text-decoration: none; font-size: 12px; font-weight: 400;">
                          ${userData.email}
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="color: rgba(0,0,0,0.7); font-size: 12px; font-weight: 500; padding-right: 8px; font-family: 'SF Mono', Monaco, monospace;">P:</td>
                      <td style="color: #000000; font-size: 12px; font-weight: 400;">
                        647.767.6078
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Social Media Icons -->
                <td style="text-align: right;">
                  <a href="https://www.wallsentertainment.com/" style="text-decoration: none; margin-left: 12px;">
                    <img src="https://www.wallsentertainment.com/images/emailSignature/website.png" 
                         alt="Website Social Icon" 
                         width="28" 
                         style="display: inline-block;">
                  </a>
                  <a href="https://www.linkedin.com/company/walls-entertainment/" style="text-decoration: none; margin-left: 12px;">
                    <img src="https://www.wallsentertainment.com/images/emailSignature/linkedin.png" 
                         alt="LinkedIn Social Icon" 
                         width="28" 
                         style="display: inline-block;">
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = toUser(supabaseUser);

    if (!user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { subject, message, attachments } = await req.json();

    console.log('Sending test email to:', user.email);
    console.log('Test email content:', message);
    console.log('Attachments:', attachments?.length || 0);

    // Fetch user data from Supabase users table by email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('email', user.email)
      .single();

    // Parse first_name + last_name to make the sender name
    const firstName = userData?.first_name || '';
    const lastName = userData?.last_name || '';
    const displayName = `${firstName} ${lastName}`.trim() || user.email;
    
    // Use email from users table if available, otherwise fallback to auth user email
    const senderEmail = userData?.email || user.email;

    const userDataFormatted = {
      displayName: displayName,
      title: '', // Not in the users table schema provided
      department: '', // Not in the users table schema provided
      email: senderEmail
    };

    // Use the email from the users table for sending
    const gmail = await getGmailClient(senderEmail);
    const formattedFromName = displayName;

    // Check if message contains flashy signature placeholder and replace it
    let messageWithSignature = message;
    if (message.includes('{flashySignature}')) {
      messageWithSignature = message.replace('{flashySignature}', generateSignature({
        displayName: userDataFormatted.displayName,
        title: userDataFormatted.title,
        department: userDataFormatted.department,
        email: user.email
      }));
    }

    // Generate UUID v4 for Supabase compatibility
    const wallsMessageId = uuidv4();
    const wallsThreadId = uuidv4();

    // Add custom headers with UUIDs
    const testHeaders = {
      'X-WALLS-Message-ID': wallsMessageId,
      'X-WALLS-Thread-ID': wallsThreadId,
    };

    const requestBody = prepareEmailRequest({
      to: senderEmail, // Send test email to the user's email from users table
      subject: `[TEST] ${subject}`,
      message: messageWithSignature,
      formattedFromName,
      userEmail: senderEmail, // Use email from users table
      attachments,
      headers: testHeaders,
    });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody
    });

    return NextResponse.json({ 
      success: true,
      testEmailSent: true
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: 'Failed to send test email', details: error.message },
      { status: 500 }
    );
  }
}