import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCompanySocialUrls } from "@/lib/company-social";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_MASTER_API_KEY = process.env.APOLLO_MASTER_API_KEY || process.env.APOLLO_API_KEY;
const APOLLO_MATCH_ENDPOINT = 'https://api.apollo.io/v1/people/match';
const APOLLO_ENRICH_ENDPOINT = 'https://api.apollo.io/v1/people/enrich';
const APOLLO_CREATE_CONTACT_ENDPOINT = 'https://api.apollo.io/api/v1/contacts';
const APOLLO_CREATE_ACCOUNT_ENDPOINT = 'https://api.apollo.io/api/v1/accounts';
const APOLLO_ORGANIZATION_ENRICH_ENDPOINT = 'https://api.apollo.io/v1/organizations/enrich';

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

interface LeadEnrichRequestBody {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  linkedin?: string;
  domain?: string;
  userId: string;
  companyId?: string;
  apolloAccountId?: string;
}

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body: LeadEnrichRequestBody = await request.json();
    const { userId, companyId, apolloAccountId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    let apolloId = body.id;
    
    // Step 1: If we don't have an Apollo ID but have other identifiers, try to match first
    if (!apolloId && (body.linkedin || (body.email && body.domain) || (body.firstName && body.lastName))) {
      const matchParams: Record<string, any> = {
        api_key: APOLLO_API_KEY
      };

      if (body.linkedin) matchParams.linkedin_url = body.linkedin;
      if (body.email) matchParams.email = body.email;
      if (body.domain) matchParams.domain = body.domain;
      if (body.firstName) matchParams.first_name = body.firstName;
      if (body.lastName) matchParams.last_name = body.lastName;
      if (body.name) matchParams.name = body.name;

      const matchQueryString = new URLSearchParams(matchParams).toString();
      
      try {
        const matchResponse = await fetch(`${APOLLO_MATCH_ENDPOINT}?${matchQueryString}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'X-Api-Key': APOLLO_API_KEY
          }
        });

        if (!matchResponse.ok) {
          const errorData = await matchResponse.text();
          throw new Error(`Apollo Match API error: ${matchResponse.status} - ${errorData}`);
        }

        const matchData = await matchResponse.json();
        
        if (matchData.person) {
          apolloId = matchData.person.id;
        }
      } catch (error) {
        // Don't throw here, let it continue to enrichment with available data
      }
    }

    // Step 2: Enrich with Apollo ID (or other identifiers if match failed)
    const enrichParams: Record<string, any> = {
      api_key: APOLLO_API_KEY,
      reveal_personal_emails: true
    };

    // Prioritize Apollo ID if we have it
    if (apolloId) {
      enrichParams.id = apolloId;
    } else {
      // Fallback to other identifiers
      if (body.linkedin) enrichParams.linkedin_url = body.linkedin;
      if (body.email) enrichParams.email = body.email;
      if (body.domain) enrichParams.domain = body.domain;
      if (body.firstName) enrichParams.first_name = body.firstName;
      if (body.lastName) enrichParams.last_name = body.lastName;
      if (body.name) enrichParams.name = body.name;
    }

    try {
      const response = await fetch(APOLLO_ENRICH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        },
        body: JSON.stringify(enrichParams)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Apollo Enrich API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      if (!data.person) {
        return NextResponse.json({ error: "No person found" }, { status: 404 });
      }

      // Extract account_id from person enrichment response (highest priority)
      const apolloAccountIdFromPerson = data.person?.contact?.account_id || null;
      
      // Debug logging for contact_id and account_id
      console.log('Apollo response - person.contact_id:', data.person.contact_id);
      console.log('Apollo response - person.contact?.id:', data.person.contact?.id);
      console.log('Apollo response - person.contact?.account_id:', apolloAccountIdFromPerson);
      console.log('Apollo response - person.contact:', JSON.stringify(data.person.contact, null, 2));
      console.log('Apollo response - full person object keys:', Object.keys(data.person));

      const supabase = await createClient();

      // Check if person already exists in Supabase by apollo_person_id or email
      let existingPerson = null;
      
      // First, try to match by apollo_person_id if we have it
      if (data.person.id) {
        const { data: personData, error: checkError } = await supabase
          .from('people')
          .select('id, status, phone')
          .eq('apollo_person_id', data.person.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
          console.error('Error checking for existing person by apollo_person_id:', checkError);
        } else if (personData) {
          existingPerson = personData;
          console.log('Found existing person by apollo_person_id:', personData.id);
        }
      }
      
      // If not found by apollo_person_id, try to match by email
      // Check multiple possible locations for email
      if (!existingPerson) {
        let emailForMatching: string | null = null;
        // First, try the direct email field on person (previous way)
        if (data.person.email) {
          emailForMatching = data.person.email;
        }
        // If no direct email, check contact_emails array on person (new way)
        if (!emailForMatching && data.person.contact_emails && Array.isArray(data.person.contact_emails) && data.person.contact_emails.length > 0) {
          emailForMatching = data.person.contact_emails[0]?.email || null;
        }
        // If still no email, check contact object email field
        if (!emailForMatching && data.person.contact?.email) {
          emailForMatching = data.person.contact.email;
        }
        // If still no email, check contact.contact_emails array
        if (!emailForMatching && data.person.contact?.contact_emails && Array.isArray(data.person.contact.contact_emails) && data.person.contact.contact_emails.length > 0) {
          emailForMatching = data.person.contact.contact_emails[0]?.email || null;
        }

        if (emailForMatching) {
          const { data: personData, error: checkError } = await supabase
            .from('people')
            .select('id, status, phone')
            .eq('email', emailForMatching)
            .maybeSingle();

          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
            console.error('Error checking for existing person by email:', checkError);
          } else if (personData) {
            existingPerson = personData;
            console.log('Found existing person by email:', personData.id);
          }
        }
      }

      // Extract email - check multiple possible locations
      let extractedEmail: string | null = null;
      // First, try the direct email field on person (previous way)
      if (data.person.email) {
        extractedEmail = data.person.email;
      }
      // If no direct email, check contact_emails array on person (new way)
      if (!extractedEmail && data.person.contact_emails && Array.isArray(data.person.contact_emails)) {
        // First try to find verified email
        const verifiedEmail = data.person.contact_emails.find(
          (e: any) => e.email_status === "verified"
        )?.email;
        if (verifiedEmail) {
          extractedEmail = verifiedEmail;
        } else if (data.person.contact_emails.length > 0) {
          // Fallback to first email in array
          extractedEmail = data.person.contact_emails[0]?.email || null;
        }
      }
      // If still no email, check contact object email field
      if (!extractedEmail && data.person.contact?.email) {
        extractedEmail = data.person.contact.email;
      }
      // If still no email, check contact.contact_emails array
      if (!extractedEmail && data.person.contact?.contact_emails && Array.isArray(data.person.contact.contact_emails)) {
        // First try to find verified email
        const verifiedEmail = data.person.contact.contact_emails.find(
          (e: any) => e.email_status === "verified"
        )?.email;
        if (verifiedEmail) {
          extractedEmail = verifiedEmail;
        } else if (data.person.contact.contact_emails.length > 0) {
          // Fallback to first email in array
          extractedEmail = data.person.contact.contact_emails[0]?.email || null;
        }
      }

      // Guardrail: Apollo can return a person shell (id only-ish) with no usable contact data.
      // In that case, don't create/update a local person record.
      if (!extractedEmail) {
        console.warn("Apollo person enrichment returned no email; skipping local upsert", {
          apolloPersonId: data.person.id || null,
        });
        return NextResponse.json(
          {
            error: "Person not found on Apollo with usable contact data",
            code: "APOLLO_PERSON_NOT_USABLE",
          },
          { status: 404 }
        );
      }

      // Extract phone from phone_numbers array (prefer sanitized_number, then raw_number)
      let extractedPhone: string | null = null;
      if (data.person.phone_numbers && Array.isArray(data.person.phone_numbers) && data.person.phone_numbers.length > 0) {
        const phone = data.person.phone_numbers[0];
        extractedPhone = phone.sanitized_number || phone.raw_number || null;
      }

      // ============================================================================
      // COMPANY RECONCILIATION & APOLLO ACCOUNT CREATION
      // Priority: account_id → View Account sync → organization enrichment
      // ============================================================================
      let resolvedCompanyId: string | null = companyId || null;
      let resolvedCompany: any = null;
      let resolvedApolloAccountId: string | null = apolloAccountIdFromPerson;

      // PRIORITY PATH 1: If account_id is present, match locally first (no Apollo call), then View Account if needed
      // Rule: NEVER run organization enrichment if account_id exists
      if (apolloAccountIdFromPerson) {
        console.log('Account ID found in person response:', apolloAccountIdFromPerson);
        
        // STEP 1: Try local match first (no Apollo API call - saves credits)
        const { data: companyByAccountId, error: localMatchError } = await supabase
          .from('companies')
          .select('id, apollo_account_id, name, domain, phone, address')
          .eq('apollo_account_id', apolloAccountIdFromPerson)
          .maybeSingle();

        if (localMatchError) {
          console.error('Error matching company by apollo_account_id locally:', localMatchError);
        } else if (companyByAccountId) {
          // Local match found - use it directly (no API call needed)
          resolvedCompanyId = companyByAccountId.id;
          resolvedCompany = companyByAccountId;
          resolvedApolloAccountId = apolloAccountIdFromPerson;
          console.log('✅ COMPANY SYNCED VIA APOLLO ACCOUNT ID (Local Match):', {
            companyId: resolvedCompanyId,
            apolloAccountId: apolloAccountIdFromPerson,
            companyName: companyByAccountId.name
          });
        } else {
          // STEP 2: No local match - call View Account sync
          console.log('No local match found, calling View Account sync:', apolloAccountIdFromPerson);
          
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            
            const syncResponse = await fetch(
              `${baseUrl}/api/apollo/custom/apollo-account-id-supabase-sync`,
              {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  accountId: apolloAccountIdFromPerson
                })
              }
            );

            if (!syncResponse.ok) {
              const errorText = await syncResponse.text();
              console.error('Failed to sync Apollo account to Supabase:', syncResponse.status, errorText);
              throw new Error(`Failed to sync Apollo account to Supabase: ${syncResponse.status}`);
            }

            const syncResult = await syncResponse.json();
            
            if (syncResult.companyId) {
              resolvedCompanyId = syncResult.companyId;
              resolvedApolloAccountId = syncResult.apollo_account_id || apolloAccountIdFromPerson;
              
              // Fetch the synced company
              const { data: syncedCompany } = await supabase
                .from('companies')
                .select('id, apollo_account_id, name, domain, phone, address')
                .eq('id', resolvedCompanyId)
                .single();
              
              if (syncedCompany) {
                resolvedCompany = syncedCompany;
                console.log('✅ COMPANY SYNCED VIA APOLLO ACCOUNT ID (View Account Sync):', {
                  companyId: resolvedCompanyId,
                  apolloAccountId: resolvedApolloAccountId,
                  companyName: syncedCompany.name
                });
              }
            }
          } catch (error) {
            console.error('Error syncing Apollo account:', error);
            // If account_id was present, we should NOT fall back to org enrichment
            // The error should be surfaced, not bypassed
            // Don't reset resolvedApolloAccountId - keep it to prevent org enrichment
          }
        }
      }

      // FALLBACK PATH: Only run organization enrichment if account_id was NOT present
      // Strict gating: NEVER enrich orgs if Apollo gave us an account_id
      if (!apolloAccountIdFromPerson && !resolvedCompanyId) {
        console.log('No account_id in person response, falling back to organization enrichment');
        
        const apolloOrgId = data.person.organization?.id || null;

        // Step 1: Load existing company's Apollo organization ID (if person exists)
        let existingCompanyApolloOrgId: string | null = null;
        if (existingPerson?.id) {
          // First get the person's company_id
          const { data: personData, error: personError } = await supabase
            .from('people')
            .select('company_id')
            .eq('id', existingPerson.id)
            .single();

          if (!personError && personData?.company_id) {
            // Then get the company's apollo_organization_id
            const { data: companyData, error: companyError } = await supabase
              .from('companies')
              .select('apollo_organization_id')
              .eq('id', personData.company_id)
              .single();

            if (!companyError && companyData) {
              existingCompanyApolloOrgId = companyData.apollo_organization_id || null;
            }
          }
        }

        // Step 2: Explicit Organization Mismatch Detection & Resolution
        // Rule: Apollo organization ID always wins over existing company assignment.
        // If they disagree, the person is reassigned to the Apollo organization's company.
        if (!apolloAccountIdFromPerson && existingPerson) {
          const hasOrgMismatch =
            existingCompanyApolloOrgId &&
            apolloOrgId &&
            existingCompanyApolloOrgId !== apolloOrgId;

          if (hasOrgMismatch) {
            console.log(
              'Apollo org mismatch detected. Reassigning person to correct company.',
              {
                existingCompanyApolloOrgId,
                apolloOrgId,
                personId: existingPerson.id,
              }
            );

            const { data: companyByApolloOrg, error: apolloOrgError } = await supabase
              .from('companies')
              .select('id, apollo_account_id, name, domain, phone, address')
              .eq('apollo_organization_id', apolloOrgId)
              .maybeSingle();

            if (apolloOrgError) {
              console.error('Error fetching company by Apollo org ID for mismatch resolution:', apolloOrgError);
            } else if (companyByApolloOrg) {
              resolvedCompany = companyByApolloOrg;
              resolvedCompanyId = companyByApolloOrg.id;
              resolvedApolloAccountId =
                companyByApolloOrg.apollo_account_id || resolvedApolloAccountId;

              console.log('✅ COMPANY SYNCED VIA APOLLO ORGANIZATION ID (Mismatch Resolution):', {
                companyId: resolvedCompanyId,
                apolloOrganizationId: apolloOrgId,
                previousOrgId: existingCompanyApolloOrgId,
                companyName: companyByApolloOrg.name
              });
            } else {
              // No existing company for this org — allow enrichment path to create it
              resolvedCompany = null;
              resolvedCompanyId = null;

              console.log(
                'Apollo org mismatch but no company exists yet. Will enrich company.',
                apolloOrgId
              );
            }
          }
        }

        // Step 3: Resolve Company by apollo_organization_id (if not already resolved by mismatch logic)
        if (apolloOrgId && !resolvedCompanyId) {
          const { data: companyByApolloId, error: apolloIdError } = await supabase
            .from('companies')
            .select('id, apollo_account_id, name, domain, phone, address')
            .eq('apollo_organization_id', apolloOrgId)
            .maybeSingle();

          if (apolloIdError) {
            console.error('Error fetching company by Apollo org ID:', apolloIdError);
          } else if (companyByApolloId) {
            resolvedCompany = companyByApolloId;
            resolvedCompanyId = companyByApolloId.id;
            resolvedApolloAccountId = companyByApolloId.apollo_account_id || null;
            console.log('✅ COMPANY SYNCED VIA APOLLO ORGANIZATION ID (General Resolution):', {
              companyId: resolvedCompanyId,
              apolloOrganizationId: apolloOrgId,
              companyName: companyByApolloId.name
            });
          }
        }

        // Step 3: Enrich & Create Company if No Match Found (INLINE LOGIC)
        // CRITICAL: Use apolloOrgId directly - never use data.person.organization.website_url
        // which could be stale. The org ID is the authoritative source of truth.
        if (!resolvedCompany && apolloOrgId) {
          try {
            // Call Apollo Organization Enrich API with org ID (deterministic, not domain)
            const orgEnrichResponse = await fetch(APOLLO_ORGANIZATION_ENRICH_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': APOLLO_API_KEY
              },
              body: JSON.stringify({
                id: apolloOrgId  // ✅ USE APOLLO ORG ID, NOT DOMAIN - ensures correct org
              })
            });

            if (!orgEnrichResponse.ok) {
              const errorData = await orgEnrichResponse.text();
              console.error(`Apollo Organization Enrich API error: ${orgEnrichResponse.status} - ${errorData}`);
              throw new Error(`Apollo Organization Enrich API error: ${orgEnrichResponse.status}`);
            }

            const orgData = await orgEnrichResponse.json();
            const organization = orgData.organization;

            if (!organization) {
              console.error('No organization data found in Apollo response');
            } else {
                const apolloWebsite = organization.website_url || "";
                const apolloDomain = organization.primary_domain || normalizeUrl(apolloWebsite);
                const enrichedApolloOrgId = organization.id;

                // First try to find by apollo_organization_id (unique constraint, most reliable)
                let matchingCompany = null;
                
                if (enrichedApolloOrgId) {
                  const { data: companyByApolloId, error: apolloIdError } = await supabase
                    .from('companies')
                    .select('id, name, website, apollo_account_id')
                    .eq('apollo_organization_id', enrichedApolloOrgId)
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
                    .select('id, name, website, apollo_account_id')
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

                // Map Apollo data to Supabase schema
                const companyData: any = {
                  name: matchingCompany?.name || organization.name || "Unnamed Company",
                  apollo_organization_id: organization.id || null,
                  apollo_organization_name: organization.name || null,
                  website: apolloWebsite || null,
                  domain: apolloDomain || null,
                  employee_count: organization.estimated_num_employees ? parseInt(organization.estimated_num_employees) : null,
                  founding_year: organization.founded_year ? parseInt(organization.founded_year) : null,
                  annual_revenue: organization.annual_revenue ? parseFloat(organization.annual_revenue) : null,
                  total_funding: organization.total_funding ? parseFloat(organization.total_funding) : null,
                  alexa_ranking: organization.alexa_ranking ? parseInt(organization.alexa_ranking) : null,
                  phone: organization.phone || organization.primary_phone?.number || null,
                  logo_url: organization.logo_url || null,
                  address: organization.raw_address || null,
                  street_address: organization.street_address || null,
                  city: organization.city || null,
                  postal_code: organization.postal_code || null,
                  country: organization.country || null,
                  annual_revenue_printed: organization.annual_revenue_printed || null,
                  total_funding_printed: organization.total_funding_printed || null,
                  industry: organization.industry || null,
                  last_enriched: new Date().toISOString(),
                };

                let enrichedCompanyId: string;

                if (matchingCompany) {
                  // Update existing company
                  const { error: updateError } = await supabase
                    .from('companies')
                    .update(companyData)
                    .eq('id', matchingCompany.id);

                  if (updateError) {
                    console.error(`Error updating company: ${updateError.message}`);
                    throw new Error(`Error updating company: ${updateError.message}`);
                  }

                  enrichedCompanyId = matchingCompany.id;
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
                    console.error(`Error creating company: ${insertError.message}`);
                    throw new Error(`Error creating company: ${insertError.message}`);
                  }

                  enrichedCompanyId = newCompany.id;
                }

                // Handle domain entry
                if (apolloDomain && enrichedCompanyId) {
                  const { data: existingDomain } = await supabase
                    .from('companies_domains')
                    .select('id')
                    .eq('company_id', enrichedCompanyId)
                    .eq('domain', apolloDomain)
                    .maybeSingle();

                  if (existingDomain) {
                    await supabase
                      .from('companies_domains')
                      .update({
                        is_primary: true,
                        url: apolloWebsite,
                        is_apollo_org_domain: true,
                      })
                      .eq('id', existingDomain.id);
                  } else {
                    await supabase
                      .from('companies_domains')
                      .insert({
                        company_id: enrichedCompanyId,
                        domain: apolloDomain,
                        is_primary: true,
                        url: apolloWebsite,
                        is_apollo_org_domain: true,
                      });
                  }
                }

                // Handle keywords
                if (enrichedCompanyId && Array.isArray(organization.keywords)) {
                  for (const keyword of organization.keywords) {
                    if (keyword && typeof keyword === 'string') {
                      const keywordTrimmed = keyword.trim();
                      if (keywordTrimmed) {
                        const { data: existingKeyword } = await supabase
                          .from('companies_keywords')
                          .select('id')
                          .eq('company_id', enrichedCompanyId)
                          .eq('keyword', keywordTrimmed)
                          .maybeSingle();

                        if (!existingKeyword) {
                          await supabase
                            .from('companies_keywords')
                            .insert({
                              company_id: enrichedCompanyId,
                              keyword: keywordTrimmed,
                              source: 'apollo',
                            });
                        }
                      }
                    }
                  }
                }

                // Handle technologies
                if (enrichedCompanyId && Array.isArray(organization.current_technologies)) {
                  for (const tech of organization.current_technologies) {
                    if (tech && typeof tech === 'object' && tech.name) {
                      const techName = tech.name.trim();
                      const techCategory = tech.category || null;
                      const techUid = tech.uid || null;

                      let { data: existingTech } = await supabase
                        .from('companies_technologies')
                        .select('id')
                        .eq('name', techName)
                        .maybeSingle();

                      let techId: string;

                      if (!existingTech) {
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

                      const { data: existingJoin } = await supabase
                        .from('companies_technologies_join')
                        .select('id')
                        .eq('company_id', enrichedCompanyId)
                        .eq('technology_id', techId)
                        .maybeSingle();

                      if (!existingJoin) {
                        await supabase
                          .from('companies_technologies_join')
                          .insert({
                            company_id: enrichedCompanyId,
                            technology_id: techId,
                            source: 'apollo',
                          });
                      }
                    }
                  }
                }

                // Handle old technologies format (string array)
                if (enrichedCompanyId && Array.isArray(organization.technology_names) && 
                    (!organization.current_technologies || organization.current_technologies.length === 0)) {
                  for (const techName of organization.technology_names) {
                    if (techName && typeof techName === 'string') {
                      const techNameTrimmed = techName.trim();
                      if (techNameTrimmed) {
                        let { data: existingTech } = await supabase
                          .from('companies_technologies')
                          .select('id')
                          .eq('name', techNameTrimmed)
                          .maybeSingle();

                        let techId: string;

                        if (!existingTech) {
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

                        const { data: existingJoin } = await supabase
                          .from('companies_technologies_join')
                          .select('id')
                          .eq('company_id', enrichedCompanyId)
                          .eq('technology_id', techId)
                          .maybeSingle();

                        if (!existingJoin) {
                          await supabase
                            .from('companies_technologies_join')
                            .insert({
                              company_id: enrichedCompanyId,
                              technology_id: techId,
                              source: 'apollo',
                            });
                        }
                      }
                    }
                  }
                }

                // Handle departmental headcount
                if (enrichedCompanyId && organization.departmental_head_count && typeof organization.departmental_head_count === 'object') {
                  for (const [dept, count] of Object.entries(organization.departmental_head_count)) {
                    if (count !== null && count !== undefined && count !== '') {
                      const headcount = parseInt(count.toString()) || 0;
                      
                      const { data: existingHeadcount } = await supabase
                        .from('companies_headcount')
                        .select('id')
                        .eq('company_id', enrichedCompanyId)
                        .eq('department', dept)
                        .maybeSingle();

                      if (existingHeadcount) {
                        await supabase
                          .from('companies_headcount')
                          .update({
                            headcount: headcount,
                            source: 'apollo',
                          })
                          .eq('id', existingHeadcount.id);
                      } else {
                        await supabase
                          .from('companies_headcount')
                          .insert({
                            company_id: enrichedCompanyId,
                            department: dept,
                            headcount: headcount,
                            source: 'apollo',
                          });
                      }
                    }
                  }
                }

                // Handle suborganizations
                if (enrichedCompanyId && Array.isArray(organization.suborganizations)) {
                  for (const suborg of organization.suborganizations) {
                    if (suborg && typeof suborg === 'object' && suborg.id) {
                      const { data: existingSuborg } = await supabase
                        .from('companies_suborganizations')
                        .select('id')
                        .eq('company_id', enrichedCompanyId)
                        .eq('apollo_organization_id', suborg.id)
                        .maybeSingle();

                      if (!existingSuborg) {
                        await supabase
                          .from('companies_suborganizations')
                          .insert({
                            company_id: enrichedCompanyId,
                            apollo_organization_id: suborg.id,
                            name: suborg.name || '',
                            website: suborg.website_url || suborg.website || null,
                          });
                      }
                    }
                  }
                }

                // Handle funding events
                if (enrichedCompanyId && Array.isArray(organization.funding_events)) {
                  for (const evt of organization.funding_events) {
                    if (!evt) continue;

                    const { data: existingEvent } = await supabase
                      .from('companies_funding_events')
                      .select('id')
                      .eq('company_id', enrichedCompanyId)
                      .eq('event_id', evt.id)
                      .maybeSingle();

                    if (!existingEvent) {
                      await supabase
                        .from('companies_funding_events')
                        .insert({
                          company_id: enrichedCompanyId,
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

                if (enrichedCompanyId) {
                  const companyName = companyData.name || 'Unknown';
                  await syncCompanySocialUrls(supabase, enrichedCompanyId, companyName, {
                    linkedin: organization.linkedin_url,
                    twitter: organization.twitter_url,
                    facebook: organization.facebook_url,
                  });
                }

                // Set resolved company after enrichment
                resolvedCompanyId = enrichedCompanyId;
                
                // Fetch the newly created/updated company with account_id
                const { data: newCompany } = await supabase
                  .from('companies')
                  .select('id, apollo_account_id, name, domain, phone, address')
                  .eq('id', resolvedCompanyId)
                  .single();
                
                if (newCompany) {
                  resolvedCompany = newCompany;
                  resolvedApolloAccountId = newCompany.apollo_account_id || null;
                  console.log('✅ COMPANY SYNCED VIA APOLLO ORGANIZATION ID (Organization Enrichment):', {
                    companyId: resolvedCompanyId,
                    apolloOrganizationId: enrichedApolloOrgId,
                    companyName: newCompany.name,
                    wasCreated: !matchingCompany
                  });
                }
              }
            } catch (error) {
              console.error('Error enriching company inline:', error);
              // Continue without throwing - we'll try to create account anyway
            }
          }

        // Step 4: Ensure Apollo Account Exists for Company (only if not already set)
        if (resolvedCompanyId && !resolvedCompany) {
          // Fetch company if we don't have it yet
          const { data: companyData } = await supabase
            .from('companies')
            .select('id, apollo_account_id, name, domain, phone, address')
            .eq('id', resolvedCompanyId)
            .single();
          
          if (companyData) {
            resolvedCompany = companyData;
            resolvedApolloAccountId = companyData.apollo_account_id || null;
          }
        }

        // Only create account if we don't have one yet
        if (resolvedCompany && !resolvedCompany.apollo_account_id && !resolvedApolloAccountId) {
          try {
            const accountPayload: Record<string, any> = {
              name: resolvedCompany.name || null,
              domain: resolvedCompany.domain || null,
            };

            if (resolvedCompany.phone) {
              accountPayload.phone = resolvedCompany.phone;
            }
            if (resolvedCompany.address) {
              accountPayload.raw_address = resolvedCompany.address;
            }

            console.log('Creating Apollo account for company:', resolvedCompanyId, accountPayload);

            const createAccountResponse = await fetch(APOLLO_CREATE_ACCOUNT_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': APOLLO_MASTER_API_KEY!
              },
              body: JSON.stringify(accountPayload)
            });

            if (createAccountResponse.ok) {
              const accountResult = await createAccountResponse.json();
              
              if (accountResult.account?.id) {
                const { error: updateAccountError } = await supabase
                  .from('companies')
                  .update({ apollo_account_id: accountResult.account.id })
                  .eq('id', resolvedCompany.id);

                if (updateAccountError) {
                  console.error('Error updating apollo_account_id:', updateAccountError);
                } else {
                  resolvedCompany.apollo_account_id = accountResult.account.id;
                  resolvedApolloAccountId = accountResult.account.id;
                  console.log('✅ NEW APOLLO ACCOUNT CREATED:', {
                    companyId: resolvedCompany.id,
                    apolloAccountId: accountResult.account.id,
                    companyName: resolvedCompany.name
                  });
                }
              }
            } else {
              const errorText = await createAccountResponse.text();
              console.error('Error creating Apollo account:', createAccountResponse.status, errorText);
              // Don't throw - continue without account_id
            }
          } catch (error) {
            console.error('Error creating Apollo account:', error);
            // Don't throw - continue without account_id
          }
        }
      }

      // Update resolvedCompanyId if we have a resolved company
      if (resolvedCompany) {
        resolvedCompanyId = resolvedCompany.id;
        // Ensure resolvedApolloAccountId is set from company if available
        if (!resolvedApolloAccountId && resolvedCompany.apollo_account_id) {
          resolvedApolloAccountId = resolvedCompany.apollo_account_id;
        }
      }
      // ============================================================================

      // Map Apollo data to Supabase schema
      const personData: any = {
        apollo_person_id: data.person.id || null,
        apollo_contact_id: data.person.contact_id || data.person.contact?.id || null,
        first_name: data.person.first_name || null,
        last_name: data.person.last_name || null,
        email: extractedEmail,
        // Only include phone if Apollo provided one - don't overwrite existing phone with null
        ...(extractedPhone !== null && { phone: extractedPhone }),
        title: data.person.title || null,
        linkedin_url: data.person.linkedin_url || null,
        company_id: resolvedCompanyId, // Use resolved company ID from reconciliation
        company_name: data.person.organization?.name || null,
        company_website: data.person.organization?.website_url || null,
        city: data.person.city || null,
        state: data.person.state || null,
        country: data.person.country || null,
        photo_url: data.person.photo_url || null,
        seniority: data.person.seniority || null,
        headline: data.person.headline || null,
        twitter_url: data.person.twitter_url || null,
        github_url: data.person.github_url || null,
        facebook_url: data.person.facebook_url || null,
        apollo_organization_id: data.person.organization?.id || null,
        time_zone: data.person.time_zone || data.person.contact?.time_zone || null,
        last_enriched: new Date().toISOString(),
        last_apollo_update: new Date().toISOString(),
        is_contact: false, // This is a lead
        source: existingPerson ? undefined : "apollo", // Don't overwrite existing source
        status: existingPerson?.status || "New"
      };

      // Debug logging for mapped contact_id
      console.log('Mapped apollo_contact_id value:', personData.apollo_contact_id);
      console.log('Full personData object:', JSON.stringify(personData, null, 2));

      let personId: string;

      if (existingPerson) {
        // Update existing person
        const { data: updatedPerson, error: updateError } = await supabase
          .from('people')
          .update(personData)
          .eq('id', existingPerson.id)
          .select('id')
          .single();

        if (updateError) {
          console.error('Update error details:', updateError);
          console.error('Update error code:', updateError.code);
          console.error('Update error message:', updateError.message);
          throw new Error(`Failed to update person: ${updateError.message}`);
        }

        console.log('Successfully updated person with ID:', updatedPerson.id);
        personId = updatedPerson.id;
      } else {
        // Insert new person
        const { data: newPerson, error: insertError } = await supabase
          .from('people')
          .insert(personData)
          .select('id')
          .single();

        if (insertError) {
          console.error('Insert error details:', insertError);
          console.error('Insert error code:', insertError.code);
          console.error('Insert error message:', insertError.message);
          throw new Error(`Failed to insert person: ${insertError.message}`);
        }

        console.log('Successfully inserted person with ID:', newPerson.id);
        personId = newPerson.id;
      }

      // Handle departments
      if (data.person.departments && Array.isArray(data.person.departments)) {
        // Delete existing departments for this person
        await supabase
          .from('people_departments')
          .delete()
          .eq('person_id', personId);

        // Insert new departments
        if (data.person.departments.length > 0) {
          const departmentsToInsert = data.person.departments.map((dept: string) => {
            // Format name: first letter of first word capitalized, rest lowercase
            // e.g., "master_marketing" -> "Master marketing"
            // e.g., "digital_marketing" -> "Digital marketing"
            const words = dept.split('_');
            const formattedName = words
              .map((word, index) => {
                if (index === 0) {
                  // First word: capitalize first letter, rest lowercase
                  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                } else {
                  // Other words: all lowercase
                  return word.toLowerCase();
                }
              })
              .join(' ');

            return {
              person_id: personId,
              name: formattedName,
              apollo_name: dept // Keep raw Apollo response
            };
          });

          await supabase
            .from('people_departments')
            .insert(departmentsToInsert);
        }
      }

      // Handle subdepartments
      if (data.person.subdepartments && Array.isArray(data.person.subdepartments)) {
        // Delete existing subdepartments for this person
        await supabase
          .from('people_subdepartments')
          .delete()
          .eq('person_id', personId);

        // Insert new subdepartments
        if (data.person.subdepartments.length > 0) {
          const subdepartmentsToInsert = data.person.subdepartments.map((subdept: string) => {
            // Format name: first letter of first word capitalized, rest lowercase
            const words = subdept.split('_');
            const formattedName = words
              .map((word, index) => {
                if (index === 0) {
                  // First word: capitalize first letter, rest lowercase
                  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                } else {
                  // Other words: all lowercase
                  return word.toLowerCase();
                }
              })
              .join(' ');

            return {
              person_id: personId,
              name: formattedName,
              apollo_name: subdept // Keep raw Apollo response
            };
          });

          await supabase
            .from('people_subdepartments')
            .insert(subdepartmentsToInsert);
        }
      }

      // Handle employment history
      if (data.person.employment_history && Array.isArray(data.person.employment_history)) {
        // Delete existing employment history for this person
        await supabase
          .from('people_employment_history')
          .delete()
          .eq('person_id', personId);

        // Insert new employment history
        if (data.person.employment_history.length > 0) {
          const employmentToInsert = data.person.employment_history.map((emp: any, index: number) => ({
            person_id: personId,
            title: emp.title || null,
            start_date: emp.starts_at ? new Date(emp.starts_at).toISOString().split('T')[0] : null,
            end_date: emp.ends_at ? new Date(emp.ends_at).toISOString().split('T')[0] : null,
            key: emp.key || `${personId}-${index}`,
            current: emp.current || false,
            organization_id: emp.organization_id || null,
            organization_name: emp.organization_name || null
          }));

          await supabase
            .from('people_employment_history')
            .insert(employmentToInsert);
        }
      }

      // Verify what was actually saved to the database
      const { data: savedPerson, error: verifyError } = await supabase
        .from('people')
        .select('id, apollo_contact_id, apollo_person_id')
        .eq('id', personId)
        .single();
      
      if (verifyError) {
        console.error('Error verifying saved person:', verifyError);
      } else {
        console.log('Verified saved person - apollo_contact_id:', savedPerson?.apollo_contact_id);
        console.log('Verified saved person - apollo_person_id:', savedPerson?.apollo_person_id);
      }

      // Create contact in Apollo if they don't already have a contact_id
      let apolloContactId = savedPerson?.apollo_contact_id || personData.apollo_contact_id;
      
      // Check if another person with the same email or apollo_person_id already has a contact_id
      if (!apolloContactId && data.person) {
        // Check by email first
        if (data.person.email) {
          const { data: existingContactByEmail } = await supabase
            .from('people')
            .select('apollo_contact_id')
            .eq('email', data.person.email)
            .not('apollo_contact_id', 'is', null)
            .limit(1)
            .maybeSingle();
          
          if (existingContactByEmail?.apollo_contact_id) {
            apolloContactId = existingContactByEmail.apollo_contact_id;
            console.log('Found existing contact_id by email:', apolloContactId);
          }
        }
        
        // If still no contact_id, check by apollo_person_id
        if (!apolloContactId && data.person.id) {
          const { data: existingContactByPersonId } = await supabase
            .from('people')
            .select('apollo_contact_id')
            .eq('apollo_person_id', data.person.id)
            .not('apollo_contact_id', 'is', null)
            .limit(1)
            .maybeSingle();
          
          if (existingContactByPersonId?.apollo_contact_id) {
            apolloContactId = existingContactByPersonId.apollo_contact_id;
            console.log('Found existing contact_id by apollo_person_id:', apolloContactId);
          }
        }
        
        // Update current person with found contact_id if we found one
        if (apolloContactId) {
          const { error: updateContactIdError } = await supabase
            .from('people')
            .update({ apollo_contact_id: apolloContactId })
            .eq('id', personId);
          
          if (updateContactIdError) {
            console.error('Error updating apollo_contact_id from existing contact:', updateContactIdError);
          } else {
            console.log('Updated person with existing contact_id:', apolloContactId);
          }
        }
      }
      
      // Only create in Apollo if we still don't have a contact_id
      // Following Apollo docs: Create contact from enriched person data to make it permanently accessible
      if (!apolloContactId && data.person) {
        try {
          // Map phone numbers - Apollo separates direct_phone and mobile_phone
          let directPhone: string | null = null;
          let mobilePhone: string | null = null;
          
          if (data.person.phone_numbers && Array.isArray(data.person.phone_numbers)) {
            for (const phone of data.person.phone_numbers) {
              const phoneNumber = phone.sanitized_number || phone.number;
              if (phoneNumber) {
                // Check phone type if available, otherwise use first as direct
                if (phone.type === 'mobile' || !directPhone) {
                  if (phone.type === 'mobile') {
                    mobilePhone = phoneNumber;
                  } else if (!directPhone) {
                    directPhone = phoneNumber;
                  }
                }
              }
            }
          }

          // Get email from Apollo - NEVER use user-provided email
          // Apollo only marks emails as "uploaded_by_customer" when YOU supply the email
          // If Apollo supplies it, email_source becomes "apollo_verified" or "apollo_guessed"
          let apolloEmail: string | null = null;
          
          // Step 1: Check for verified email in contact_emails array (preferred)
          if (data.person.contact_emails && Array.isArray(data.person.contact_emails)) {
            const verifiedEmail = data.person.contact_emails.find(
              (e: any) => e.email_status === "verified"
            )?.email;
            if (verifiedEmail) {
              apolloEmail = verifiedEmail;
              console.log('Using verified email from contact_emails:', apolloEmail);
            }
          }
          
          // Step 2: Fallback to person.email if no verified email found
          if (!apolloEmail && data.person.email) {
            apolloEmail = data.person.email;
            console.log('Using email from person.email:', apolloEmail);
          }
          
          // Step 3: Only create contact if we have an Apollo-provided email
          // DO NOT use body.email or any user-provided email
          if (!apolloEmail) {
            console.warn('No Apollo-provided email found, skipping contact creation');
            // Don't create contact without Apollo email to avoid "uploaded by your team" status
          } else {
            // Build contact data from enriched person (per Apollo documentation)
            // CRITICAL: Only use Apollo-provided email, never body.email
            const contactData: Record<string, any> = {
              api_key: APOLLO_API_KEY,
              first_name: data.person.first_name || null,
              last_name: data.person.last_name || null,
              email: apolloEmail, // Apollo's email - ensures proper email_source
              organization_name: data.person.organization?.name || null,
              website_url: data.person.organization?.website_url || null,
            };

            // Add account_id from resolved account ID (highest priority)
            if (resolvedApolloAccountId) {
              contactData.account_id = resolvedApolloAccountId;
            } else if (resolvedCompany?.apollo_account_id) {
              contactData.account_id = resolvedCompany.apollo_account_id;
            } else if (apolloAccountId) {
              contactData.account_id = apolloAccountId;
            }

            // Add optional fields only if they exist
            if (data.person.title) {
              contactData.title = data.person.title;
            }
            if (directPhone) {
              contactData.direct_phone = directPhone;
            }
            if (mobilePhone) {
              contactData.mobile_phone = mobilePhone;
            }
            // Note: Apollo does not run deduplication during contact creation
            // If same email/name/company exists, it will create a new contact

            console.log('Creating contact in Apollo with data:', JSON.stringify(contactData, null, 2));

            const createContactResponse = await fetch(APOLLO_CREATE_CONTACT_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': APOLLO_API_KEY
              },
              body: JSON.stringify(contactData)
            });

            if (!createContactResponse.ok) {
              const errorData = await createContactResponse.text();
              console.error('Apollo Create Contact API error:', createContactResponse.status, errorData);
              // Don't throw - continue even if contact creation fails
            } else {
              const contactResponse = await createContactResponse.json();
              console.log('Apollo Create Contact response:', JSON.stringify(contactResponse, null, 2));
              
              // Extract contact ID from response
              // Note: Apollo does not run deduplication - if duplicate exists, a new contact is created
              if (contactResponse.contact?.id) {
                apolloContactId = contactResponse.contact.id;
                console.log('Apollo contact created with ID:', apolloContactId);
                
                // Update Supabase record with the new contact_id
                const { error: updateContactIdError } = await supabase
                  .from('people')
                  .update({ apollo_contact_id: apolloContactId })
                  .eq('id', personId);

                if (updateContactIdError) {
                  console.error('Error updating apollo_contact_id in Supabase:', updateContactIdError);
                } else {
                  console.log('Successfully updated apollo_contact_id in Supabase:', apolloContactId);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error creating contact in Apollo:', error);
          // Don't throw - continue even if contact creation fails
        }
      } else {
        console.log('Contact already exists in Apollo with ID:', apolloContactId);
      }

      // Update existing Apollo contact with enriched data (whether it was just created or already existed)
      if (apolloContactId && data.person) {
        try {
          const enrichedContactPayload: Record<string, any> = {};

          // Add account_id from resolved account ID (highest priority)
          if (resolvedApolloAccountId) {
            enrichedContactPayload.account_id = resolvedApolloAccountId;
          } else if (resolvedCompany?.apollo_account_id) {
            enrichedContactPayload.account_id = resolvedCompany.apollo_account_id;
          } else if (apolloAccountId) {
            enrichedContactPayload.account_id = apolloAccountId;
          }

          // Only include fields if they exist
          if (data.person.first_name) enrichedContactPayload.first_name = data.person.first_name;
          if (data.person.last_name) enrichedContactPayload.last_name = data.person.last_name;
          if (data.person.title) enrichedContactPayload.title = data.person.title;
          if (data.person.organization?.name) enrichedContactPayload.organization_name = data.person.organization.name;
          if (data.person.organization?.website_url) enrichedContactPayload.website_url = data.person.organization.website_url;
          if (data.person.linkedin_url) enrichedContactPayload.linkedin_url = data.person.linkedin_url;
          if (data.person.headline) enrichedContactPayload.headline = data.person.headline;
          if (data.person.seniority) enrichedContactPayload.seniority = data.person.seniority;

          // Location fields
          if (data.person.city) enrichedContactPayload.city = data.person.city;
          if (data.person.state) enrichedContactPayload.state = data.person.state;
          if (data.person.country) enrichedContactPayload.country = data.person.country;

          // Pretty formatted address if possible
          const parts = [];
          if (data.person.city) parts.push(data.person.city);
          if (data.person.state) parts.push(data.person.state);
          if (data.person.country) parts.push(data.person.country);
          if (parts.length > 0) enrichedContactPayload.present_raw_address = parts.join(', ');

          // Map phone numbers - Apollo separates direct_phone and mobile_phone
          if (data.person.phone_numbers && Array.isArray(data.person.phone_numbers)) {
            let directPhone: string | null = null;
            let mobilePhone: string | null = null;
            
            for (const phone of data.person.phone_numbers) {
              const phoneNumber = phone.sanitized_number || phone.number;
              if (phoneNumber) {
                if (phone.type === 'mobile') {
                  mobilePhone = phoneNumber;
                } else if (!directPhone) {
                  directPhone = phoneNumber;
                }
              }
            }
            
            if (directPhone) enrichedContactPayload.direct_phone = directPhone;
            if (mobilePhone) enrichedContactPayload.mobile_phone = mobilePhone;
          }

          // Update email if Apollo provided a new/verified email
          let apolloEmail: string | null = null;
          if (data.person.contact_emails && Array.isArray(data.person.contact_emails)) {
            const verifiedEmail = data.person.contact_emails.find(
              (e: any) => e.email_status === "verified"
            )?.email;
            if (verifiedEmail) {
              apolloEmail = verifiedEmail;
            }
          }
          if (!apolloEmail && data.person.email) {
            apolloEmail = data.person.email;
          }
          if (apolloEmail) {
            enrichedContactPayload.email = apolloEmail;
          }

          // Patch the contact in Apollo with enriched data
          if (Object.keys(enrichedContactPayload).length > 0) {
            const patchResponse = await fetch(
              `https://api.apollo.io/api/v1/contacts/${apolloContactId}`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-cache",
                  "X-Api-Key": APOLLO_API_KEY
                },
                body: JSON.stringify(enrichedContactPayload)
              }
            );

            if (!patchResponse.ok) {
              const errorText = await patchResponse.text();
              console.error("Failed to patch Apollo contact:", patchResponse.status, errorText);
            } else {
              console.log("Successfully updated Apollo contact with enriched data");
            }
          }
        } catch (patchError) {
          console.error("Error patching existing Apollo contact:", patchError);
          // Don't throw - continue even if patch fails
        }
      }

      return NextResponse.json({
        success: true,
        message: existingPerson ? "Person updated successfully" : "Person created successfully",
        personId,
        apolloContactId: apolloContactId || null
      });

    } catch (error) {
      return NextResponse.json({ 
        error: "Failed to enrich lead data",
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ 
      error: "Failed to process the request",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 