import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Function to validate and clean field values without changing the field names
function sanitizeFieldValues(details: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(details)) {
    // Keep the original key name but clean the values if needed
    sanitized[key] = value && typeof value === 'object' 
      ? sanitizeFieldValues(value)
      : value;
  }

  return sanitized;
}

// Helper function to convert flat field names with dots into nested objects
function nestFields(obj: Record<string, any>) {
  const nested: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split('.');
    let current = nested;

    parts.forEach((part, idx) => {
      if (idx === parts.length - 1) {
        current[part] = value;
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    });
  }

  return nested;
}

export async function POST(request: NextRequest) {
  try {
    console.error('🔵 Starting create-recipient request');
    
    // Initialize Supabase client once at the start
    const cookieStore = cookies();
    console.error('🔍 All cookies:', cookieStore.getAll().reduce((acc, cookie) => {
      acc[cookie.name] = cookie.value;
      return acc;
    }, {} as Record<string, string>));
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Get and validate the raw auth cookie
    const rawCookie = cookieStore.getAll().find(c => c.name.includes("-auth-token"))?.value;
    if (!rawCookie) {
      console.error('🔴 No auth cookie found');
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error('🔍 Found auth cookie:', rawCookie.substring(0, 20) + '...');

    // Decode the base64 cookie and extract the access token
    let access_token;
    try {
      const decoded = JSON.parse(Buffer.from(rawCookie.split("base64-")[1], "base64").toString("utf-8"));
      access_token = decoded.access_token;
      console.error('🔵 Successfully decoded access token');
    } catch (e) {
      console.error('🔴 Failed to decode auth token from cookie', e);
      return NextResponse.json({ error: "Invalid auth token format" }, { status: 401 });
    }

    // Verify the session with the decoded access token
    const { data: { user }, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !user) {
      console.error('🔴 Invalid session:', authError);
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    console.error('🔵 Authenticated user:', { userId: user.id });

    let body;
    try {
      body = await request.json();
      console.error('🔵 Request body:', {
        body,
        headers: Object.fromEntries(request.headers.entries())
      });
    } catch (e) {
      console.error('🔴 Failed to parse request body:', e);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

  const { accountHolderName, currency, type, details: rawDetails, country, legalType } = body;

  if (!accountHolderName || !currency || !type || !rawDetails || !legalType) {
    console.error('🔴 Missing required parameters:', { accountHolderName, currency, type, rawDetails, legalType });
    return NextResponse.json({ error: "Missing required body parameters" }, { status: 400 });
  }

  // Normalize legal type to uppercase
  const normalizedLegalType = legalType.toUpperCase();
  if (normalizedLegalType !== "PRIVATE" && normalizedLegalType !== "BUSINESS") {
    console.error('🔴 Invalid legal type:', legalType);
    return NextResponse.json({ error: `Invalid legal type: ${legalType}. Must be "PRIVATE" or "BUSINESS"` }, { status: 400 });
  }

  // Clean the values but keep the original field names
  const sanitizedDetails = sanitizeFieldValues(rawDetails);
  
  // Log the values for debugging
  console.error('🔍 Field values:', {
    original: rawDetails,
    cleaned: sanitizedDetails
  });

  // Ensure specific field formats are correct
  if (sanitizedDetails.accountType) {
    sanitizedDetails.accountType = sanitizedDetails.accountType.toUpperCase();
  }
  if (sanitizedDetails.recipientType) {
    sanitizedDetails.recipientType = sanitizedDetails.recipientType.toUpperCase();
  }
  if (sanitizedDetails.province) {
    if (sanitizedDetails.province.length !== 2) {
      console.error('🔴 Invalid province code:', sanitizedDetails.province);
      return NextResponse.json({ error: "Province must be a 2-letter code" }, { status: 400 });
    }
    sanitizedDetails.province = sanitizedDetails.province.toUpperCase();
  }
  // Validate Canadian account fields (only if currency is CAD)
  if (currency.toUpperCase() === 'CAD') {
    // Required fields for CAD accounts
    const requiredFields = [
      'accountNumber',
      'institutionNumber',
      'transitNumber'
    ];
    
    // Check for name field (fullName for personal, businessName for business)
    const hasName = sanitizedDetails.fullName || sanitizedDetails.businessName;
    if (!hasName) {
      return NextResponse.json({ 
        error: "Name is required (fullName for personal, businessName for business)" 
      }, { status: 400 });
    }
    
    const missingFields = requiredFields.filter(field => !sanitizedDetails[field]);
    if (missingFields.length > 0) {
      console.error('🔴 Missing required fields for Canadian account:', {
        missing: missingFields,
        provided: Object.keys(sanitizedDetails),
        rawFields: Object.keys(rawDetails)
      });
      return NextResponse.json({ 
        error: `Missing required fields for Canadian account: ${missingFields.join(', ')}` 
      }, { status: 400 });
    }

    // Validate Canadian bank account details
    const accountNumber = sanitizedDetails.accountNumber?.replace(/\D/g, '');
    if (!accountNumber || accountNumber.length < 7 || accountNumber.length > 12) {
      console.error('🔴 Invalid accountNumber:', { provided: sanitizedDetails.accountNumber, cleaned: accountNumber });
      return NextResponse.json({ error: "Account number must be 7-12 digits" }, { status: 400 });
    }
    sanitizedDetails.accountNumber = accountNumber;

    const institutionNumber = sanitizedDetails.institutionNumber?.replace(/\D/g, '');
    if (!institutionNumber || institutionNumber.length !== 3) {
      console.error('🔴 Invalid institutionNumber:', { provided: sanitizedDetails.institutionNumber, cleaned: institutionNumber });
      return NextResponse.json({ error: "Institution number must be 3 digits" }, { status: 400 });
    }
    sanitizedDetails.institutionNumber = institutionNumber;

    const transitNumber = sanitizedDetails.transitNumber?.replace(/\D/g, '');
    if (!transitNumber || transitNumber.length !== 5) {
      console.error('🔴 Invalid transitNumber:', { provided: sanitizedDetails.transitNumber, cleaned: transitNumber });
      return NextResponse.json({ error: "Transit number must be 5 digits" }, { status: 400 });
    }
    sanitizedDetails.transitNumber = transitNumber;

    // Validate postal code format if provided (optional for CAD templates)
    if (sanitizedDetails.postalCode) {
      const postalCode = sanitizedDetails.postalCode?.replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postalCode)) {
        console.error('🔴 Invalid postalCode:', { provided: sanitizedDetails.postalCode, cleaned: postalCode });
        return NextResponse.json({ error: "Postal code must match format A1A 1A1" }, { status: 400 });
      }
      sanitizedDetails.postalCode = postalCode;
    }

    // Validate account type if provided (optional for CAD templates)
    if (sanitizedDetails.accountType && !['CHECKING', 'SAVINGS'].includes(sanitizedDetails.accountType.toUpperCase())) {
      console.error('🔴 Invalid accountType:', sanitizedDetails.accountType);
      return NextResponse.json({ error: "accountType must be 'CHECKING' or 'SAVINGS'" }, { status: 400 });
    }
    if (sanitizedDetails.accountType) {
      sanitizedDetails.accountType = sanitizedDetails.accountType.toUpperCase();
    }

    // Log final details for verification
    console.error('🔍 Final Canadian bank details:', {
      accountNumber: `${accountNumber.length} digits`,
      institutionNumber,
      transitNumber,
      hasName: !!hasName,
    });
  }

  // Extract address details before transforming for Wise API
  // This will be saved separately in address_details column
  const addressDetails = {
    address: sanitizedDetails.address || '',
    city: sanitizedDetails.city || '',
    state: sanitizedDetails.state || '',
    postCode: sanitizedDetails.postCode || '',
    country: sanitizedDetails.country || country || '',
  };

  // Extract contact email and recipient name for Supabase
  const contactEmail = sanitizedDetails.contactEmail || sanitizedDetails.email || '';
  const recipientName = accountHolderName; // This is already the business/person name

  // Log the final sanitized details for verification
  // Use the sanitized details directly as they already have the correct wise_name fields
  let finalDetails = sanitizedDetails;
  let wiseType = type;

  // Special handling for USD accounts - Wise API requires specific field names and structure
  if (currency.toUpperCase() === 'USD') {
    wiseType = 'ABA'; // USD accounts use 'ABA' type, not 'usd'
    
    // Transform USD-specific fields to Wise API format
    const usdDetails: any = {
      legalType: normalizedLegalType,
      abartn: finalDetails.routingNumber || finalDetails.abartn, // Map routingNumber to abartn
      accountNumber: finalDetails.accountNumber,
      accountType: finalDetails.accountType?.toUpperCase() || 'CHECKING',
      email: finalDetails.contactEmail || finalDetails.email, // Map contactEmail to email
    };

    // Structure address properly for Wise API
    if (finalDetails.address || finalDetails.city || finalDetails.postCode) {
      usdDetails.address = {
        firstLine: finalDetails.address || '',
        city: finalDetails.city || '',
        state: finalDetails.state || finalDetails.city || '', // State is required, fallback to city if missing
        postCode: finalDetails.postCode || '',
        countryCode: 'US', // Always US for USD accounts
      };
    }

    finalDetails = usdDetails;
  } else if (currency.toUpperCase() === 'GBP') {
    wiseType = 'sort_code'; // GBP accounts use 'sort_code' type, not 'gbp'
    
    // Clean sort code - remove dashes and spaces
    const cleanSortCode = (finalDetails.sortCode || '').replace(/[-\s]/g, '');
    
    // Transform GBP-specific fields to Wise API format
    const gbpDetails: any = {
      legalType: normalizedLegalType,
      sortCode: cleanSortCode,
      accountNumber: finalDetails.accountNumber,
    };

    finalDetails = gbpDetails;
  } else {
    // For other currencies, use the type directly and nest fields
    finalDetails = {
      ...nestFields(finalDetails),
      legalType: normalizedLegalType
    };
  }
  
  console.error('🔍 Using payment type:', {
    wiseType,
    currency: currency.toUpperCase(),
    legal_type: normalizedLegalType,
    type_from_request: type
  });

  const requestPayload = {
    currency,
    type: wiseType,  // Use the correct type (ABA for USD, etc.)
    profile: process.env.WISE_PROFILE_ID!,
    accountHolderName,
    ownedByCustomer: false,
    details: finalDetails
  };

  console.error('🔍 Final request payload:', requestPayload);
  console.error('🔍 Wise API token exists?', !!process.env.WISE_API_TOKEN);

  let wiseResponse;
    try {
      console.error('🔵 Making Wise API request');
      wiseResponse = await fetch("https://api.transferwise.com/v1/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WISE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-idempotence-uuid": crypto.randomUUID()
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (error) {
      console.error('🔴 Wise API network error:', error);
      return NextResponse.json({ error: "Failed to connect to Wise API" }, { status: 500 });
    }

    let wiseData;
    try {
      const responseText = await wiseResponse.text();
      if (!wiseResponse.ok) {
        let parsedError;
        try {
          const parsed = JSON.parse(responseText);
          console.error('🔴 Wise API Error Details:', {
            ...parsed,
            status: wiseResponse.status,
            statusText: wiseResponse.statusText,
            fullRequest: requestPayload,
            headers: Object.fromEntries(wiseResponse.headers.entries())
          });
          // Convert errors array to readable message
          parsedError = parsed.errors?.map((e: any) => e.message).join("; ") || parsed;
        } catch (e) {
          console.error('🔴 Failed to parse error response:', responseText);
          parsedError = responseText;
        }
        
        return NextResponse.json({ error: parsedError }, { status: wiseResponse.status });
      }
      
      try {
        wiseData = JSON.parse(responseText);
      } catch (e) {
        console.error('🔴 Failed to parse Wise response:', responseText);
        return NextResponse.json({ error: "Invalid response from Wise API" }, { status: 500 });
      }
    } catch (error) {
      console.error('🔴 Error handling Wise response:', error);
      return NextResponse.json({ error: "Failed to process Wise response" }, { status: 500 });
    }

    const wiseAccountId = wiseData.id;
    console.error('✅ Wise account created with ID:', wiseAccountId);
    
    if (!wiseAccountId) {
      console.error('🔴 No account ID in Wise response:', wiseData);
      return NextResponse.json({ error: "Invalid response from Wise API" }, { status: 500 });
    }

    try {
      console.error('🔵 Saving to database');
      const { error: upsertError } = await supabase.from("wise_recipients").upsert({
        user_id: user.id,
        wise_recipient_id: wiseAccountId,
        payout_currency: currency,
        payout_country: country,
        payout_type: wiseType,
        bank_details: finalDetails,
        legal_type: normalizedLegalType,
        country: country,
        address_details: addressDetails,
        contact_email: contactEmail,
        recipient_name: recipientName,
        kyc_status: null,
        is_kyc_complete: false,
        can_receive_payments: false,
        last_account_requirements: null,
        last_requirements_checked_at: null,
      }, {
        onConflict: 'user_id'
      });

      if (upsertError) {
        console.error('🔴 Database error:', upsertError);
        return NextResponse.json({ error: "Failed to save recipient details" }, { status: 500 });
      }
    } catch (error) {
      console.error('🔴 Unexpected database error:', error);
      return NextResponse.json({ error: "Failed to save recipient details" }, { status: 500 });
    }

    return NextResponse.json({ 
      wiseAccountId, 
      payment_type: wiseType,
      legalType: normalizedLegalType,
      currency,
      country 
    });
  } catch (error) {
    console.error('🧨 Outer catch - create-recipient crashed:', error);
    return NextResponse.json({ error: "Server crashed creating recipient" }, { status: 500 });
  }
}

