// app/api/gmail/send/sequence/route.ts
import { NextResponse } from 'next/server';
import { createClient } from "@/lib/supabase/server";
import { toUser } from "@/hooks/user";
import { transformToGmailFormat } from "@/utils/composition-formatting";
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

// Function to clean and format text content
function formatTextContent(html: string): string {
  // Remove all HTML tags
  let text = html.replace(/<[^>]+>/g, ' ');
  
  // Replace multiple spaces, newlines, and special characters
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  
  // Fix spacing after punctuation
  text = text
    .replace(/([.!?])\s*([A-Za-z])/g, '$1 $2')  // Add space after periods, exclamation marks, and question marks
    .replace(/,\s*([A-Za-z])/g, ', $1');        // Add space after commas
  
  return text;
}

function formatSnippet(html: string): string {
  const text = formatTextContent(html);
  return text.substring(0, 150);
}

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

    // Fetch user data from Supabase users table by email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('email', user.email)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { emails, subject, personId, selectedCreators } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'At least one email is required' },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 }
      );
    }

    // Parse first_name + last_name to make the sender name
    const firstName = userData?.first_name || '';
    const lastName = userData?.last_name || '';
    const displayName = `${firstName} ${lastName}`.trim() || user.email;
    
    // Use email from users table if available, otherwise fallback to auth user email
    const senderEmail = userData?.email || user.email;

    const userDataFormatted = {
      displayName: displayName,
      title: '', // Not in the users table schema
      department: '', // Not in the users table schema
      email: senderEmail
    };

    // Create sequence with subject as name
    const sequenceName = subject;
    const sequenceId = uuidv4();

    const { data: sequence, error: sequenceError } = await supabase
      .from('sequences')
      .insert({
        id: sequenceId,
        name: sequenceName,
        description: null,
        status: 'active',
        stop_on_reply: true,
        daily_limit: null,
        sequence_owner: userData.id,
        is_campaign: false,
        schedule_id: 'dc470131-edaf-40a7-a03d-1206db7410b5' // Default schedule ID
      })
      .select()
      .single();

    if (sequenceError) {
      console.error('Error creating sequence:', sequenceError);
      return NextResponse.json(
        { error: 'Failed to create sequence', details: sequenceError.message },
        { status: 500 }
      );
    }

    // Generate a single x_header_thread_id for the entire sequence
    const wallsThreadId = uuidv4();

    // Look up person_id by email if not provided
    let finalPersonId: string | null = personId || null;
    if (!finalPersonId && emails.length > 0 && emails[0].to) {
      // Get the first email address from the first email's "to" field
      const firstEmail = Array.isArray(emails[0].to) 
        ? emails[0].to[0] 
        : emails[0].to.split(',')[0].trim();
      
      if (firstEmail) {
        const { data: personData } = await supabase
          .from('people')
          .select('id')
          .eq('email', firstEmail.toLowerCase())
          .maybeSingle();
        
        if (personData?.id) {
          finalPersonId = personData.id;
        }
      }
    }

    // Step IDs for the predefined steps
    const AUTO_EMAIL_STEP_ID = '8e9856d1-9480-46bc-86d9-fa9653128a88'; // Initial email step
    const AUTO_FOLLOW_UP_STEP_ID = '663b6577-8256-419a-8888-f4fab2c16928'; // Follow-up email step

    // Create sequence steps join entries and message templates
    const sequenceStepsJoin = [];
    const messageTemplates = [];
    const delayMinutes = 3 * 24 * 60; // 3 days in minutes

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const stepIndex = i; // Start at 0, 1, 2, etc.
      // First email is immediate (0 delay), all follow-ups are 3 days after the previous step
      const delayMinutesForStep = stepIndex === 0 ? 0 : delayMinutes;

      // Determine which step ID to use based on step index
      const stepId = stepIndex === 0 ? AUTO_EMAIL_STEP_ID : AUTO_FOLLOW_UP_STEP_ID;

      // Process message content - prefer message field, fallback to content
      let messageContent = email.message || email.content || '';
      if (messageContent.includes('{flashySignature}')) {
        messageContent = messageContent.replace('{flashySignature}', generateSignature(userDataFormatted));
      }

      // Transform to Gmail format (this handles HTML properly)
      const gmailFormattedMessage = transformToGmailFormat(messageContent);
      const textContent = formatTextContent(messageContent);
      const emailSubject = email.subject || subject;

      // Create sequence step join entry
      const stepJoinId = uuidv4();
      sequenceStepsJoin.push({
        id: stepJoinId,
        sequence_id: sequenceId,
        step_id: stepId, // Reference to the predefined step
        step_index: stepIndex,
        delay_minutes: delayMinutesForStep,
        is_threaded_reply: stepIndex > 0 // Set to true for all follow-up emails (not the initial email)
      });

      // Create message template entry
      messageTemplates.push({
        step_id: stepJoinId, // Reference to the sequence_steps_join entry
        html: gmailFormattedMessage,
        text: textContent,
        subject: emailSubject
      });

    }

    // Insert all sequence step join entries
    const { error: stepsError } = await supabase
      .from('sequence_steps_join')
      .insert(sequenceStepsJoin);

    if (stepsError) {
      console.error('Error creating sequence steps join:', stepsError);
      return NextResponse.json(
        { error: 'Failed to create sequence steps', details: stepsError.message },
        { status: 500 }
      );
    }

    // Insert all message templates
    const { error: templatesError } = await supabase
      .from('sequence_message_templates')
      .insert(messageTemplates);

    if (templatesError) {
      console.error('Error creating message templates:', templatesError);
      // Don't fail the entire request if templates fail, just log it
      // The sequence and steps are already created, so we can continue
    }

    // Insert person-sequence link if person_id is available
    // The trigger trg_populate_sequence_steps_for_person will automatically create
    // sequence_steps_people_join entries for each step in the sequence
    if (finalPersonId) {
      const { data: sequencePeopleData, error: sequencePeopleError } = await supabase
        .from('sequence_people')
        .insert({
          person_id: finalPersonId,
          sequence_id: sequenceId,
          is_replied: false,
          status: 'active',
          sender_id: userData.id
        })
        .select()
        .single();

      if (sequencePeopleError) {
        console.error('Error creating sequence people link:', sequencePeopleError);
        // Don't fail the entire request if this fails, just log it
      } else if (sequencePeopleData && sequenceStepsJoin.length > 0) {
        // After the trigger creates sequence_steps_people_join entries,
        // we need to update them with the thread/message IDs and sender info
        // Get all the sequence_steps_people_join entries that were just created by the trigger
        const { data: stepsPeopleJoin, error: fetchError } = await supabase
          .from('sequence_steps_people_join')
          .select('id, sequence_step_join_id')
          .eq('sequence_people_id', sequencePeopleData.id)
          .in('sequence_step_join_id', sequenceStepsJoin.map(s => s.id));

        if (fetchError) {
          console.error('Error fetching sequence_steps_people_join entries:', fetchError);
        } else if (stepsPeopleJoin && stepsPeopleJoin.length === sequenceStepsJoin.length) {
          // Create a map of step_join_id to step index for quick lookup
          const stepIndexMap = new Map(
            sequenceStepsJoin.map((step, index) => [step.id, index])
          );

          // Update each entry with the corresponding step's thread/message IDs and sender
          for (const stepPeopleJoin of stepsPeopleJoin) {
            const stepIndex = stepIndexMap.get(stepPeopleJoin.sequence_step_join_id);
            if (stepIndex !== undefined) {
              const wallsMessageId = uuidv4(); // Generate unique message ID for each step
              const { error: updateError } = await supabase
                .from('sequence_steps_people_join')
                .update({
                  x_header_thread_id: wallsThreadId,
                  x_header_message_id: wallsMessageId,
                  sender_id: userData.id,
                  status: stepIndex === 0 ? 'queued' : 'pending'
                })
                .eq('id', stepPeopleJoin.id);

              if (updateError) {
                console.error('Error updating sequence_steps_people_join:', updateError);
              }
            }
          }
        } else {
          console.warn(`Expected ${sequenceStepsJoin.length} sequence_steps_people_join entries, but found ${stepsPeopleJoin?.length || 0}. The trigger may not have run yet.`);
        }
      }
    }

    // Handle selected creators (tagged in pitch tracker) - insert into sequence_talent as talents being pitched
    if (selectedCreators && selectedCreators.length > 0) {
      try {
        // Normalize: accept pitch tracker format { id, name }[] or legacy string[] (creator names)
        const resolveTalentId = async (
          item: { id?: string; name?: string } | string
        ): Promise<string | null> => {
          const hasId = typeof item === 'object' && item != null && 'id' in item && typeof (item as { id?: string }).id === 'string';
          const id = hasId ? (item as { id: string }).id : null;
          const nameOrAlias = typeof item === 'string' ? item : (item as { name?: string }).name ?? '';

          if (id) {
            return id;
          }
          const creatorAlias = typeof nameOrAlias === 'string' ? nameOrAlias.trim() : '';
          if (!creatorAlias) return null;

          // Try to find talent by matching profile name
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('name', creatorAlias)
            .limit(1)
            .maybeSingle();

          if (!profileError && profileData?.id) {
            const { data: talentData, error: talentError } = await supabase
              .from('talent')
              .select('id')
              .eq('profile_id', profileData.id)
              .limit(1)
              .maybeSingle();

            if (!talentError && talentData?.id) return talentData.id;
          }

          const nameParts = creatorAlias.split(' ');
          if (nameParts.length >= 2) {
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            const { data: talentData, error: talentError } = await supabase
              .from('talent')
              .select('id')
              .eq('first_name', firstName)
              .eq('last_name', lastName)
              .limit(1)
              .maybeSingle();
            if (!talentError && talentData?.id) return talentData.id;
          }

          if (creatorAlias.includes('@')) {
            const { data: talentData, error: talentError } = await supabase
              .from('talent')
              .select('id')
              .eq('walls_email', creatorAlias)
              .limit(1)
              .maybeSingle();
            if (!talentError && talentData?.id) return talentData.id;
          }

          return null;
        };

        const talentPromises = selectedCreators.map((item: { id?: string; name?: string } | string) =>
          resolveTalentId(item)
        );
        const resolvedIds = (await Promise.all(talentPromises)).filter((id): id is string => id != null);
        const talentIds = Array.from(new Set(resolvedIds));

        if (talentIds.length > 0) {
          const sequenceTalentInserts = talentIds.map((talentId) => ({
            talent_id: talentId,
            sequence_id: sequenceId,
          }));

          const { error: sequenceTalentError } = await supabase
            .from('sequence_talent')
            .insert(sequenceTalentInserts);

          if (sequenceTalentError) {
            console.error('Error inserting into sequence_talent:', sequenceTalentError);
          }
        }
      } catch (error) {
        console.error('Error processing selected creators:', error);
      }
    }

    return NextResponse.json({ 
      success: true,
      sequenceId: sequenceId,
      sequenceName: sequenceName,
      stepsCreated: sequenceStepsJoin.length,
      templatesCreated: messageTemplates.length
    });
  } catch (error) {
    console.error('Error creating email sequence:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create email sequence' },
      { status: 500 }
    );
  }
}
