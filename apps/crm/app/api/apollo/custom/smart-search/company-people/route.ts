/**
 * Smart search for finding the best contacts at a company for securing paid partnerships with creators/influencers.
 * Returns ALL contacts with top candidates marked.
 * 
 * As seen in workflows:
 * ~ view-agent-companies.tsx
 */
import { NextResponse } from "next/server";
import OpenAI from 'openai';
import { createClient } from "@/lib/supabase/server";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = 'https://api.apollo.io/api/v1/mixed_people/api_search';
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
    const {
      apollo_organization_id,
      search_all,
      country,
      custom_title,
      seniorities,
      email_statuses,
    } = body;

    const DEFAULT_EMAIL_STATUSES = ["verified", "likely", "unverified"];
    const resolvedEmailStatuses: string[] =
      Array.isArray(email_statuses) && email_statuses.length > 0
        ? email_statuses
        : DEFAULT_EMAIL_STATUSES;
    const resolvedSeniorities: string[] = Array.isArray(seniorities) ? seniorities : [];

    console.log('[smart-search-company-people] Request received:', {
      apollo_organization_id,
      search_all,
      country,
      custom_title,
      seniorities: resolvedSeniorities,
      email_statuses: resolvedEmailStatuses,
    });

    if (!apollo_organization_id) {
      console.log('[smart-search-company-people] Missing apollo_organization_id');
      return NextResponse.json(
        { error: 'Apollo organization ID is required' },
        { status: 400 }
      );
    }

    // First, try searching with "Influencer marketing" title
    let leads: any[] = [];
    let searchTitle = "Influencer marketing";

    const searchAllPeople = async () => {
      const apolloQuery: Record<string, unknown> = {
        organization_ids: [apollo_organization_id],
        page: 1,
        per_page: 50,
        contact_email_status: resolvedEmailStatuses,
      };
      if (country) {
        apolloQuery.person_locations = [country];
      }
      if (resolvedSeniorities.length > 0) {
        apolloQuery.person_seniorities = resolvedSeniorities;
      }

      console.log(`[smart-search-company-people] Searching Apollo for all people (no title filter)`, { apolloQuery });

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
        console.error(`[smart-search-company-people] Apollo API error for all people search:`, { status: response.status, error: errorData });
        throw new Error(`Apollo API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const people =
        data?.people ||
        data?.contacts ||
        data?.results ||
        data?.data?.people ||
        [];
      console.log(`[smart-search-company-people] Apollo search for all people returned ${people.length} people`, {
        total: data?.pagination?.total_entries || data?.pagination?.total || 0,
        people: people.map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, title: p.title, email_status: p.email_status }))
      });
      return people;
    };

    const searchWithTitle = async (title: string) => {
      const apolloQuery: Record<string, unknown> = {
        organization_ids: [apollo_organization_id],
        person_titles: [title],
        include_similar_titles: true,
        page: 1,
        per_page: 25,
        contact_email_status: resolvedEmailStatuses,
      };
      if (country) {
        apolloQuery.person_locations = [country];
      }
      if (resolvedSeniorities.length > 0) {
        apolloQuery.person_seniorities = resolvedSeniorities;
      }

      console.log(`[smart-search-company-people] Searching Apollo with title: "${title}"`, { apolloQuery });

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
        console.error(`[smart-search-company-people] Apollo API error for title "${title}":`, { status: response.status, error: errorData });
        throw new Error(`Apollo API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const people =
        data?.people ||
        data?.contacts ||
        data?.results ||
        data?.data?.people ||
        [];
      console.log(`[smart-search-company-people] Apollo search for "${title}" returned ${people.length} people`, {
        total: data?.pagination?.total_entries || data?.pagination?.total || 0,
        people: people.map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, title: p.title, email_status: p.email_status }))
      });
      return people;
    };

    // If search_all is true, search all people at the company without title filtering
    if (search_all) {
      console.log('[smart-search-company-people] Searching all people at company (no title filter)');
      leads = await searchAllPeople();
      searchTitle = "All contacts";
    } else if (custom_title) {
      // Use caller-supplied title override
      console.log(`[smart-search-company-people] Searching with custom title: "${custom_title}"`);
      leads = await searchWithTitle(custom_title);
      searchTitle = custom_title;
    } else {
      // Default: try "Influencer marketing" first
      leads = await searchWithTitle("Influencer marketing");
      console.log(`[smart-search-company-people] Initial "Influencer marketing" search: ${leads.length} leads`);

      // If we have less than 3 contacts, also search "Marketing" to fill up
      if (leads.length < 3) {
        console.log(`[smart-search-company-people] Less than 3 leads (${leads.length}), searching "Marketing" as well`);
        const marketingLeads = await searchWithTitle("Marketing");

        // Combine leads, avoiding duplicates by Apollo person ID
        const existingIds = new Set(leads.map((lead: any) => lead.id));
        const uniqueMarketingLeads = marketingLeads.filter((lead: any) => !existingIds.has(lead.id));

        console.log(`[smart-search-company-people] Marketing search: ${marketingLeads.length} total, ${uniqueMarketingLeads.length} unique after deduplication`);

        leads = [...leads, ...uniqueMarketingLeads];

        // Update search title to reflect both searches if we got results from both
        if (leads.length > 0 && uniqueMarketingLeads.length > 0) {
          searchTitle = "Influencer marketing & Marketing";
        } else if (leads.length === 0 && uniqueMarketingLeads.length > 0) {
          searchTitle = "Marketing";
        }
      }
    }
    
    console.log(`[smart-search-company-people] Total Apollo leads after all searches: ${leads.length}`);

    // Also search internal database for people with matching apollo_organization_id
    const supabase = await createClient();
    let internalPeople: any[] = [];
    const internalByApolloPersonId = new Map<string, any>();

    try {
      // First, find the company by apollo_organization_id to get its ID
      const { data: company, error: companyError } = await supabase
                    .from('companies')
                    .select('id')
        .eq('apollo_organization_id', apollo_organization_id)
                    .maybeSingle();

      if (companyError) {
        console.error('[smart-search-company-people] Error fetching company:', companyError);
                  } else {
        console.log(`[smart-search-company-people] Company lookup:`, { found: !!company, companyId: company?.id });

        // Build a filtered query that mirrors the Apollo filters (title, country, seniorities).
        // This way the internal-database fallback respects the user's selected filters.
        const buildFilteredQuery = (
          column: 'apollo_organization_id' | 'company_id',
          value: string
        ) => {
          let query = supabase
            .from('people')
            .select('*')
            .eq(column, value)
            .not('email', 'is', null);

          if (search_all) {
            // No title filter
          } else if (custom_title) {
            // Match the user-supplied title
            query = query.ilike('title', `%${custom_title}%`);
          } else {
            // Default: marketing-related titles
            query = query.or(
              'title.ilike.%influencer marketing%,title.ilike.%marketing%'
            );
          }

          if (country) {
            // Exact, case-insensitive country match
            query = query.ilike('country', country);
          }

          if (resolvedSeniorities.length > 0) {
            query = query.in('seniority', resolvedSeniorities);
          }

          return query;
        };

        const queries: Array<ReturnType<typeof buildFilteredQuery>> = [];
        queries.push(buildFilteredQuery('apollo_organization_id', apollo_organization_id));
        if (company?.id) {
          queries.push(buildFilteredQuery('company_id', company.id));
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
          // Build a fast lookup so we can tag Apollo results as internal.
          // With the new Apollo mixed_people/api_search endpoint, emails may not be returned,
          // but the Apollo person `id` is stable and matches our `people.apollo_person_id`.
          for (const person of peopleData) {
            if (person.apollo_person_id) {
              internalByApolloPersonId.set(person.apollo_person_id, person);
            }
          }

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
            country: person.country || null,
            is_internal: true, // Flag to identify internal contacts
            internal_id: person.id // Keep reference to internal ID
          }));

          console.log(`[smart-search-company-people] Found ${internalPeople.length} internal people matching the organization`);
                      } else {
          console.log(`[smart-search-company-people] No internal people found in database`);
        }
      }
    } catch (error) {
      console.error('Error searching internal database:', error);
    }

    // Tag Apollo leads that already exist in our DB.
    // Previously we could sometimes match by email, but the new endpoint often omits it.
    // Matching by Apollo person id (lead.id) is the reliable path.
    if (internalByApolloPersonId.size > 0 && leads.length > 0) {
      leads = leads.map((lead: any) => {
        const match = lead?.id ? internalByApolloPersonId.get(lead.id) : null;
        if (!match) return lead;

        return {
          ...lead,
          is_internal: true,
          internal_id: match.id,
          // Prefer our DB fields when Apollo omits them
          email: lead.email || match.email || '',
          first_name: lead.first_name || match.first_name || '',
          last_name: lead.last_name || match.last_name || '',
          title: lead.title || match.title || '',
          seniority: lead.seniority || match.seniority || '',
          linkedin_url: lead.linkedin_url || match.linkedin_url || '',
          photo_url: lead.photo_url || match.photo_url || '',
          country: lead.country || match.country || null,
        };
      });
    }

    // Combine Apollo leads with internal people, avoiding duplicates
    console.log(`[smart-search-company-people] Before combining: ${leads.length} Apollo leads, ${internalPeople.length} internal people`);
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
        console.log(`[smart-search-company-people] Adding ${uniqueInternalPeople.length} unique internal contacts to results`);
        leads = [...leads, ...uniqueInternalPeople];
                    } else {
        console.log(`[smart-search-company-people] All internal people were duplicates of Apollo results`);
      }
    }
    console.log(`[smart-search-company-people] After combining: ${leads.length} total leads`);

    // Filter contacts by user-selected email statuses.
    // Normalize Apollo's "likely_to_engage" / "likely to engage" to "likely" to match our toggle keys.
    const normalizeEmailStatus = (raw: string | null | undefined): string => {
      const lower = (raw || '').toLowerCase().trim();
      if (!lower) return '';
      if (lower.includes('likely')) return 'likely';
      if (lower.includes('unverified')) return 'unverified';
      if (lower.includes('unavailable')) return 'unavailable';
      if (lower.includes('verified')) return 'verified';
      return lower;
    };

    const allowedStatuses = new Set(
      resolvedEmailStatuses.map((s) => s.toLowerCase())
    );

    const availableLeads = leads.filter((person: any) => {
      const status = normalizeEmailStatus(person.email_status);
      // Lead with no status: keep only if user accepts "verified" (default behavior pre-change).
      if (!status) return allowedStatuses.has('verified');
      return allowedStatuses.has(status);
    });

    console.log(`[smart-search-company-people] After filtering email statuses: ${availableLeads.length} kept out of ${leads.length} total`, {
      droppedCount: leads.length - availableLeads.length,
      allowedStatuses: Array.from(allowedStatuses),
      emailStatuses: leads.reduce((acc: any, p: any) => {
        const status = (p.email_status || 'unknown').toLowerCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    });

    if (availableLeads.length === 0) {
      console.log(`[smart-search-company-people] No contacts matching email status filters. Returning early.`);
      return NextResponse.json({
        success: false,
        contact: null,
        message: 'No contacts matching the selected email status filters were found for this organization'
      });
    }

    // Transform available leads to a simpler format for AI
    const contactsForAI = availableLeads.map((person: any) => ({
      id: person.id || '',
      firstName: person.first_name || '',
      lastName: person.last_name || person.last_name_obfuscated || '',
      email: person.email || '',
      title: person.title || '',
      seniority: person.seniority || '',
      emailStatus: person.email_status || '',
      linkedinUrl: person.linkedin_url || '',
      photo: person.photo_url || '',
      country: person.country || null,
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

    console.log(`[smart-search-company-people] AI ranking response:`, { 
      rankedIndices, 
      contactsForAI: contactsForAI.length,
      aiResponse 
    });

    // Create a set of top candidate indices for quick lookup
    const topCandidateIndices = new Set(rankedIndices.slice(0, Math.min(3, contactsForAI.length)));

    // Return ALL contacts with isTopCandidate flag
    const allContacts = await Promise.all(contactsForAI.map(async (contact, index) => {
      // If contact is internal, fetch additional data from database
      let phone = '';
      let lastContacted = null;
      let lastEnriched = null;
      let country = contact.country || null;
      if (contact.is_internal && contact.internal_id) {
        try {
          const { data: personData } = await supabase
          .from('people')
            .select('phone, last_contacted, last_enriched, country')
            .eq('id', contact.internal_id)
            .maybeSingle();
          
          if (personData) {
            phone = personData.phone || '';
            lastContacted = personData.last_contacted || null;
            lastEnriched = personData.last_enriched || null;
            country = personData.country || contact.country || null;
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
        country: country,
        seniority: contact.seniority,
        emailStatus: contact.emailStatus,
        linkedinUrl: contact.linkedinUrl,
        photo: contact.photo,
        phone: phone,
        lastContacted: lastContacted,
        lastEnriched: lastEnriched,
        is_internal: contact.is_internal || false,
        internal_id: contact.internal_id || null,
        isTopCandidate: topCandidateIndices.has(index) // Mark top candidates
      };
    }));

    console.log(`[smart-search-company-people] Final result:`, {
      totalContacts: allContacts.length,
      topCandidates: allContacts.filter(c => c.isTopCandidate).length,
      searchTitle,
      totalContactsFound: leads.length,
      availableLeadsCount: availableLeads.length
    });

      return NextResponse.json({
        success: true,
      contacts: allContacts,
      searchTitle,
      totalContactsFound: leads.length
      });

    } catch (error) {
    console.error('[smart-search-company-people] Error finding best contact:', error);
    console.error('[smart-search-company-people] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to find best contact',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    }
  }
