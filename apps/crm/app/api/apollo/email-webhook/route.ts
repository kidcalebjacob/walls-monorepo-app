import { NextResponse } from "next/server";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_EMAILS_URL = 'https://api.apollo.io/api/v1/emailer_messages/search';
const APOLLO_PEOPLE_MATCH_ENDPOINT = "https://api.apollo.io/v1/people/match";
const APOLLO_COMPANY_ENRICH_ENDPOINT = "https://api.apollo.io/v1/organizations/enrich";
const APOLLO_SEQUENCES_URL = "https://api.apollo.io/api/v1/emailer_campaigns/search";

// Initialize Firebase Admin if not already
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

async function checkAndEnrichLead(recipientEmail: string, contactId: string, userId: string) {
  if (!recipientEmail) return { status: "error", error: "No recipient email provided" };

  try {
    // Step 1: check if lead already exists in Firestore by email
    const leadsRef = db.collection("leads");
    const q = leadsRef.where("email", "==", recipientEmail);
    const snapshot = await q.get();

    if (!snapshot.empty) {
      console.log(`Lead with email=${recipientEmail} already exists, skipping`);
      return { status: "exists", id: snapshot.docs[0].id };
    }

    // Step 2: call Apollo People Match API with email
    const matchParams = {
      api_key: process.env.APOLLO_API_KEY,
      email: recipientEmail,
      reveal_personal_emails: true,
    };

    const matchResponse = await fetch(APOLLO_PEOPLE_MATCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": process.env.APOLLO_API_KEY!,
      },
      body: JSON.stringify(matchParams),
    });

    if (!matchResponse.ok) {
      const errorText = await matchResponse.text();
      throw new Error(
        `Apollo People Match API error ${matchResponse.status}: ${errorText}`
      );
    }

    const matchData = await matchResponse.json();
    if (!matchData.person) {
      console.log(`No person found for email=${recipientEmail}`);
      return { status: "error", error: "No person found in Apollo response" };
    }

    const person = matchData.person;

    // Step 3: map Apollo data to Firestore schema
    const leadData = {
      firstName: person.first_name || "",
      lastName: person.last_name || "",
      leadName: person.name || "",
      linkedin: person.linkedin_url || "",
      operatingCountries: person.country ? [person.country] : [],
      title: person.title || "",
      email: recipientEmail || person.email || "",
      emailStatus: person.email_status || "",
      photo: person.photo_url || "",
      apolloPersonId: person.id || "", // global Apollo person id
      apolloContactId: contactId || "", // the outreach contact id from emails
      company:
        person.contact?.organization_name ||
        person.organization?.name ||
        "",
      companyDomain: person.organization?.primary_domain || "",
      companyLocation: person.organization?.raw_address || "",
      companySize:
        person.organization?.estimated_num_employees?.toString() || "",
      seniority: person.seniority || "",
      city: person.city || "",
      state: person.state || "",
      updatedAt: FieldValue.serverTimestamp(),
      lastEnriched: FieldValue.serverTimestamp(),
      userId,
      status: "New",
      source: "WALLS App",
      employmentHistory: person.employment_history || [],
      headline: person.headline || "",
      twitterUrl: person.twitter_url || "",
      githubUrl: person.github_url || "",
      facebookUrl: person.facebook_url || "",
      departments: person.departments || [],
      subdepartments: person.subdepartments || [],
      functions: person.functions || [],
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId,
    };

    const newDoc = db.collection("leads").doc();
    await newDoc.set(leadData);
    console.log(`✅ Lead created for email=${recipientEmail}, docId=${newDoc.id}`);
    
    // If lead was created and we have organization domain, enrich company too
    let companyResult = null;
    if (person.organization?.primary_domain) {
      console.log(`Enriching company for domain=${person.organization.primary_domain}`);
      try {
        companyResult = await checkAndEnrichCompany(person.organization.primary_domain, userId);
      } catch (err) {
        console.error("Company enrichment failed:", err);
        companyResult = { status: "error", error: err instanceof Error ? err.message : "Unknown error" };
      }
    } else {
      console.log(`No organization domain found for person ${person.id}`);
    }
    
    return { 
      status: "created", 
      id: newDoc.id,
      companyResult: companyResult
    };
  } catch (error) {
    console.error(`Failed to enrich lead for email=${recipientEmail}:`, error);
    return { status: "error", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function checkAndEnrichCompany(domain: string, userId: string) {
  if (!domain) return { status: "error", error: "No domain provided" };

  try {
    // Step 1: check if company already exists in Firestore
    const companiesRef = db.collection("companies");
    const q = companiesRef.where("domain", "==", domain);
    const snapshot = await q.get();

    if (!snapshot.empty) {
      console.log(`Company with domain=${domain} already exists, skipping`);
      return { status: "exists", id: snapshot.docs[0].id };
    }

    // Step 2: call Apollo Company Enrich API
    const enrichResponse = await fetch(APOLLO_COMPANY_ENRICH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": process.env.APOLLO_API_KEY!,
      },
      body: JSON.stringify({ 
        api_key: process.env.APOLLO_API_KEY,
        domain 
      }),
    });

    if (!enrichResponse.ok) {
      const errorText = await enrichResponse.text();
      throw new Error(
        `Apollo Company Enrich API error ${enrichResponse.status}: ${errorText}`
      );
    }

    const data = await enrichResponse.json();
    const organization = data.organization;
    if (!organization) {
      console.log(`No organization found for domain=${domain}`);
      return { status: "error", error: "No organization found in Apollo response" };
    }

    // Step 3: map Apollo organization data to Firestore schema
    const companyData = {
      keywords: organization.keywords || [],
      foundingYear: organization.founded_year?.toString() || "",
      linkedinUrl: organization.linkedin_url || "",
      website: organization.website_url || "",
      employeeCount: organization.estimated_num_employees?.toString() || "",
      updatedAt: FieldValue.serverTimestamp(),
      lastEnriched: FieldValue.serverTimestamp(),
      apolloOrganizationId: organization.id || "",
      organization_name: organization.name || "",
      twitterUrl: organization.twitter_url || "",
      facebookUrl: organization.facebook_url || "",
      logo: organization.logo_url || "",
      phone: organization.phone || "",
      primary_phone: organization.primary_phone || {},
      address: organization.raw_address || "",
      streetAddress: organization.street_address || "",
      city: organization.city || "",
      state: organization.state || "",
      country: organization.country || "",
      postalCode: organization.postal_code || "",
      annualRevenue: organization.annual_revenue || 0,
      revenueFormatted: organization.annual_revenue_printed || "",
      alexaRanking: organization.alexa_ranking || 0,
      shortDescription: organization.short_description || "",
      seoDescription: organization.seo_description || "",
      domain: organization.primary_domain || domain,
      technologies: organization.technology_names || [],
      current_technologies: organization.current_technologies || [],
      departmentalHeadCount: organization.departmental_head_count || {},
      totalFunding: organization.total_funding || 0,
      totalFundingPrinted: organization.total_funding_printed || "",
      latestFundingStage: organization.latest_funding_stage || "",
      fundingEvents: organization.funding_events || [],
      parentCompanyId: organization.owned_by_organization_id || "",
      suborganizations: organization.suborganizations || [],
      retail_location_count: organization.retail_location_count || 0,
      name: organization.name || "Unnamed Company",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId,
      status: "Prospect",
    };

    const newDoc = companiesRef.doc();
    await newDoc.set(companyData);
    console.log(`✅ Company created for domain=${domain}, docId=${newDoc.id}`);
    return { status: "created", id: newDoc.id };
  } catch (error) {
    console.error(`Failed to enrich company for domain=${domain}:`, error);
    return { status: "error", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getSequenceLabelsByName(campaignName: string): Promise<string[]> {
  try {
    const response = await fetch(APOLLO_SEQUENCES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.APOLLO_API_KEY!,
      },
      body: JSON.stringify({
        q_keywords: campaignName,
        page: 1,
        per_page: 1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo Sequence Search error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.emailer_campaigns || data.emailer_campaigns.length === 0) {
      console.log(`No sequence found for campaign name="${campaignName}"`);
      return [];
    }

    const sequence = data.emailer_campaigns[0];
    return sequence.label_ids || [];
  } catch (err) {
    console.error("Error fetching sequence labels:", err);
    return [];
  }
}

async function getCreatorsFromLabels(labelIds: string[]): Promise<string[]> {
  if (labelIds.length === 0) return [];

  try {
    const creatorsRef = db.collection("users");
    const snapshot = await creatorsRef
      .where("apollo_tag_id", "in", labelIds)
      .get();

    return snapshot.docs.map(doc => doc.data().displayName || doc.data().name || "Unnamed Creator");
  } catch (err) {
    console.error("Error fetching creators from labels:", err);
    return [];
  }
}

function extractCompanyWebsite(email: string): string {
  if (!email || !email.includes('@')) return "";
  const domain = email.split('@')[1];
  return `https://${domain}`;
}

export async function GET(req: Request) {
  // 🔒 Protect with CRON_SECRET
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    console.error("Unauthorized cron attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!APOLLO_API_KEY) {
    console.error('Apollo API key not configured');
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  try {
    console.log('Starting Apollo delivered emails retrieval...');
    console.log('Using Apollo emails endpoint:', APOLLO_EMAILS_URL);
    
    // Build the request body for the emails search - focusing on delivered emails
    const requestBody = {
      api_key: APOLLO_API_KEY,
      page: 1,
      per_page: 100, // Process up to 100 emails per page
      emailer_message_stats: ['delivered'], // Only get delivered emails
      // Add some additional filters to get more comprehensive data
      emailer_message_date_range_mode: 'completed_at', // Filter by when emails were delivered
      // Get emails from the last 30 days
      emailerMessageDateRange: {
        min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
        max: new Date().toISOString().split('T')[0] // Today
      }
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    // Call Apollo.io Emails API with POST request
    const response = await fetch(APOLLO_EMAILS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Apollo Emails API error response:', errorData);
      throw new Error(`Apollo Emails API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    // Log the raw response data to understand the structure
    console.log('=== APOLLO EMAILS API RESPONSE ===');
    console.log('Raw response data:', JSON.stringify(data, null, 2));
    console.log('=== END APOLLO EMAILS API RESPONSE ===');
    
    // Let's also try a second request with different parameters to see if we can get more emails
    console.log('=== TRYING SECOND REQUEST WITH DIFFERENT PARAMETERS ===');
    const requestBody2 = {
      api_key: APOLLO_API_KEY,
      page: 1,
      per_page: 100, // Process up to 100 emails per page
      emailer_message_stats: ['delivered', 'opened', 'clicked'], // Get delivered, opened, and clicked
      // No date range to see if we get more results
    };
    
    try {
      const response2 = await fetch(APOLLO_EMAILS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        },
        body: JSON.stringify(requestBody2)
      });
      
      if (response2.ok) {
        const data2 = await response2.json();
        console.log('Second request response:', JSON.stringify(data2, null, 2));
        
        // Compare the two responses
        const emails1 = data.emailer_messages || data.data?.emailer_messages || data;
        const emails2 = data2.emailer_messages || data2.data?.emailer_messages || data2;
        
        console.log(`First request emails count: ${Array.isArray(emails1) ? emails1.length : 'Not an array'}`);
        console.log(`Second request emails count: ${Array.isArray(emails2) ? emails2.length : 'Not an array'}`);
      }
    } catch (error) {
      console.log('Second request failed:', error);
    }
    console.log('=== END SECOND REQUEST ===');

    // Check if we have emails data
    const emails = data.emailer_messages || data.data?.emailer_messages || data;
    let emailsArray = null;

    if (Array.isArray(emails)) {
      emailsArray = emails;
    } else if (emails && typeof emails === 'object') {
      // If it's an object, try to find an array property
      const possibleArrayKeys = Object.keys(emails).filter(key => 
        Array.isArray(emails[key])
      );
      if (possibleArrayKeys.length > 0) {
        emailsArray = emails[possibleArrayKeys[0]];
        console.log(`Found emails array in key: ${possibleArrayKeys[0]}`);
      }
    }

    if (emailsArray && Array.isArray(emailsArray)) {
      console.log(`Found ${emailsArray.length} Apollo delivered emails`);
      
      // Analyze email data
      const emailStats = {
        total: emailsArray.length,
        byStatus: {},
        byReplyClass: {},
        bySequence: {},
        byUser: {},
        bySubject: {},
        recentEmails: 0,
        oldEmails: 0,
        withReplies: 0,
        withOpens: 0,
        withClicks: 0
      };
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Track enrichment statistics
      let enrichmentStats = {
        totalProcessed: 0,
        alreadyExists: 0,
        newlyEnriched: 0,
        enrichmentErrors: 0,
        companiesProcessed: 0,
        companiesAlreadyExist: 0,
        companiesNewlyEnriched: 0,
        companyEnrichmentErrors: 0,
        pitchesProcessed: 0,
        pitchesTracked: 0,
        pitchErrors: 0
      };

      // Process emails and enrich leads
      for (const email of emailsArray) {
        // Collect statistics
        const status = email.status || 'Unknown';
        const replyClass = email.reply_class || 'none_of_the_above';
        const sequenceId = email.emailer_campaign_id || 'Unknown';
        const userId = email.user_id || 'Unknown';
        const subject = email.subject || 'No Subject';
        
        // Log each email's details to see what we're getting
        console.log(`Email ${email.id}: Status="${status}", ReplyClass="${replyClass}", Subject="${subject.substring(0, 50)}..."`);
        
        // Skip follow-up emails (subjects starting with "Re:")
        if (subject.trim().toLowerCase().startsWith("re:")) {
          console.log(`Skipping follow-up email ${email.id} with subject "${subject}"`);
          // Still collect basic statistics for follow-ups
          emailStats.byStatus[status] = (emailStats.byStatus[status] || 0) + 1;
          emailStats.byReplyClass[replyClass] = (emailStats.byReplyClass[replyClass] || 0) + 1;
          emailStats.bySequence[sequenceId] = (emailStats.bySequence[sequenceId] || 0) + 1;
          emailStats.byUser[userId] = (emailStats.byUser[userId] || 0) + 1;
          emailStats.bySubject[subject] = (emailStats.bySubject[subject] || 0) + 1;
          continue; // Skip enrichment for follow-ups
        }
        
        emailStats.byStatus[status] = (emailStats.byStatus[status] || 0) + 1;
        emailStats.byReplyClass[replyClass] = (emailStats.byReplyClass[replyClass] || 0) + 1;
        emailStats.bySequence[sequenceId] = (emailStats.bySequence[sequenceId] || 0) + 1;
        emailStats.byUser[userId] = (emailStats.byUser[userId] || 0) + 1;
        emailStats.bySubject[subject] = (emailStats.bySubject[subject] || 0) + 1;
        
        // Check if email is recent (within last week)
        if (email.completed_at) {
          const completedDate = new Date(email.completed_at);
          if (completedDate > oneWeekAgo) {
            emailStats.recentEmails++;
          } else {
            emailStats.oldEmails++;
          }
        }
        
        // Check for engagement
        if (email.opened_at) {
          emailStats.withOpens++;
        }
        if (email.clicked_at) {
          emailStats.withClicks++;
        }
        if (replyClass !== 'none_of_the_above') {
          emailStats.withReplies++;
        }

        // Enrich lead if we have recipient email (only for non-follow-up emails)
        const recipientEmail = email.recipients?.[0]?.email || email.recipient_email || null;
        if (recipientEmail) {
          enrichmentStats.totalProcessed++;
          try {
            const leadResult = await checkAndEnrichLead(recipientEmail, email.contact_id || "", userId);
            
            // Update statistics based on explicit return values
            if (leadResult.status === "exists") {
              enrichmentStats.alreadyExists++;
            } else if (leadResult.status === "created") {
              enrichmentStats.newlyEnriched++;
            } else if (leadResult.status === "error") {
              enrichmentStats.enrichmentErrors++;
              console.error("Lead enrichment error:", leadResult.error);
            }

            // Handle company enrichment results (now done inside checkAndEnrichLead)
            if (leadResult.companyResult) {
              enrichmentStats.companiesProcessed++;
              const companyResult = leadResult.companyResult;
              
              // Update company statistics based on explicit return values
              if (companyResult.status === "exists") {
                enrichmentStats.companiesAlreadyExist++;
              } else if (companyResult.status === "created") {
                enrichmentStats.companiesNewlyEnriched++;
              } else if (companyResult.status === "error") {
                enrichmentStats.companyEnrichmentErrors++;
                console.error("Company enrichment error:", companyResult.error);
              }
            }

            // === PITCH TRACKING ===
            if (email.campaign_name) {
              enrichmentStats.pitchesProcessed++;
              try {
                const labelIds = await getSequenceLabelsByName(email.campaign_name);
                const creators = await getCreatorsFromLabels(labelIds);

                if (creators.length > 0) {
                  // Use the email's completed_at timestamp instead of current time
                  const emailTimestamp = email.completed_at ? new Date(email.completed_at) : new Date();
                  
                  const pitchData = {
                    pitchedTo: recipientEmail || "",
                    subject: email.subject || "",
                    emailBody: email.body_text || email.body_html || "",
                    timestamp: emailTimestamp,
                    companyWebsite: recipientEmail
                      ? extractCompanyWebsite(recipientEmail)
                      : "",
                    creators,
                    sentBy: "apollo-webhook",
                    campaignName: email.campaign_name,
                    apolloEmailId: email.id,
                    apolloContactId: email.contact_id || "",
                  };

                  // Use Apollo email ID as document ID to prevent duplicates
                  const pitchRef = db.collection("pitches").doc(email.id);
                  const existing = await pitchRef.get();

                  if (!existing.exists) {
                    await pitchRef.set(pitchData);
                    enrichmentStats.pitchesTracked++;
                    console.log(`✅ Pitch stored under id=${email.id} for campaign "${email.campaign_name}" with creators=${creators.join(", ")}`);
                  } else {
                    console.log(`⚡ Skipping duplicate pitch for email.id=${email.id}`);
                  }
                } else {
                  console.log(`No creators found for campaign "${email.campaign_name}" with label IDs: ${labelIds.join(", ")}`);
                }
              } catch (err) {
                console.error("Failed to track pitch:", err);
                enrichmentStats.pitchErrors++;
              }
            } else {
              console.log(`No campaign name found for email ${email.id}, skipping pitch tracking`);
            }
          } catch (err) {
            console.error("Lead enrichment failed for email:", recipientEmail, err);
            enrichmentStats.enrichmentErrors++;
          }
        } else {
          console.log(`No recipient email found for email ${email.id}, skipping enrichment`);
        }
      }
      
      console.log('=== APOLLO EMAILS ANALYSIS ===');
      console.log(`Total delivered emails: ${emailStats.total}`);
      console.log('Status breakdown:', emailStats.byStatus);
      console.log('Reply class breakdown:', emailStats.byReplyClass);
      console.log('Sequence breakdown:', emailStats.bySequence);
      console.log('User breakdown:', emailStats.byUser);
      console.log(`Recent emails (last 7 days): ${emailStats.recentEmails}`);
      console.log(`Older emails: ${emailStats.oldEmails}`);
      console.log(`Emails with opens: ${emailStats.withOpens}`);
      console.log(`Emails with clicks: ${emailStats.withClicks}`);
      console.log(`Emails with replies: ${emailStats.withReplies}`);
      console.log('=== END APOLLO EMAILS ANALYSIS ===');
      
      console.log('=== LEAD ENRICHMENT ANALYSIS ===');
      console.log(`Total contacts processed: ${enrichmentStats.totalProcessed}`);
      console.log(`Leads already existed: ${enrichmentStats.alreadyExists}`);
      console.log(`New leads enriched: ${enrichmentStats.newlyEnriched}`);
      console.log(`Enrichment errors: ${enrichmentStats.enrichmentErrors}`);
      console.log('=== END LEAD ENRICHMENT ANALYSIS ===');
      
      console.log('=== COMPANY ENRICHMENT ANALYSIS ===');
      console.log(`Total companies processed: ${enrichmentStats.companiesProcessed}`);
      console.log(`Companies already existed: ${enrichmentStats.companiesAlreadyExist}`);
      console.log(`New companies enriched: ${enrichmentStats.companiesNewlyEnriched}`);
      console.log(`Company enrichment errors: ${enrichmentStats.companyEnrichmentErrors}`);
      console.log('=== END COMPANY ENRICHMENT ANALYSIS ===');
      
      console.log('=== PITCH TRACKING ANALYSIS ===');
      console.log(`Total pitches processed: ${enrichmentStats.pitchesProcessed}`);
      console.log(`Pitches successfully tracked: ${enrichmentStats.pitchesTracked}`);
      console.log(`Pitch tracking errors: ${enrichmentStats.pitchErrors}`);
      console.log('=== END PITCH TRACKING ANALYSIS ===');
      
      // Log sample emails for inspection
      console.log('=== SAMPLE APOLLO EMAILS ===');
      emailsArray.slice(0, 5).forEach((email: any, index: number) => {
        console.log(`--- Sample Email ${index + 1} ---`);
        console.log('ID:', email.id);
        console.log('Subject:', email.subject || 'No subject');
        console.log('Status:', email.status || 'No status');
        console.log('Reply Class:', email.reply_class || 'No reply class');
        console.log('Sequence ID:', email.emailer_campaign_id || 'No sequence');
        console.log('User ID:', email.user_id || 'No user');
        console.log('Contact ID:', email.contact_id || 'No contact');
        console.log('Completed At:', email.completed_at);
        console.log('Opened At:', email.opened_at);
        console.log('Clicked At:', email.clicked_at);
        console.log('Sent At:', email.sent_at);
        console.log('Full email data:', JSON.stringify(email, null, 2));
      });
      console.log('=== END SAMPLE APOLLO EMAILS ===');
      
      return NextResponse.json({
        success: true,
        message: 'Apollo delivered emails retrieved and leads enriched successfully',
        timestamp: new Date().toISOString(),
        endpoint: APOLLO_EMAILS_URL,
        emails_count: emailsArray.length,
        emails: emailsArray,
        statistics: emailStats,
        enrichment_statistics: enrichmentStats,
        sample_emails: emailsArray.slice(0, 10),
        data_analysis: {
          total_emails: emailStats.total,
          status_breakdown: emailStats.byStatus,
          reply_class_breakdown: emailStats.byReplyClass,
          sequence_breakdown: emailStats.bySequence,
          user_breakdown: emailStats.byUser,
          recent_emails: emailStats.recentEmails,
          old_emails: emailStats.oldEmails,
          emails_with_opens: emailStats.withOpens,
          emails_with_clicks: emailStats.withClicks,
          emails_with_replies: emailStats.withReplies
        },
        enrichment_analysis: {
          total_contacts_processed: enrichmentStats.totalProcessed,
          leads_already_existed: enrichmentStats.alreadyExists,
          new_leads_enriched: enrichmentStats.newlyEnriched,
          enrichment_errors: enrichmentStats.enrichmentErrors,
          total_companies_processed: enrichmentStats.companiesProcessed,
          companies_already_existed: enrichmentStats.companiesAlreadyExist,
          new_companies_enriched: enrichmentStats.companiesNewlyEnriched,
          company_enrichment_errors: enrichmentStats.companyEnrichmentErrors,
          total_pitches_processed: enrichmentStats.pitchesProcessed,
          pitches_tracked: enrichmentStats.pitchesTracked,
          pitch_tracking_errors: enrichmentStats.pitchErrors
        },
        pagination: data.pagination || null,
        raw_emails_data: data
      });
      
    } else {
      console.log('No emails found or unexpected data structure');
      console.log('Available keys in response:', Object.keys(data));
      console.log('Data type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      
      return NextResponse.json({
        success: true,
        message: 'No Apollo delivered emails found or unexpected data structure',
        timestamp: new Date().toISOString(),
        emails_count: 0,
        emails: [],
        available_keys: Object.keys(data),
        raw_data: data
      });
    }
    
  } catch (error) {
    console.error('Error retrieving Apollo delivered emails:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve Apollo delivered emails',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also support POST for consistency
export async function POST(req: Request) {
  // Reuse the same protection for POST
  return GET(req);
}
