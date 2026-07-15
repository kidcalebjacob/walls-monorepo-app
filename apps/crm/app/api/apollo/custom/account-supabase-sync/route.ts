import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncCompanySocialUrls } from '@/lib/company-social';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = 'https://api.apollo.io/v1/accounts';

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

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Call Apollo.io API to get account data
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
    const apolloOrgId = organization.id || account.organization_id;
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
      apollo_account_id: apolloAccountId || null, // This is the key field we're adding
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
      // Update existing company
      const { error: updateError } = await supabase
        .from('companies')
        .update(companyData)
        .eq('id', matchingCompany.id);

      if (updateError) {
        throw new Error(`Error updating company: ${updateError.message}`);
      }

      companyId = matchingCompany.id;
    } else {
      // Create new company
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

    // Handle keywords
    if (companyId && Array.isArray(organization.keywords)) {
      for (const keyword of organization.keywords) {
        if (keyword && typeof keyword === 'string') {
          const keywordTrimmed = keyword.trim();
          if (keywordTrimmed) {
            // Check if keyword already exists for this company
            const { data: existingKeyword } = await supabase
              .from('companies_keywords')
              .select('id')
              .eq('company_id', companyId)
              .eq('keyword', keywordTrimmed)
              .maybeSingle();

            if (!existingKeyword) {
              await supabase
                .from('companies_keywords')
                .insert({
                  company_id: companyId,
                  keyword: keywordTrimmed,
                  source: 'apollo',
                });
            }
          }
        }
      }
    }

    // Handle technologies
    if (companyId && Array.isArray(organization.current_technologies)) {
      for (const tech of organization.current_technologies) {
        if (tech && typeof tech === 'object' && tech.name) {
          const techName = tech.name.trim();
          const techCategory = tech.category || null;
          const techUid = tech.uid || null;

          // Check if technology exists by name
          let { data: existingTech } = await supabase
            .from('companies_technologies')
            .select('id')
            .eq('name', techName)
            .maybeSingle();

          let techId: string;

          if (!existingTech) {
            // Create new technology
            const { data: newTech, error: techError } = await supabase
              .from('companies_technologies')
              .insert({
                uid: techUid,
                name: techName,
                category: techCategory,
              })
              .select('id')
              .single();

            if (techError) {
              console.error("Error creating technology:", techError);
              continue;
            }
            techId = newTech.id;
          } else {
            techId = existingTech.id;
          }

          // Check if join record exists
          const { data: existingJoin } = await supabase
            .from('companies_technologies_join')
            .select('id')
            .eq('company_id', companyId)
            .eq('technology_id', techId)
            .maybeSingle();

          if (!existingJoin) {
            await supabase
              .from('companies_technologies_join')
              .insert({
                company_id: companyId,
                technology_id: techId,
                source: 'apollo',
              });
          }
        }
      }
    }

    // Handle old technologies format (string array)
    if (companyId && Array.isArray(organization.technology_names) && 
        (!organization.current_technologies || organization.current_technologies.length === 0)) {
      for (const techName of organization.technology_names) {
        if (techName && typeof techName === 'string') {
          const techNameTrimmed = techName.trim();
          if (techNameTrimmed) {
            // Check if technology exists by name
            let { data: existingTech } = await supabase
              .from('companies_technologies')
              .select('id')
              .eq('name', techNameTrimmed)
              .maybeSingle();

            let techId: string;

            if (!existingTech) {
              // Create new technology
              const { data: newTech, error: techError } = await supabase
                .from('companies_technologies')
                .insert({
                  name: techNameTrimmed,
                  category: null,
                })
                .select('id')
                .single();

              if (techError) {
                console.error("Error creating technology:", techError);
                continue;
              }
              techId = newTech.id;
            } else {
              techId = existingTech.id;
            }

            // Check if join record exists
            const { data: existingJoin } = await supabase
              .from('companies_technologies_join')
              .select('id')
              .eq('company_id', companyId)
              .eq('technology_id', techId)
              .maybeSingle();

            if (!existingJoin) {
              await supabase
                .from('companies_technologies_join')
                .insert({
                  company_id: companyId,
                  technology_id: techId,
                  source: 'apollo',
                });
            }
          }
        }
      }
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

    // Handle suborganizations
    if (companyId && Array.isArray(organization.suborganizations)) {
      for (const suborg of organization.suborganizations) {
        if (suborg && typeof suborg === 'object' && suborg.id) {
          // Check if suborganization already exists
          const { data: existingSuborg } = await supabase
            .from('companies_suborganizations')
            .select('id')
            .eq('company_id', companyId)
            .eq('apollo_organization_id', suborg.id)
            .maybeSingle();

          if (!existingSuborg) {
            await supabase
              .from('companies_suborganizations')
              .insert({
                company_id: companyId,
                apollo_organization_id: suborg.id,
                name: suborg.name || '',
                website: suborg.website_url || suborg.website || null,
              });
          }
        }
      }
    }

    // Handle funding events
    if (companyId && Array.isArray(organization.funding_events)) {
      for (const evt of organization.funding_events) {
        if (!evt) continue;

        // Check if funding event already exists
        const { data: existingEvent } = await supabase
          .from('companies_funding_events')
          .select('id')
          .eq('company_id', companyId)
          .eq('event_id', evt.id)
          .maybeSingle();

        if (!existingEvent) {
          await supabase
            .from('companies_funding_events')
            .insert({
              company_id: companyId,
              event_id: evt.id || null,
              type: evt.type || null,
              amount: evt.amount || null,
              currency: evt.currency || null,
              date: evt.date || null,
              investors: evt.investors || null,
              news_url: evt.news_url || null,
            });
        }
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
      apollo_account_id: apolloAccountId
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
