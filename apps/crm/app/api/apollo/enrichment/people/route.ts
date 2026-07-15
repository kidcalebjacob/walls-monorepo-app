import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_MATCH_ENDPOINT = 'https://api.apollo.io/v1/people/match';
const APOLLO_ENRICH_ENDPOINT = 'https://api.apollo.io/v1/people/enrich';
const APOLLO_CREATE_CONTACT_ENDPOINT = 'https://api.apollo.io/api/v1/contacts';

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
    const { userId, companyId } = body;

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

      // Debug logging for contact_id
      console.log('Apollo response - person.contact_id:', data.person.contact_id);
      console.log('Apollo response - person.contact?.id:', data.person.contact?.id);
      console.log('Apollo response - person.contact:', JSON.stringify(data.person.contact, null, 2));
      console.log('Apollo response - full person object keys:', Object.keys(data.person));

      const supabase = await createClient();

      // Check if person already exists in Supabase by apollo_person_id
      let existingPerson = null;
      if (data.person.id) {
        const { data: personData, error: checkError } = await supabase
          .from('people')
          .select('id, status')
          .eq('apollo_person_id', data.person.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
          console.error('Error checking for existing person:', checkError);
        } else if (personData) {
          existingPerson = personData;
        }
      }

      // Map Apollo data to Supabase schema
      const personData: any = {
        apollo_person_id: data.person.id || null,
        apollo_contact_id: data.person.contact_id || data.person.contact?.id || null,
        first_name: data.person.first_name || null,
        last_name: data.person.last_name || null,
        email: data.person.email || null,
        phone: data.person.phone_numbers?.[0]?.number || null,
        title: data.person.title || null,
        linkedin_url: data.person.linkedin_url || null,
        company_id: companyId || null, // Use provided companyId from the company being viewed
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
          const departmentsToInsert = data.person.departments.map((dept: string) => ({
            person_id: personId,
            name: dept,
            apollo_name: dept
          }));

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
          const subdepartmentsToInsert = data.person.subdepartments.map((subdept: string) => ({
            person_id: personId,
            name: subdept,
            apollo_name: subdept
          }));

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
                
                // PATCH the new Apollo contact with enriched fields
                try {
                  const enrichedContactPayload: Record<string, any> = {};

                  // Only include fields if they exist
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

                  // pretty formatted address if possible
                  const parts = [];
                  if (data.person.city) parts.push(data.person.city);
                  if (data.person.state) parts.push(data.person.state);
                  if (data.person.country) parts.push(data.person.country);
                  if (parts.length > 0) enrichedContactPayload.present_raw_address = parts.join(', ');

                  // Patch the contact in Apollo
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
                      console.error("Failed to patch Apollo contact:", await patchResponse.text());
                    } else {
                      console.log("Successfully patched contact with enriched data");
                    }
                  }
                } catch (patchError) {
                  console.error("Apollo patch error:", patchError);
                }
                
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