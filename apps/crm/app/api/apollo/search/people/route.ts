import { NextResponse } from "next/server";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = 'https://api.apollo.io/v1/mixed_people/search';
const ITEMS_PER_PAGE = 25; // Apollo's max per page for people search
const MAX_PAGES = 500; // Apollo's max pages for people search
const MAX_RESULTS = 50000; // Apollo's max total results

interface PersonSearchRequestBody {
  page: number;
  per_page: number;
  person_titles?: string[];
  include_similar_titles?: boolean;
  person_locations?: string[];
  person_seniorities?: string[];
  organization_locations?: string[];
  q_organization_domains_list?: string[];
  contact_email_status?: string[];
  organization_ids?: string[];
  organization_num_employees_ranges?: string[];
  q_keywords?: string;
}

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    console.error('Apollo API key not configured');
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    
    // Build Apollo.io API query
    const apolloQuery: any = {
      api_key: APOLLO_API_KEY,
      page: Math.min(body.page || 1, MAX_PAGES),
      per_page: Math.min(body.per_page || ITEMS_PER_PAGE, ITEMS_PER_PAGE)
    };

    // Add search parameters if provided
    if (body.person_titles?.length) {
      apolloQuery.person_titles = body.person_titles;
    }

    if (typeof body.include_similar_titles === 'boolean') {
      apolloQuery.include_similar_titles = body.include_similar_titles;
    }

    if (body.person_locations?.length) {
      apolloQuery.person_locations = body.person_locations;
    }

    if (body.person_seniorities?.length) {
      apolloQuery.person_seniorities = body.person_seniorities;
    }

    if (body.organization_locations?.length) {
      apolloQuery.organization_locations = body.organization_locations;
    }

    if (body.q_organization_domains_list?.length) {
      apolloQuery.q_organization_domains_list = body.q_organization_domains_list;
    }

    if (body.contact_email_status?.length) {
      apolloQuery.contact_email_status = body.contact_email_status;
    }

    if (body.organization_ids?.length) {
      apolloQuery.organization_ids = body.organization_ids;
    }

    if (body.organization_num_employees_ranges?.length) {
      apolloQuery.organization_num_employees_ranges = body.organization_num_employees_ranges;
    }

    if (body.q_keywords) {
      apolloQuery.q_keywords = body.q_keywords;
    }

    // Call Apollo.io API
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
      console.error('Apollo API error response:', errorData);
      throw new Error(`Apollo API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    if (!data.people || !Array.isArray(data.people)) {
      return NextResponse.json({
        leads: [],
        total: 0,
        total_pages: 1
      });
    }

    // Transform Apollo.io response to match our Lead interface
    const leads = data.people.map((person: any) => ({
      id: person.id || '',
      firstName: person.first_name || '',
      lastName: person.last_name || '',
      email: person.email || '',
      phone: '', // We don't fetch phone numbers
      title: person.title || '',
      seniority: person.seniority || '',
      location: person.city && person.state ? `${person.city}, ${person.state}` : person.city || person.state || '',
      companyName: person.organization?.name || '',
      companyDomain: person.organization?.primary_domain || '',
      companyLocation: person.organization?.raw_address || '',
      companySize: person.organization?.estimated_num_employees?.toString() || '',
      emailStatus: person.email_status || '',
      linkedinUrl: person.linkedin_url || '',
      photo: person.photo_url || '',
      organization: {
        name: person.organization?.name || '',
        website_url: person.organization?.website_url || '',
        linkedin_url: person.organization?.linkedin_url || '',
        primary_phone: person.organization?.primary_phone || null,
        logo_url: person.organization?.logo_url || ''
      }
    }));

    // Get pagination info from Apollo's response, same as company search
    const total = Math.min(data.pagination?.total_entries || 0, MAX_RESULTS);
    const totalPages = Math.min(
      Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)),
      MAX_PAGES
    );

    // Return all leads we got from Apollo (up to 100 per page)
    return NextResponse.json({
      leads,
      total,
      total_pages: totalPages,
      pagination_info: data.pagination
    });

  } catch (error) {
    console.error('Error in lead search:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch leads',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 