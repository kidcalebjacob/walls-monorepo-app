/**
 * Apollo Account ID to Supabase Sync Route
 * 
 * PURPOSE:
 * This endpoint syncs account data from Apollo.io to Supabase. It is a ONE-WAY sync:
 * Apollo → Supabase (read from Apollo, write to Supabase).
 * 
 * REQUIREMENTS:
 * - REQUIRES an Apollo account ID in the request body
 * - Uses Apollo's "View an Account" endpoint (GET /api/v1/accounts/{id})
 * - Requires a master API key (APOLLO_API_KEY)
 * 
 * FUNCTIONALITY:
 * 1. Accepts an Apollo account ID
 * 2. Fetches complete account data from Apollo API
 * 3. Creates or updates a company in Supabase based on:
 *    - apollo_organization_id (primary match)
 *    - Normalized website URL (fallback match)
 * 4. Syncs all related data to Supabase tables:
 *    - companies (main table)
 *    - companies_domains
 *    - companies_keywords
 *    - companies_technologies & companies_technologies_join
 *    - companies_headcount
 *    - companies_suborganizations
 *    - companies_funding_events
 *    - profiles (type company) & social_accounts
 * 
 * IMPORTANT:
 * - This endpoint does NOT perform organization enrichment
 * - This endpoint does NOT sync data from Supabase to Apollo
 * - This endpoint ONLY works with Apollo account IDs (not organization IDs)
 * - This is a custom sync endpoint with a single, specific purpose
 * 
 * USAGE:
 * POST /api/apollo/custom/apollo-account-id-supabase-sync
 * Body: { "accountId": "6518c6184f20350001a0b9c0" }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Company created" | "Company updated",
 *   "companyId": "uuid",
 *   "apollo_account_id": "6518c6184f20350001a0b9c0"
 * }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncCompanySocialUrls } from '@/lib/company-social';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = 'https://api.apollo.io/api/v1/accounts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Function to normalize URLs for comparison
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  try {
    // Remove protocol (http:// or https://)
    let normalized = url.replace(/^https?:\/\//i, '');
    // Remove www.
    normalized = normalized.replace(/^www\./i, '');
    // Remove trailing slashes and paths
    normalized = normalized.split('/')[0];
    // Lowercase and trim
    return normalized.toLowerCase().trim();
  } catch (e) {
    return url.toLowerCase().trim();
  }
};

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { accountId } = await request.json();

    // REQUIRED: Account ID must be provided - this endpoint only works with Apollo account IDs
    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      return NextResponse.json(
        { 
          error: 'Apollo account ID is required',
          message: 'This endpoint requires an Apollo account ID in the request body: { "accountId": "your-apollo-account-id" }'
        },
        { status: 400 }
      );
    }

    // Call Apollo.io API to get account data using View an Account endpoint
    const response = await fetch(`${APOLLO_API_URL}/${accountId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const account = data.account || data;

    if (!account) {
      return NextResponse.json(
        { error: 'No account data found' },
        { status: 404 }
      );
    }

    // Extract organization data from account (Apollo accounts contain organization info)
    const organization = account.organization || account;
    
    const apolloWebsite = organization.website_url || account.website_url || "";
    const apolloDomain = organization.primary_domain || account.primary_domain || normalizeUrl(apolloWebsite);
    
    // Extract organization ID - must be from organization object, not account object
    // If account.organization exists, use organization.id
    // Otherwise, use account.organization_id (which is different from account.id)
    const apolloOrgId = account.organization?.id || account.organization_id || null;
    const apolloAccountId = account.id || accountId;

    // First try to find by apollo_organization_id (unique constraint, most reliable)
    let matchingCompany = null;
    
    if (apolloOrgId) {
      const { data: companyByApolloId, error: apolloIdError } = await supabase
        .from('companies')
        .select('id, name, website')
        .eq('apollo_organization_id', apolloOrgId)
        .maybeSingle();

      if (apolloIdError) {
        console.error("Error fetching company by Apollo ID:", apolloIdError);
      } else if (companyByApolloId) {
        matchingCompany = companyByApolloId;
      }
    }

    // If not found by Apollo ID, try matching by normalized website
    if (!matchingCompany && apolloWebsite) {
      const normalizedApolloUrl = normalizeUrl(apolloWebsite);
      
      const { data: allCompanies, error: fetchError } = await supabase
        .from('companies')
        .select('id, name, website')
        .not('website', 'is', null);

      if (fetchError) {
        console.error("Error fetching companies:", fetchError);
      } else if (allCompanies) {
        matchingCompany = allCompanies.find(company => {
          if (!company.website) return false;
          return normalizeUrl(company.website) === normalizedApolloUrl;
        });
      }
    }

    // Map Apollo account/organization data to Supabase schema
    const companyData: any = {
      name: matchingCompany?.name || organization.name || account.name || "Unnamed Company", // Preserve existing name if updating
      apollo_organization_id: apolloOrgId || null,
      apollo_organization_name: organization.name || account.name || null,
      apollo_account_id: apolloAccountId || null, // IMPORTANT: This will fill in apollo_account_id even if the existing company doesn't have it
      website: apolloWebsite || null,
      domain: apolloDomain || null,
      employee_count: organization.estimated_num_employees ? parseInt(organization.estimated_num_employees) : null,
      founding_year: organization.founded_year ? parseInt(organization.founded_year) : null,
      annual_revenue: organization.annual_revenue ? parseFloat(organization.annual_revenue) : null,
      total_funding: organization.total_funding ? parseFloat(organization.total_funding) : null,
      alexa_ranking: organization.alexa_ranking ? parseInt(organization.alexa_ranking) : null,
      phone: organization.phone || organization.primary_phone?.number || account.phone || null,
      logo_url: organization.logo_url || account.logo_url || null,
      address: organization.raw_address || account.address || null,
      street_address: organization.street_address || account.street_address || null,
      city: organization.city || account.city || null,
      postal_code: organization.postal_code || account.postal_code || null,
      country: organization.country || account.country || null,
      annual_revenue_printed: organization.annual_revenue_printed || null,
      total_funding_printed: organization.total_funding_printed || null,
      industry: organization.industry || account.industry || null,
      last_enriched: new Date().toISOString(),
    };

    let companyId: string;

    if (matchingCompany) {
      // Update existing company with ALL Apollo account data
      // This updates: apollo_account_id, website, domain, employee_count, revenue, funding,
      // address fields, industry, phone, logo, and all other fields from Apollo
      // It will fill in apollo_account_id if it's missing, and update all other fields too
      const { error: updateError } = await supabase
        .from('companies')
        .update(companyData)
        .eq('id', matchingCompany.id);

      if (updateError) {
        throw new Error(`Error updating company: ${updateError.message}`);
      }

      companyId = matchingCompany.id;
    } else {
      // Create new company with all Apollo data
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert({
          ...companyData,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Error creating company: ${insertError.message}`);
      }

      companyId = newCompany.id;
    }

    // After updating/creating the main company record, sync ALL related data to other tables:
    // - companies_domains
    // - companies_keywords
    // - companies_technologies & companies_technologies_join
    // - companies_headcount
    // - companies_suborganizations
    // - companies_funding_events
    // - profiles (type company) & social_accounts

    // Handle domain entry
    if (apolloDomain && companyId) {
      // Check if domain already exists
      const { data: existingDomain } = await supabase
        .from('companies_domains')
        .select('id')
        .eq('company_id', companyId)
        .eq('domain', apolloDomain)
        .maybeSingle();

      if (existingDomain) {
        // Update existing domain
        await supabase
          .from('companies_domains')
          .update({
            is_primary: true,
            url: apolloWebsite,
            is_apollo_org_domain: true,
          })
          .eq('id', existingDomain.id);
      } else {
        // Insert new domain
        await supabase
          .from('companies_domains')
          .insert({
            company_id: companyId,
            domain: apolloDomain,
            is_primary: true,
            url: apolloWebsite,
            is_apollo_org_domain: true,
          });
      }
    }

    // Handle keywords (batched)
    if (companyId && Array.isArray(organization.keywords)) {
      const keywords = Array.from(
        new Set(
          organization.keywords
            .map((k: unknown) => (typeof k === "string" ? k.trim() : ""))
            .filter(Boolean)
        )
      );
      if (keywords.length > 0) {
        const { data: existing } = await supabase
          .from("companies_keywords")
          .select("keyword")
          .eq("company_id", companyId);
        const existingSet = new Set((existing || []).map((r) => r.keyword));
        const toInsert = keywords
          .filter((k) => !existingSet.has(k))
          .map((k) => ({ company_id: companyId, keyword: k, source: "apollo" }));
        if (toInsert.length > 0) {
          await supabase.from("companies_keywords").insert(toInsert);
        }
      }
    }

    // Handle technologies (batched, including legacy technology_names)
    const techEntries: { name: string; uid?: string | null; category?: string | null }[] =
      Array.isArray(organization.current_technologies) && organization.current_technologies.length > 0
        ? organization.current_technologies
            .filter((t: any) => t?.name?.trim())
            .map((t: any) => ({ name: t.name.trim(), uid: t.uid ?? null, category: t.category ?? null }))
        : Array.isArray(organization.technology_names)
        ? (organization.technology_names
            .map((t: unknown) =>
              typeof t === "string" ? { name: t.trim(), uid: null, category: null } : null
            )
            .filter(Boolean) as { name: string; uid: null; category: null }[])
        : [];

    if (companyId && techEntries.length > 0) {
      const names = techEntries.map((e) => e.name);
      const { data: existingTechs } = await supabase
        .from("companies_technologies")
        .select("id, name")
        .in("name", names);
      const byName = new Map((existingTechs || []).map((r) => [r.name, r.id]));
      const toCreate = techEntries.filter((e) => !byName.has(e.name));
      if (toCreate.length > 0) {
        const created = await supabase
          .from("companies_technologies")
          .insert(
            toCreate.map((e) => ({
              uid: e.uid ?? null,
              name: e.name,
              category: e.category ?? null,
            }))
          )
          .select("id, name");
        (created.data || []).forEach((r) => byName.set(r.name, r.id));
      }
      const { data: existingJoins } = await supabase
        .from("companies_technologies_join")
        .select("technology_id")
        .eq("company_id", companyId);
      const existingJoinIds = new Set((existingJoins || []).map((r) => r.technology_id));
      const joinRows = names
        .map((n) => byName.get(n))
        .filter(Boolean)
        .filter((id) => !existingJoinIds.has(id!))
        .map((technology_id) => ({
          company_id: companyId,
          technology_id: technology_id!,
          source: "apollo",
        }));
      if (joinRows.length > 0) await supabase.from("companies_technologies_join").insert(joinRows);
    }

    // Handle departmental headcount
    if (companyId && organization.departmental_head_count && typeof organization.departmental_head_count === 'object') {
      for (const [dept, count] of Object.entries(organization.departmental_head_count)) {
        if (count !== null && count !== undefined && count !== '') {
          const headcount = parseInt(count.toString()) || 0;
          
          // Check if headcount record exists
          const { data: existingHeadcount } = await supabase
            .from('companies_headcount')
            .select('id')
            .eq('company_id', companyId)
            .eq('department', dept)
            .maybeSingle();

          if (existingHeadcount) {
            // Update existing
            await supabase
              .from('companies_headcount')
              .update({
                headcount: headcount,
                source: 'apollo',
              })
              .eq('id', existingHeadcount.id);
          } else {
            // Insert new
            await supabase
              .from('companies_headcount')
              .insert({
                company_id: companyId,
                department: dept,
                headcount: headcount,
                source: 'apollo',
              });
          }
        }
      }
    }

    // Handle suborganizations (batched)
    if (companyId && Array.isArray(organization.suborganizations)) {
      const subs = organization.suborganizations.filter((s: any) => s?.id);
      if (subs.length > 0) {
        const { data: existing } = await supabase
          .from("companies_suborganizations")
          .select("apollo_organization_id")
          .eq("company_id", companyId);
        const existingIds = new Set((existing || []).map((r) => r.apollo_organization_id));
        const toInsert = subs
          .filter((s: any) => !existingIds.has(s.id))
          .map((s: any) => ({
            company_id: companyId,
            apollo_organization_id: s.id,
            name: s.name || "",
            website: s.website_url || s.website || null,
          }));
        if (toInsert.length > 0) await supabase.from("companies_suborganizations").insert(toInsert);
      }
    }

    // Handle funding events (batched)
    if (companyId && Array.isArray(organization.funding_events)) {
      const events = organization.funding_events.filter(Boolean);
      if (events.length > 0) {
        const { data: existing } = await supabase
          .from("companies_funding_events")
          .select("event_id")
          .eq("company_id", companyId);
        const existingIds = new Set((existing || []).map((r) => r.event_id));
        const toInsert = events
          .filter((e: any) => e.id && !existingIds.has(e.id))
          .map((e: any) => ({
            company_id: companyId,
            event_id: e.id || null,
            type: e.type || null,
            amount: e.amount || null,
            currency: e.currency || null,
            date: e.date || null,
            investors: e.investors || null,
            news_url: e.news_url || null,
          }));
        if (toInsert.length > 0) await supabase.from("companies_funding_events").insert(toInsert);
      }
    }

    if (companyId) {
      const companyName = companyData.name || 'Unknown';
      await syncCompanySocialUrls(supabase, companyId, companyName, {
        linkedin: organization.linkedin_url || account.linkedin_url,
        twitter: organization.twitter_url || account.twitter_url,
        facebook: organization.facebook_url || account.facebook_url,
      });
    }

    return NextResponse.json({
      success: true,
      message: matchingCompany ? 'Company updated' : 'Company created',
      companyId: companyId,
      apollo_account_id: apolloAccountId,
      companyName: companyData.name || organization.name || account.name || null
    });

  } catch (error) {
    console.error('Error syncing account to Supabase:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync account to Supabase',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
