import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = 'https://api.apollo.io/v1/mixed_companies/search';
const ITEMS_PER_PAGE = 25;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    
    // Build Apollo.io API query
    const apolloQuery: any = {
      page: body.page || 1,
      per_page: ITEMS_PER_PAGE,
      api_key: APOLLO_API_KEY
    };

    // Copy over the filters directly since they're already in the correct format
    if (body.filters) {
      // Handle employee ranges
      if (body.filters.organization_num_employees_ranges) {
        apolloQuery.organization_num_employees_ranges = body.filters.organization_num_employees_ranges;
      }

      // Handle locations
      if (body.filters.organization_locations) {
        apolloQuery.organization_locations = body.filters.organization_locations;
      }

      // Handle keyword tags (industry)
      if (body.filters.q_organization_keyword_tags) {
        apolloQuery.q_organization_keyword_tags = body.filters.q_organization_keyword_tags;
      }

      // Handle company name
      if (body.filters.q_organization_name) {
        apolloQuery.q_organization_name = body.filters.q_organization_name;
      }

      // Handle revenue range
      if (body.filters.revenue_range) {
        apolloQuery.revenue_range = body.filters.revenue_range;
      }
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
      throw new Error(`Apollo API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    if (!data.organizations || !Array.isArray(data.organizations)) {
      return NextResponse.json({
        companies: [],
        total: 0,
        total_pages: 1
      });
    }

    // Extract all Apollo organization IDs from the response
    const apolloOrgIds = data.organizations
      .map((org: any) => org.id || org.organization_id)
      .filter((id: any) => id != null);

    // Check which companies already exist in Supabase by apollo_organization_id
    let existingCompanyIds: Set<string> = new Set();
    let companyLastEnrichedMap: Map<string, string> = new Map();
    if (apolloOrgIds.length > 0) {
      const { data: existingCompanies, error: supabaseError } = await supabase
        .from('companies')
        .select('apollo_organization_id, last_enriched')
        .in('apollo_organization_id', apolloOrgIds);

      if (!supabaseError && existingCompanies) {
        existingCompanies.forEach((c: any) => {
          if (c.apollo_organization_id) {
            existingCompanyIds.add(c.apollo_organization_id);
            if (c.last_enriched) {
              companyLastEnrichedMap.set(c.apollo_organization_id, c.last_enriched);
            }
          }
        });
      }
    }

    // Transform Apollo.io response to match our Company interface
    const companies = data.organizations.map((org: any) => {
      const apolloOrgId = org.id || org.organization_id;
      // Format revenue to a number
      const revenue = org.organization_revenue || 0;
      
      // Get the formatted address components
      const city = org.organization_city || org.city || '';
      const state = org.organization_state || org.state || '';
      const country = org.organization_country || org.country || '';
      
      // Get sanitized phone number
      const phone = org.sanitized_phone || org.phone || '';

      const existsInDatabase = apolloOrgId ? existingCompanyIds.has(apolloOrgId) : false;
      const lastEnriched = apolloOrgId ? companyLastEnrichedMap.get(apolloOrgId) || null : null;

      return {
        id: apolloOrgId,
        name: org.name || 'Unnamed Company',
        industry: org.industry || 'Technology',
        website: org.website_url || org.primary_domain || '',
        linkedinUrl: org.linkedin_url || '',
        phone,
        city,
        state,
        country,
        employeeCount: org.organization_num_employees?.toString() || '0',
        annualRevenue: revenue,
        foundingYear: org.founded_year?.toString() || '',
        address: org.organization_street_address || org.street_address || '',
        postalCode: org.organization_postal_code || org.postal_code || '',
        logo: org.logo_url || '',
        revenueFormatted: org.organization_revenue_printed || '',
        twitterUrl: org.twitter_url || '',
        facebookUrl: org.facebook_url || '',
        domain: org.domain || org.primary_domain || '',
        alexaRanking: org.alexa_ranking || 0,
        headcountGrowth: {
          sixMonth: org.organization_headcount_six_month_growth || 0,
          twelveMonth: org.organization_headcount_twelve_month_growth || 0,
          twentyFourMonth: org.organization_headcount_twenty_four_month_growth || 0
        },
        apolloOrganizationId: apolloOrgId,
        existsInDatabase: existsInDatabase,
        last_enriched: lastEnriched
      };
    });

    // Get pagination info from Apollo's response
    const total = data.pagination?.total_entries || 0;
    const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

    // Return all companies we got from Apollo (up to 100)
    return NextResponse.json({
      companies,
      total,
      total_pages: totalPages,
      pagination_info: data.pagination
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch companies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 