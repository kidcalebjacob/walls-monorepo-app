/**
 * Smart search for finding the best contacts at a company for securing paid partnerships with creators/influencers.
 * at a company for securing paid partnerships with creators/influencers.
 * 
 * As seen in workflows:
 * ~ view-agent-companies.tsx
 */
import { NextResponse } from "next/server";
import OpenAI from 'openai';
import { createClient } from "@/lib/supabase/server";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = 'https://api.apollo.io/v1/mixed_people/search';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = OPENAI_API_KEY ? new OpenAI({
  apiKey: OPENAI_API_KEY,
}) : null;

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  if (!openai) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { apollo_organization_id, search_all } = body;

    console.log('[people-smart-search] Request received:', { apollo_organization_id, search_all });

    if (!apollo_organization_id) {
      console.log('[people-smart-search] Missing apollo_organization_id');
      return NextResponse.json(
        { error: 'Apollo organization ID is required' },
        { status: 400 }
      );
    }

    // First, try searching with "Influencer marketing" title
    let leads: any[] = [];
    let searchTitle = "Influencer marketing";

    const searchAllPeople = async () => {
      const apolloQuery = {
        api_key: APOLLO_API_KEY,
        organization_ids: [apollo_organization_id],
        page: 1,
        per_page: 50, // Get more results when searching all
        contact_email_status: ["verified", "likely", "unverified"]
      };

      console.log(`[people-smart-search] Searching Apollo for all people (no title filter)`, { apolloQuery: { ...apolloQuery, api_key: '[REDACTED]' } });

      const response = await fetch(APOLLO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        },
        body: JSON.stringify(apolloQuery)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[people-smart-search] Apollo API error for all people search:`, { status: response.status, error: errorData });
        throw new Error(`Apollo API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const people = data.people || [];
      console.log(`[people-smart-search] Apollo search for all people returned ${people.length} people`, {
        total: data.pagination?.total_entries || 0,
        people: people.map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, title: p.title, email_status: p.email_status }))
      });
      return people;
    };

    const searchWithTitle = async (title: string) => {
      const apolloQuery = {
        api_key: APOLLO_API_KEY,
        organization_ids: [apollo_organization_id],
        person_titles: [title],
        include_similar_titles: true,
        page: 1,
        per_page: 25,
        contact_email_status: ["verified", "likely", "unverified"]
      };

      console.log(`[people-smart-search] Searching Apollo with title: "${title}"`, { apolloQuery: { ...apolloQuery, api_key: '[REDACTED]' } });

      const response = await fetch(APOLLO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        },
        body: JSON.stringify(apolloQuery)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[people-smart-search] Apollo API error for title "${title}":`, { status: response.status, error: errorData });
        throw new Error(`Apollo API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const people = data.people || [];
      console.log(`[people-smart-search] Apollo search for "${title}" returned ${people.length} people`, {
        total: data.pagination?.total_entries || 0,
        people: people.map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, title: p.title, email_status: p.email_status }))
      });
      return people;
    };

    // If search_all is true, search all people at the company without title filtering
    if (search_all) {
      console.log('[people-smart-search] Searching all people at company (no title filter)');
      leads = await searchAllPeople();
      searchTitle = "All contacts";
    } else {
      // Try "Influencer marketing" first
      leads = await searchWithTitle("Influencer marketing");
      console.log(`[people-smart-search] Initial "Influencer marketing" search: ${leads.length} leads`);

      // If we have less than 3 contacts, also search "Marketing" to fill up
      if (leads.length < 3) {
        console.log(`[people-smart-search] Less than 3 leads (${leads.length}), searching "Marketing" as well`);
        const marketingLeads = await searchWithTitle("Marketing");
        
        // Combine leads, avoiding duplicates by Apollo person ID
        const existingIds = new Set(leads.map((lead: any) => lead.id));
        const uniqueMarketingLeads = marketingLeads.filter((lead: any) => !existingIds.has(lead.id));
        
        console.log(`[people-smart-search] Marketing search: ${marketingLeads.length} total, ${uniqueMarketingLeads.length} unique after deduplication`);
        
        leads = [...leads, ...uniqueMarketingLeads];
        
        // Update search title to reflect both searches if we got results from both
        if (leads.length > 0 && uniqueMarketingLeads.length > 0) {
          searchTitle = "Influencer marketing & Marketing";
        } else if (leads.length === 0 && uniqueMarketingLeads.length > 0) {
          searchTitle = "Marketing";
        }
      }
    }
    
    console.log(`[people-smart-search] Total Apollo leads after all searches: ${leads.length}`);

    // Also search internal database for people with matching apollo_organization_id
    const supabase = await createClient();
    let internalPeople: any[] = [];

    try {
      // First, find the company by apollo_organization_id to get its ID
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('apollo_organization_id', apollo_organization_id)
        .maybeSingle();

      if (companyError) {
        console.error('[people-smart-search] Error fetching company:', companyError);
      } else {
        console.log(`[people-smart-search] Company lookup:`, { found: !!company, companyId: company?.id });
        const queries = [];
        if (search_all) {
          // Search all people without title filter
          queries.push(
            supabase
              .from('people')
              .select('*')
              .eq('apollo_organization_id', apollo_organization_id)
              .not('email', 'is', null)
          );
          if (company?.id) {
            queries.push(
              supabase
                .from('people')
                .select('*')
                .eq('company_id', company.id)
                .not('email', 'is', null)
            );
          }
        } else {
          // Search only marketing-related titles
          queries.push(
            supabase
              .from('people')
              .select('*')
              .eq('apollo_organization_id', apollo_organization_id)
              .not('email', 'is', null)
              .or('title.ilike.%influencer marketing%,title.ilike.%marketing%')
          );
          if (company?.id) {
            queries.push(
              supabase
                .from('people')
                .select('*')
                .eq('company_id', company.id)
                .not('email', 'is', null)
                .or('title.ilike.%influencer marketing%,title.ilike.%marketing%')
            );
          }
        }
        
        // Execute all queries and combine results
        const results = await Promise.all(queries);
        const allPeople: any[] = [];
        const seenIds = new Set<string>();
        
        for (const result of results) {
          if (result.error) {
            console.error('Error fetching internal people:', result.error);
            continue;
          }
          
          if (result.data) {
            // Deduplicate by internal ID
            for (const person of result.data) {
              if (!seenIds.has(person.id)) {
                seenIds.add(person.id);
                allPeople.push(person);
              }
            }
          }
        }
        
        const peopleData = allPeople;

        if (peopleData && peopleData.length > 0) {
          // Transform internal people to match Apollo format
          internalPeople = peopleData.map((person: any) => ({
            id: person.apollo_person_id || `internal_${person.id}`, // Use apollo_person_id if available, otherwise create internal ID
            first_name: person.first_name || '',
            last_name: person.last_name || '',
            email: person.email || '',
            title: person.title || '',
            seniority: person.seniority || '',
            email_status: person.email ? 'verified' : 'unavailable', // Assume verified if email exists
            linkedin_url: person.linkedin_url || '',
            photo_url: person.photo_url || '',
            is_internal: true, // Flag to identify internal contacts
            internal_id: person.id // Keep reference to internal ID
          }));

          console.log(`[people-smart-search] Found ${internalPeople.length} internal people matching the organization`);
        } else {
          console.log(`[people-smart-search] No internal people found in database`);
        }
      }
    } catch (error) {
      console.error('Error searching internal database:', error);
    }

    // Combine Apollo leads with internal people, avoiding duplicates
    console.log(`[people-smart-search] Before combining: ${leads.length} Apollo leads, ${internalPeople.length} internal people`);
    if (internalPeople.length > 0) {
      const apolloPersonIds = new Set(leads.map((lead: any) => lead.id));
      const apolloEmails = new Set(leads.map((lead: any) => lead.email?.toLowerCase()).filter(Boolean));
      
      // Filter out internal people that already exist in Apollo results
      const uniqueInternalPeople = internalPeople.filter((person: any) => {
        // Skip if apollo_person_id matches an Apollo result
        if (person.id && apolloPersonIds.has(person.id)) {
          return false;
        }
        // Skip if email matches an Apollo result
        if (person.email && apolloEmails.has(person.email.toLowerCase())) {
          return false;
        }
        return true;
      });

      if (uniqueInternalPeople.length > 0) {
        console.log(`[people-smart-search] Adding ${uniqueInternalPeople.length} unique internal contacts to results`);
        leads = [...leads, ...uniqueInternalPeople];
      } else {
        console.log(`[people-smart-search] All internal people were duplicates of Apollo results`);
      }
    }
    console.log(`[people-smart-search] After combining: ${leads.length} total leads`);

    // Filter out contacts with "unavailable" email status before checking length
    const availableLeads = leads.filter((person: any) => {
      const emailStatus = person.email_status || '';
      return emailStatus.toLowerCase() !== 'unavailable';
    });

    console.log(`[people-smart-search] After filtering unavailable emails: ${availableLeads.length} available out of ${leads.length} total`, {
      unavailableCount: leads.length - availableLeads.length,
      emailStatuses: leads.reduce((acc: any, p: any) => {
        const status = (p.email_status || 'unknown').toLowerCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    });

    if (availableLeads.length === 0) {
      console.log(`[people-smart-search] No contacts with available emails found. Returning early.`);
      return NextResponse.json({
        success: false,
        contact: null,
        message: 'No contacts with available emails found for this organization'
      });
    }

    // Transform available leads to a simpler format for AI
    const contactsForAI = availableLeads.map((person: any) => ({
      id: person.id || '',
      firstName: person.first_name || '',
      lastName: person.last_name || '',
      email: person.email || '',
      title: person.title || '',
      seniority: person.seniority || '',
      emailStatus: person.email_status || '',
      linkedinUrl: person.linkedin_url || '',
      photo: person.photo_url || '',
      is_internal: person.is_internal || false, // Preserve internal flag
      internal_id: person.internal_id || null // Preserve internal ID
    }));

    // Use AI to rank top 3 contacts
    const aiPrompt = `You are helping a talent management agency find the best contacts at a company for securing paid partnerships with creators/influencers.

Given the following contacts from Apollo.io, rank the TOP 3 contacts who would be most likely to:
1. Make decisions about influencer/creator partnerships
2. Have budget authority for paid partnerships
3. Be the right person to pitch creator collaborations to

Consider:
- Title relevance (Director, Head, VP, Manager of Marketing/Partnerships/Brand are ideal)
- Seniority level (higher is generally better, but not always)
- Email verification status (verified is preferred)
- Title keywords that suggest partnership/brand/marketing responsibility

Return ONLY a JSON object with this exact format:
{
  "rankedIndices": [0, 1, 2]
}

IMPORTANT: 
- rankedIndices is an array of array indices (0-based) from the Contacts array below, in order from best to third best.
- Only return up to 3 contacts, or fewer if there are less than 3 available.

Contacts (with index numbers for reference):
${contactsForAI.map((contact, index) => `[${index}] ${contact.firstName} ${contact.lastName} - ${contact.title} (${contact.seniority || 'N/A'}, email: ${contact.emailStatus || 'N/A'})`).join('\n')}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at identifying the best business contacts for partnership opportunities. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: aiPrompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
    const rankedIndices = aiResponse.rankedIndices || [0];

    console.log(`[people-smart-search] AI ranking response:`, { 
      rankedIndices, 
      contactsForAI: contactsForAI.length,
      aiResponse 
    });

    // Get top 3 contacts (or fewer if less available)
    const topContacts = await Promise.all(rankedIndices.slice(0, Math.min(3, contactsForAI.length)).map(async (originalIndex: number) => {
      const contact = contactsForAI[originalIndex];
      if (!contact) return null;
      
      // If contact is internal, fetch additional data from database
      let phone = '';
      let lastContacted = null;
      if (contact.is_internal && contact.internal_id) {
        try {
          const { data: personData } = await supabase
            .from('people')
            .select('phone, last_contacted')
            .eq('id', contact.internal_id)
            .maybeSingle();
          
          if (personData) {
            phone = personData.phone || '';
            lastContacted = personData.last_contacted || null;
          }
        } catch (error) {
          console.error('Error fetching internal person data:', error);
        }
      }
      
      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        title: contact.title,
        seniority: contact.seniority,
        emailStatus: contact.emailStatus,
        linkedinUrl: contact.linkedinUrl,
        photo: contact.photo,
        phone: phone,
        lastContacted: lastContacted,
        is_internal: contact.is_internal || false,
        internal_id: contact.internal_id || null
      };
    }));

    const filteredContacts = topContacts.filter(Boolean);

    console.log(`[people-smart-search] Final result:`, {
      filteredContactsCount: filteredContacts.length,
      topContactsCount: topContacts.length,
      searchTitle,
      totalContactsFound: leads.length,
      availableLeadsCount: availableLeads.length
    });

    return NextResponse.json({
      success: true,
      contacts: filteredContacts,
      searchTitle,
      totalContactsFound: leads.length
    });

  } catch (error) {
    console.error('[people-smart-search] Error finding best contact:', error);
    console.error('[people-smart-search] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to find best contact',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

