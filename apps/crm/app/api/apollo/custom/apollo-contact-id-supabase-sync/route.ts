/**
 * Apollo Contact ID to Supabase Sync Route
 * 
 * PURPOSE:
 * This endpoint syncs contact data from Apollo.io to Supabase. It is a ONE-WAY sync:
 * Apollo → Supabase (read from Apollo, write to Supabase).
 * 
 * REQUIREMENTS:
 * - REQUIRES an Apollo contact ID in the request body
 * - Uses Apollo's "View a Contact" endpoint (GET /api/v1/contacts/{id})
 * - Requires a master API key (APOLLO_API_KEY)
 * 
 * FUNCTIONALITY:
 * 1. Accepts an Apollo contact ID
 * 2. Fetches complete contact data from Apollo API
 * 3. Creates or updates a person in Supabase based on:
 *    - apollo_contact_id (primary match)
 *    - apollo_person_id (fallback match)
 *    - Email (secondary fallback match)
 * 4. Syncs all related data to Supabase tables:
 *    - people (main table)
 *    - people_departments
 *    - people_subdepartments
 *    - people_employment_history
 *    - people_territories & people_territories_join
 * 5. Links person to company if organization_id exists
 * 
 * IMPORTANT:
 * - This endpoint does NOT perform person enrichment
 * - This endpoint does NOT sync data from Supabase to Apollo
 * - This endpoint ONLY works with Apollo contact IDs
 * - This is a custom sync endpoint with a single, specific purpose
 * 
 * USAGE:
 * POST /api/apollo/custom/apollo-contact-id-supabase-sync
 * Body: { "contactId": "66e34b81740c50074e3d1bd4" }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Person created" | "Person updated",
 *   "personId": "uuid",
 *   "apollo_contact_id": "66e34b81740c50074e3d1bd4"
 * }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = 'https://api.apollo.io/api/v1/contacts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Convert Apollo-style key (e.g. "marketing_manager") to display name (e.g. "Marketing Manager"). */
function apolloKeyToDisplayName(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  return s
    .replace(/_/g, ' ')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * When no company is found in DB, enrich via account sync (preferred) or organization sync and return companyId.
 * Priority: account_id (cheaper) then organization_id.
 */
async function enrichCompanyAndGetId(accountId: string | null, organizationId: string | null): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl?.trim()) {
    console.warn('[apollo-contact-id-supabase-sync] NEXT_PUBLIC_BASE_URL is not set; skipping company enrichment (cannot call account/organization sync)');
    return null;
  }
  if (!accountId?.trim() && !organizationId?.trim()) {
    console.log('[apollo-contact-id-supabase-sync] No account_id or organization_id in response, skipping company enrichment');
    return null;
  }
  if (accountId && accountId.trim()) {
    try {
      const res = await fetch(`${baseUrl}/api/apollo/custom/apollo-account-id-supabase-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountId.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.companyId) {
        console.log('[apollo-contact-id-supabase-sync] Company enriched via account sync', { companyId: data.companyId });
        return data.companyId;
      }
    } catch (err) {
      console.error('[apollo-contact-id-supabase-sync] Account sync fallback failed', err);
    }
  }
  if (organizationId && organizationId.trim()) {
    try {
      const res = await fetch(`${baseUrl}/api/apollo/custom/apollo-organization-id-supabase-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: organizationId.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.companyId) {
        console.log('[apollo-contact-id-supabase-sync] Company enriched via organization sync', { companyId: data.companyId });
        return data.companyId;
      }
    } catch (err) {
      console.error('[apollo-contact-id-supabase-sync] Organization sync fallback failed', err);
    }
  }
  return null;
}

function logDbError(
  table: string,
  operation: 'insert' | 'update',
  error: { code?: string; message?: string; details?: string },
  payload: Record<string, unknown>
) {
  console.error('[apollo-contact-id-supabase-sync] DB write failed', {
    table,
    operation,
    errorCode: error?.code ?? 'unknown',
    errorMessage: error?.message ?? 'unknown',
    errorDetails: error?.details ?? null,
    payloadKeys: Object.keys(payload),
    payloadSample: {
      ...payload,
      email: payload.email ? '[REDACTED]' : undefined,
      phone: payload.phone ? '[REDACTED]' : undefined,
    },
  });
}

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: 'Apollo API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { contactId } = await request.json();

    // REQUIRED: Contact ID must be provided - this endpoint only works with Apollo contact IDs
    if (!contactId || typeof contactId !== 'string' || contactId.trim() === '') {
      return NextResponse.json(
        { 
          error: 'Apollo contact ID is required',
          message: 'This endpoint requires an Apollo contact ID in the request body: { "contactId": "your-apollo-contact-id" }'
        },
        { status: 400 }
      );
    }

    // Call Apollo.io API to get contact data using View a Contact endpoint
    const response = await fetch(`${APOLLO_API_URL}/${contactId}`, {
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
    const contact = data.contact || data;

    if (!contact) {
      return NextResponse.json(
        { error: 'No contact data found' },
        { status: 404 }
      );
    }

    const apolloContactId = contact.id || contactId;
    const apolloPersonId = contact.person_id || null;
    const apolloOrgId = contact.organization_id || null;
    const contactEmail = contact.email || null;

    // First try to find by apollo_contact_id (unique constraint, most reliable)
    let matchingPerson = null;
    
    if (apolloContactId) {
      const { data: personByContactId, error: contactIdError } = await supabase
        .from('people')
        .select('*')
        .eq('apollo_contact_id', apolloContactId)
        .maybeSingle();

      if (contactIdError) {
        console.error("Error fetching person by Apollo contact ID:", contactIdError);
      } else if (personByContactId) {
        matchingPerson = personByContactId;
      }
    }

    // If not found by contact ID, try matching by apollo_person_id
    if (!matchingPerson && apolloPersonId) {
      const { data: personByPersonId, error: personIdError } = await supabase
        .from('people')
        .select('*')
        .eq('apollo_person_id', apolloPersonId)
        .maybeSingle();

      if (personIdError) {
        console.error("Error fetching person by Apollo person ID:", personIdError);
      } else if (personByPersonId) {
        matchingPerson = personByPersonId;
      }
    }

    // If still not found, try matching by email
    if (!matchingPerson && contactEmail) {
      const { data: personByEmail, error: emailError } = await supabase
        .from('people')
        .select('*')
        .eq('email', contactEmail)
        .maybeSingle();

      if (emailError) {
        console.error("Error fetching person by email:", emailError);
      } else if (personByEmail) {
        matchingPerson = personByEmail;
      }
    }

    // Handle company lookup and validation
    // ALWAYS check if a company exists with the contact's organization_id, regardless of current company_id
    // This ensures we link to companies that may have been added to our database since the last sync
    let companyId: string | null = null;
    
    if (apolloOrgId) {
      // Always look up company by apollo_organization_id first
      const { data: matchingCompany, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('apollo_organization_id', apolloOrgId)
        .maybeSingle();

      if (companyError) {
        console.error("Error fetching company by Apollo organization ID:", companyError);
      } else if (matchingCompany) {
        // Found a matching company - use it
        companyId = matchingCompany.id;
        console.log(`Found matching company for organization_id ${apolloOrgId}: ${companyId}`);
      } else {
        // No company found with this organization_id
        console.log(`No company found for organization_id ${apolloOrgId}`);
        
        // If person has a company_id, validate if it still matches
        // If the current company doesn't match the contact's organization_id, clear the relationship
        if (matchingPerson?.company_id) {
          const { data: currentCompany, error: currentCompanyError } = await supabase
            .from('companies')
            .select('id, apollo_organization_id')
            .eq('id', matchingPerson.company_id)
            .maybeSingle();

          if (currentCompanyError) {
            console.error("Error fetching current company:", currentCompanyError);
          } else if (currentCompany && currentCompany.apollo_organization_id !== apolloOrgId) {
            // Current company doesn't match - clear the relationship
            // This represents a company the contact moved away from
            companyId = null;
            console.log(`Clearing company_id - current company (${currentCompany.apollo_organization_id}) doesn't match contact's organization_id (${apolloOrgId})`);
          } else if (currentCompany && currentCompany.apollo_organization_id === apolloOrgId) {
            // Current company matches - keep it (shouldn't happen since we didn't find it above, but just in case)
            companyId = currentCompany.id;
          }
        }
      }
    } else {
      // No organization_id in contact - clear company relationship if person had one
      if (matchingPerson?.company_id) {
        companyId = null;
        console.log("Clearing company_id - no organization_id in contact");
      }
    }

    // No company in DB: enrich via account sync (preferred) or organization sync, then link person to company
    if (!companyId) {
      const accountId = contact.account_id ?? null;
      console.log('[apollo-contact-id-supabase-sync] No company match; attempting enrichment', {
        accountId: accountId ?? '(none)',
        organizationId: apolloOrgId ?? '(none)',
      });
      const resolved = await enrichCompanyAndGetId(
        typeof accountId === 'string' ? accountId : null,
        apolloOrgId
      );
      if (resolved) companyId = resolved;
    }

    if (companyId) {
      console.log('[apollo-contact-id-supabase-sync] Company match found in database; linking person to company', {
        companyId,
        organizationId: apolloOrgId ?? '(none)',
      });
    }

    // Extract phone number from phone_numbers array
    let phoneNumber: string | null = null;
    if (contact.phone_numbers && Array.isArray(contact.phone_numbers) && contact.phone_numbers.length > 0) {
      // Prefer sanitized_number, fallback to raw_number
      const firstPhone = contact.phone_numbers[0];
      phoneNumber = firstPhone.sanitized_number || firstPhone.raw_number || null;
    } else if (contact.sanitized_phone) {
      phoneNumber = contact.sanitized_phone;
    }

    // Map Apollo contact data to Supabase schema
    // Only include fields that Apollo provides, and only update if different from existing
    const personData: any = {
      last_enriched: new Date().toISOString(), // Always set to now when syncing
      last_apollo_update: contact.updated_at || new Date().toISOString(), // Use Apollo's updated_at timestamp
    };

    // Always update Apollo IDs
    // apollo_contact_id: Always set since we're syncing from a contact endpoint (contact.id)
    // apollo_person_id: Set if provided in response (contact.person_id), but don't overwrite with null
    personData.apollo_contact_id = apolloContactId;
    if (apolloPersonId) {
      // Only update apollo_person_id if contact.person_id is not null
      personData.apollo_person_id = apolloPersonId;
    }

    // Clear company_website since contact endpoint doesn't provide website information
    personData.company_website = null;

    // Only update fields if Apollo provides them AND they're different from existing
    const updateIfDifferent = (field: string, apolloValue: any) => {
      if (apolloValue !== null && apolloValue !== undefined && apolloValue !== '') {
        const existingValue = matchingPerson?.[field];
        if (existingValue !== apolloValue) {
          personData[field] = apolloValue;
        }
      }
    };

    updateIfDifferent('first_name', contact.first_name);
    updateIfDifferent('last_name', contact.last_name);
    updateIfDifferent('email', contactEmail);
    updateIfDifferent('phone', phoneNumber);
    updateIfDifferent('title', contact.title);
    updateIfDifferent('linkedin_url', contact.linkedin_url);
    updateIfDifferent('twitter_url', contact.twitter_url);
    updateIfDifferent('github_url', contact.github_url);
    updateIfDifferent('facebook_url', contact.facebook_url);
    updateIfDifferent('photo_url', contact.photo_url);
    updateIfDifferent('company_name', contact.organization_name);
    updateIfDifferent('apollo_organization_id', apolloOrgId);
    updateIfDifferent('city', contact.city);
    updateIfDifferent('state', contact.state);
    updateIfDifferent('country', contact.country);
    updateIfDifferent('headline', contact.headline);
    updateIfDifferent('seniority', contact.seniority);
    updateIfDifferent('time_zone', contact.time_zone);

    // Handle company_id - always set it when we have a companyId or need to clear it
    // For existing person: update if it changed (including setting to null if company doesn't match)
    // For new person: set if we found a matching company
    if (matchingPerson) {
      // For existing person, update company_id if it changed (including clearing it)
      // This handles: null -> companyId, companyId -> different companyId, companyId -> null
      const currentCompanyId = matchingPerson.company_id;
      const newCompanyId = companyId;
      
      // Update if they're different (handles null vs string, different UUIDs, etc.)
      if (currentCompanyId !== newCompanyId) {
        personData.company_id = newCompanyId;
        console.log(`Updating company_id from ${currentCompanyId} to ${newCompanyId}`);
      } else {
        console.log(`Company_id unchanged: ${currentCompanyId}`);
      }
    } else {
      // For new person, set company_id if we found a matching company
      personData.company_id = companyId || null;
      if (companyId) {
        console.log(`Setting company_id for new person: ${companyId}`);
      }
    }

    // Set is_contact to true (this is a contact) - only update if not already true
    if (!matchingPerson || matchingPerson.is_contact !== true) {
      personData.is_contact = true;
    }

    // Only set source and status for new records
    if (!matchingPerson) {
      personData.source = "apollo";
      personData.status = "New";
    }

    let personId: string;

    if (matchingPerson) {
      // Always update to refresh timestamps, but only update other fields if they changed
      const { error: updateError } = await supabase
        .from('people')
        .update(personData)
        .eq('id', matchingPerson.id);

      if (updateError) {
        logDbError('people', 'update', updateError, personData);
        throw new Error(`Error updating person: ${updateError.message}`);
      }

      personId = matchingPerson.id;
    } else {
      // Create new person with all Apollo contact data
      const { data: newPerson, error: insertError } = await supabase
        .from('people')
        .insert({
          ...personData,
          first_name: contact.first_name || null,
          last_name: contact.last_name || null,
          email: contactEmail || null,
          phone: phoneNumber || null,
          title: contact.title || null,
          linkedin_url: contact.linkedin_url || null,
          twitter_url: contact.twitter_url || null,
          github_url: contact.github_url || null,
          facebook_url: contact.facebook_url || null,
          photo_url: contact.photo_url || null,
          company_id: companyId || null,
          company_name: contact.organization_name || null,
          company_website: null, // Contact endpoint doesn't provide website information
          apollo_organization_id: apolloOrgId || null,
          city: contact.city || null,
          state: contact.state || null,
          country: contact.country || null,
          headline: contact.headline || null,
          seniority: contact.seniority || null,
          time_zone: contact.time_zone || null,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        const insertPayload = {
          ...personData,
          first_name: contact.first_name || null,
          last_name: contact.last_name || null,
          email: contactEmail || null,
          phone: phoneNumber || null,
          title: contact.title || null,
          linkedin_url: contact.linkedin_url || null,
          twitter_url: contact.twitter_url || null,
          github_url: contact.github_url || null,
          facebook_url: contact.facebook_url || null,
          photo_url: contact.photo_url || null,
          company_id: companyId || null,
          company_name: contact.organization_name || null,
          company_website: null,
          apollo_organization_id: apolloOrgId || null,
          city: contact.city || null,
          state: contact.state || null,
          country: contact.country || null,
          headline: contact.headline || null,
          seniority: contact.seniority || null,
          time_zone: contact.time_zone || null,
          created_at: new Date().toISOString(),
        };
        logDbError('people', 'insert', insertError, insertPayload);
        throw new Error(`Error creating person: ${insertError.message}`);
      }

      personId = newPerson.id;
    }

    // After updating/creating the main person record, sync related data to other tables
    // Note: The View a Contact endpoint may not include all enrichment data like departments,
    // subdepartments, or employment_history. These are typically available in the person enrichment endpoint.
    // However, we'll handle them if they exist in the contact response.

    // Handle departments (if available in contact response)
    if (personId && contact.departments && Array.isArray(contact.departments)) {
      // Delete existing departments for this person
      await supabase
        .from('people_departments')
        .delete()
        .eq('person_id', personId);

      // Insert new departments
      if (contact.departments.length > 0) {
        const departmentsToInsert = contact.departments.map((dept: string) => ({
          person_id: personId,
          name: apolloKeyToDisplayName(dept),
          apollo_name: dept,
        }));

        await supabase
          .from('people_departments')
          .insert(departmentsToInsert);
      }
    }

    // Handle subdepartments (if available in contact response)
    if (personId && contact.subdepartments && Array.isArray(contact.subdepartments)) {
      // Delete existing subdepartments for this person
      await supabase
        .from('people_subdepartments')
        .delete()
        .eq('person_id', personId);

      // Insert new subdepartments
      if (contact.subdepartments.length > 0) {
        const subdepartmentsToInsert = contact.subdepartments.map((subdept: string) => ({
          person_id: personId,
          name: apolloKeyToDisplayName(subdept),
          apollo_name: subdept,
        }));

        await supabase
          .from('people_subdepartments')
          .insert(subdepartmentsToInsert);
      }
    }

    // Handle employment history (if available in contact response)
    if (personId && contact.employment_history && Array.isArray(contact.employment_history)) {
      // Delete existing employment history for this person
      await supabase
        .from('people_employment_history')
        .delete()
        .eq('person_id', personId);

      // Insert new employment history
      if (contact.employment_history.length > 0) {
        const employmentToInsert = contact.employment_history.map((emp: any, index: number) => ({
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

    // Handle territories - use the country field from contact response
    // The country is saved to people.country AND also becomes a territory entry
    // ADD territories (don't delete existing ones - additive approach)
    if (personId && contact.country) {
      const countryName = contact.country.trim();
      
      if (countryName) {
        // Check if territory (country) already exists in people_territories
        let { data: existingTerritory, error: territoryError } = await supabase
          .from('people_territories')
          .select('id')
          .eq('name', countryName)
          .maybeSingle();

        if (territoryError && territoryError.code !== 'PGRST116') {
          console.error("Error fetching territory:", territoryError);
        } else {
          let territoryId: string | null = null;

          if (existingTerritory) {
            // Use existing territory
            territoryId = existingTerritory.id;
          } else {
            // Create new territory with the country name
            const { data: newTerritory, error: createError } = await supabase
              .from('people_territories')
              .insert({
                name: countryName,
              })
              .select('id')
              .single();

            if (createError) {
              console.error("Error creating territory:", createError);
              // Continue without creating territory join if territory creation failed
            } else {
              territoryId = newTerritory.id;
            }
          }

          // Check if join record already exists before creating
          if (territoryId) {
            const { data: existingJoin } = await supabase
              .from('people_territories_join')
              .select('id')
              .eq('person_id', personId)
              .eq('territories_id', territoryId)
              .maybeSingle();

            // Only create join if it doesn't already exist (additive approach)
            if (!existingJoin) {
              const { error: joinError } = await supabase
                .from('people_territories_join')
                .insert({
                  person_id: personId,
                  territories_id: territoryId,
                });

              if (joinError) {
                console.error("Error creating territory join:", joinError);
              }
            }
          }
        }
      }
    }

    // Get person's name for the response
    const personFirstName = matchingPerson?.first_name || personData.first_name || contact.first_name || null;
    const personLastName = matchingPerson?.last_name || personData.last_name || contact.last_name || null;
    const personName = personFirstName && personLastName
      ? `${personFirstName} ${personLastName}`
      : personFirstName || personLastName || null;

    return NextResponse.json({
      success: true,
      message: matchingPerson ? 'Person updated' : 'Person created',
      personId: personId,
      apollo_contact_id: apolloContactId,
      personName: personName
    });

  } catch (error) {
    console.error('Error syncing contact to Supabase:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync contact to Supabase',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

