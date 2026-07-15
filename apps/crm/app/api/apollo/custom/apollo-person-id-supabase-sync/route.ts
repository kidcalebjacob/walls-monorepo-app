/**
 * Apollo Person ID to Supabase Sync Route
 *
 * Uses Apollo's People Enrichment (match) endpoint to enrich by person ID or email, then syncs to Supabase.
 * Docs: https://api.apollo.io/api/v1/people/match — pass `id` (Apollo person ID) or `email` as query param.
 * Person IDs come from app.apollo.io/#/people/{personId}.
 *
 * POST /api/apollo/custom/apollo-person-id-supabase-sync
 * Body: { "personId": "67c952ba5b18f60001317caf" } OR { "email": "person@example.com" }
 *
 * Email-only: if Apollo match fails, falls back to inbox metadata + OpenAI for name, then
 * apollo-domain-supabase-sync for company from the email domain.
 * Apollo person match with no org/account: same domain company sync (Apollo org + Serper/OpenAI).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { extractEmailAddresses } from "@/utils/format-utils";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
/** People Enrichment endpoint: match by id returns full person (organization, contact, employment_history, etc.) */
const APOLLO_PEOPLE_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
/** Create a Contact: add person to team's Apollo account so we can store contact_id in Supabase */
const APOLLO_CREATE_CONTACT_URL = "https://api.apollo.io/api/v1/contacts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Convert Apollo-style key (e.g. "marketing_manager") to display name (e.g. "Marketing Manager"). */
function apolloKeyToDisplayName(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  return s
    .replace(/_/g, " ")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * When no company is found in DB, enrich via account sync (preferred) or organization sync and return companyId.
 * Priority: account_id (cheaper) then organization_id. Uses NEXT_PUBLIC_BASE_URL for internal fetch.
 */
async function enrichCompanyAndGetId(accountId: string | null, organizationId: string | null): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl?.trim()) {
    console.warn("[apollo-person-id-supabase-sync] NEXT_PUBLIC_BASE_URL is not set; skipping company enrichment (cannot call account/organization sync)");
    return null;
  }
  if (!accountId?.trim() && !organizationId?.trim()) {
    console.log("[apollo-person-id-supabase-sync] No account_id or organization_id in response, skipping company enrichment");
    return null;
  }
  if (accountId && accountId.trim()) {
    try {
      const res = await fetch(`${baseUrl}/api/apollo/custom/apollo-account-id-supabase-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountId.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.companyId) {
        console.log("[apollo-person-id-supabase-sync] Company enriched via account sync", { companyId: data.companyId });
        return data.companyId;
      }
      if (!res.ok) {
        console.warn("[apollo-person-id-supabase-sync] Account sync returned non-OK", { status: res.status, body: data });
      }
    } catch (err) {
      console.error("[apollo-person-id-supabase-sync] Account sync fallback failed", err);
    }
  }
  if (organizationId && organizationId.trim()) {
    try {
      const res = await fetch(`${baseUrl}/api/apollo/custom/apollo-organization-id-supabase-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organizationId.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.companyId) {
        console.log("[apollo-person-id-supabase-sync] Company enriched via organization sync", { companyId: data.companyId });
        return data.companyId;
      }
      if (!res.ok) {
        console.warn("[apollo-person-id-supabase-sync] Organization sync returned non-OK", { status: res.status, body: data });
      }
    } catch (err) {
      console.error("[apollo-person-id-supabase-sync] Organization sync fallback failed", err);
    }
  }
  return null;
}

/** Consumer / mailbox domains — no company row to infer from the email domain. */
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "msn.com",
  "ymail.com",
]);

function extractDomainFromEmail(normalizedEmail: string): string | null {
  const at = normalizedEmail.lastIndexOf("@");
  if (at < 0) return null;
  const domain = normalizedEmail
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

function shouldEnrichCompanyFromEmailDomain(domain: string): boolean {
  return !PERSONAL_EMAIL_DOMAINS.has(domain);
}

type EmailDomainCompanyResult = {
  companyId: string;
  companyName: string | null;
  companyWebsite: string | null;
  apolloOrganizationId: string | null;
};

/**
 * Enrich or link company by email domain using apollo-domain-supabase-sync
 * (Apollo organization enrich + Serper/OpenAI fallback when Apollo has no org).
 */
async function enrichCompanyByEmailDomain(
  normalizedEmail: string
): Promise<EmailDomainCompanyResult | null> {
  const domain = extractDomainFromEmail(normalizedEmail);
  if (!domain) {
    console.log("[apollo-person-id-supabase-sync] domain company sync: no domain in email");
    return null;
  }
  if (!shouldEnrichCompanyFromEmailDomain(domain)) {
    console.log("[apollo-person-id-supabase-sync] domain company sync: skipping personal email domain", {
      domain,
    });
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl?.trim()) {
    console.warn(
      "[apollo-person-id-supabase-sync] domain company sync: NEXT_PUBLIC_BASE_URL not set; skipping apollo-domain-supabase-sync"
    );
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/api/apollo/custom/apollo-domain-supabase-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      companyId?: string;
      companyName?: string;
      apollo_organization_id?: string | null;
      error?: string;
    };

    if (!res.ok || !data.success || !data.companyId) {
      console.warn("[apollo-person-id-supabase-sync] domain company sync failed", {
        domain,
        status: res.status,
        error: data.error,
      });
      return null;
    }

    const { data: companyRow } = await supabase
      .from("companies")
      .select("name, website, domain")
      .eq("id", data.companyId)
      .maybeSingle();

    const companyName = data.companyName ?? companyRow?.name ?? null;
    const companyWebsite =
      companyRow?.website ??
      (companyRow?.domain ? `https://${companyRow.domain}` : `https://${domain}`);

    console.log("[apollo-person-id-supabase-sync] domain company sync linked company", {
      domain,
      companyId: data.companyId,
      companyName,
    });

    return {
      companyId: data.companyId,
      companyName,
      companyWebsite,
      apolloOrganizationId: data.apollo_organization_id ?? null,
    };
  } catch (err) {
    console.error("[apollo-person-id-supabase-sync] domain company sync error", err);
    return null;
  }
}

const EMAIL_INBOX_FALLBACK_MAX_MESSAGES = 10;

function normalizePersonEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function canonicalFromField(from: string): string | null {
  const emails = extractEmailAddresses(from);
  return emails[0]?.toLowerCase() ?? null;
}

type EmailContextRow = {
  at: string;
  role: "sender" | "recipient";
  recipientType?: string;
  displayName: string | null;
  subject: string | null;
  snippet: string | null;
  direction: string | null;
};

function messageTimestamp(receivedAt: string | null, createdAt: string | null): string {
  return receivedAt || createdAt || new Date(0).toISOString();
}

async function collectEmailContextForPerson(normalizedEmail: string): Promise<EmailContextRow[]> {
  const rows: EmailContextRow[] = [];

  const { data: recipientRows, error: recipientErr } = await supabase
    .from("email_message_recipients")
    .select(
      `
      email,
      name,
      recipient_type,
      created_at,
      email_messages (
        id,
        subject,
        snippet,
        received_at,
        created_at,
        direction
      )
    `
    )
    .ilike("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(20);

  if (recipientErr) {
    console.error("[apollo-person-id-supabase-sync] inbox recipient lookup failed", { error: recipientErr });
  } else {
    for (const row of recipientRows ?? []) {
      const msg = row.email_messages as
        | {
            subject?: string | null;
            snippet?: string | null;
            received_at?: string | null;
            created_at?: string | null;
            direction?: string | null;
          }
        | null
        | undefined;
      if (!msg) continue;
      rows.push({
        at: messageTimestamp(msg.received_at ?? null, msg.created_at ?? row.created_at ?? null),
        role: "recipient",
        recipientType: row.recipient_type ?? undefined,
        displayName: row.name?.trim() || null,
        subject: msg.subject?.trim() || null,
        snippet: msg.snippet?.trim() || null,
        direction: msg.direction ?? null,
      });
    }
  }

  const { data: fromMessages, error: fromErr } = await supabase
    .from("email_messages")
    .select("from, from_name, subject, snippet, received_at, created_at, direction")
    .ilike("from", `%${normalizedEmail}%`)
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (fromErr) {
    console.error("[apollo-person-id-supabase-sync] inbox from-message lookup failed", { error: fromErr });
  } else {
    for (const msg of fromMessages ?? []) {
      const fromEmail = canonicalFromField(msg.from ?? "");
      if (fromEmail !== normalizedEmail) continue;
      rows.push({
        at: messageTimestamp(msg.received_at ?? null, msg.created_at ?? null),
        role: "sender",
        displayName: msg.from_name?.trim() || null,
        subject: msg.subject?.trim() || null,
        snippet: msg.snippet?.trim() || null,
        direction: msg.direction ?? null,
      });
    }
  }

  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const seen = new Set<string>();
  const deduped: EmailContextRow[] = [];
  for (const row of rows) {
    const key = `${row.at}|${row.role}|${row.displayName ?? ""}|${row.subject ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= EMAIL_INBOX_FALLBACK_MAX_MESSAGES) break;
  }

  return deduped;
}

function formatInboxContextForPrompt(normalizedEmail: string, context: EmailContextRow[]): string {
  if (context.length === 0) {
    return "(No matching messages were found in the inbox for this email address.)";
  }

  return context
    .map((row, i) => {
      const parts = [
        `#${i + 1}`,
        `Date: ${row.at}`,
        `Role: ${row.role}${row.recipientType ? ` (${row.recipientType})` : ""}`,
        `Direction: ${row.direction ?? "unknown"}`,
        `Display name: ${row.displayName ?? "(none)"}`,
        `Subject: ${row.subject ?? "(none)"}`,
        `Snippet: ${row.snippet ?? "(none)"}`,
      ];
      return parts.join("\n");
    })
    .join("\n\n");
}

async function inferPersonNameFromInboxContext(
  normalizedEmail: string,
  context: EmailContextRow[]
): Promise<{ firstName: string | null; lastName: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[apollo-person-id-supabase-sync] inbox fallback OpenAI skipped (OPENAI_API_KEY not set)");
    return { firstName: null, lastName: null };
  }

  const openai = new OpenAI({ apiKey });
  const contextText = formatInboxContextForPrompt(normalizedEmail, context);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            'You infer a person\'s legal-style first and last name from internal email metadata. The target email address is fixed. Use display names on messages where this person was sender or recipient (to/cc/bcc). Ignore names that clearly belong to other participants, generic labels (e.g. "Support", "Info"), or the user\'s own company staff unless they are unambiguously this person. Return strict JSON: {"first_name": string|null, "last_name": string|null}. Use null for unknown parts; do not invent names without evidence.',
        },
        {
          role: "user",
          content: `Target email: ${normalizedEmail}\n\nInbox context (up to ${EMAIL_INBOX_FALLBACK_MAX_MESSAGES} recent messages):\n${contextText}\n\nRespond with JSON only: {"first_name":"..."|null,"last_name":"..."|null}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return { firstName: null, lastName: null };

    const parsed = JSON.parse(raw) as { first_name?: string | null; last_name?: string | null };
    const firstName =
      typeof parsed.first_name === "string" && parsed.first_name.trim()
        ? parsed.first_name.trim()
        : null;
    const lastName =
      typeof parsed.last_name === "string" && parsed.last_name.trim()
        ? parsed.last_name.trim()
        : null;

    return { firstName, lastName };
  } catch (err) {
    console.error("[apollo-person-id-supabase-sync] inbox fallback OpenAI error", err);
    return { firstName: null, lastName: null };
  }
}

function buildInboxFallbackPersonName(firstName: string | null, lastName: string | null): string | null {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  return firstName || lastName || null;
}

/** Email-only enrich: when Apollo match fails, infer name from our inbox + OpenAI. */
async function tryEmailInboxFallbackResponse(rawEmail: string): Promise<NextResponse | null> {
  const normalizedEmail = normalizePersonEmail(rawEmail);
  if (!normalizedEmail.includes("@")) {
    console.log("[apollo-person-id-supabase-sync] inbox fallback skipped (invalid email)");
    return null;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log("[apollo-person-id-supabase-sync] inbox fallback skipped (OPENAI_API_KEY not set)");
    return null;
  }

  const context = await collectEmailContextForPerson(normalizedEmail);
  if (context.length === 0) {
    console.log("[apollo-person-id-supabase-sync] inbox fallback: no messages for email", {
      email: normalizedEmail,
    });
    return null;
  }

  const hasNameHint = context.some((row) => Boolean(row.displayName));
  if (!hasNameHint) {
    console.log("[apollo-person-id-supabase-sync] inbox fallback: messages but no display names", {
      email: normalizedEmail,
      messageCount: context.length,
    });
    return null;
  }

  console.log("[apollo-person-id-supabase-sync] inbox fallback inferring name", {
    email: normalizedEmail,
    messageCount: context.length,
  });

  const { firstName, lastName } = await inferPersonNameFromInboxContext(normalizedEmail, context);
  if (!firstName && !lastName) {
    console.log("[apollo-person-id-supabase-sync] inbox fallback: could not infer name", {
      email: normalizedEmail,
    });
    return null;
  }

  const companyFromDomain = await enrichCompanyByEmailDomain(normalizedEmail);

  const { data: existing, error: lookupErr } = await supabase
    .from("people")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (lookupErr) {
    console.error("[apollo-person-id-supabase-sync] inbox fallback people lookup failed", {
      error: lookupErr,
    });
    return null;
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    email: normalizedEmail,
    first_name: firstName,
    last_name: lastName,
    last_enriched: now,
    updated_at: now,
    person_type: "contact",
    is_contact: false,
    source: "email_inbox_inference",
    ...(companyFromDomain
      ? {
          company_id: companyFromDomain.companyId,
          company_name: companyFromDomain.companyName,
          company_website: companyFromDomain.companyWebsite,
          apollo_organization_id: companyFromDomain.apolloOrganizationId,
        }
      : {}),
  };

  let personId: string;
  let message: "Person created" | "Person updated";

  if (existing?.id) {
    const { error: updateErr } = await supabase.from("people").update(payload).eq("id", existing.id);
    if (updateErr) {
      console.error("[apollo-person-id-supabase-sync] inbox fallback people update failed", {
        error: updateErr,
      });
      return null;
    }
    personId = existing.id;
    message = "Person updated";
  } else {
    const { data: created, error: insertErr } = await supabase
      .from("people")
      .insert({ ...payload, status: "New", created_at: now })
      .select("id")
      .single();

    if (insertErr || !created?.id) {
      console.error("[apollo-person-id-supabase-sync] inbox fallback people insert failed", {
        error: insertErr,
      });
      return null;
    }
    personId = created.id;
    message = "Person created";
  }

  const personName = buildInboxFallbackPersonName(firstName, lastName);
  console.log("[apollo-person-id-supabase-sync] inbox fallback success", {
    personId,
    email: normalizedEmail,
    personName,
    message,
    companyId: companyFromDomain?.companyId ?? null,
  });

  return NextResponse.json({
    success: true,
    message,
    personId,
    personName,
    source: "email_inbox_inference",
    ...(companyFromDomain
      ? {
          companyId: companyFromDomain.companyId,
          companyName: companyFromDomain.companyName,
        }
      : {}),
  });
}

function shouldUseEmailInboxFallback(
  rawEmail: string | null,
  rawPersonId: string | null
): rawEmail is string {
  return Boolean(rawEmail?.trim() && !rawPersonId?.trim());
}

function logDbError(
  table: string,
  operation: "insert" | "update",
  error: { code?: string; message?: string; details?: string },
  payload: Record<string, unknown>
) {
  console.error("[apollo-person-id-supabase-sync] DB write failed", {
    table,
    operation,
    errorCode: error?.code ?? "unknown",
    errorMessage: error?.message ?? "unknown",
    errorDetails: error?.details ?? null,
    payloadKeys: Object.keys(payload),
    payloadSample: {
      ...payload,
      email: payload.email ? "[REDACTED]" : undefined,
      phone: payload.phone ? "[REDACTED]" : undefined,
    },
  });
}

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: "Apollo API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { personId, email: requestEmail } = await request.json();
    const rawPersonId =
      typeof personId === "string" ? personId.trim() : null;
    const rawEmail =
      typeof requestEmail === "string" ? requestEmail.trim() : null;

    if (!rawPersonId && !rawEmail) {
      return NextResponse.json(
        {
          error: "Apollo person ID or email is required",
          message:
            'Request body must include: { "personId": "your-apollo-person-id" } OR { "email": "person@example.com" }',
        },
        { status: 400 }
      );
    }

    // Build match params - prioritize personId if both are provided
    const matchParams = new URLSearchParams();
    if (rawPersonId) {
      matchParams.set("id", rawPersonId);
      console.log("[apollo-person-id-supabase-sync] Enriching person via People Match endpoint (by ID)", {
        personId: rawPersonId,
      });
    } else if (rawEmail) {
      matchParams.set("email", rawEmail);
      console.log("[apollo-person-id-supabase-sync] Enriching person via People Match endpoint (by email)", {
        email: rawEmail,
      });
    }

    const response = await fetch(`${APOLLO_PEOPLE_MATCH_URL}?${matchParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[apollo-person-id-supabase-sync] Apollo API error", {
        status: response.status,
        personId: rawPersonId ?? null,
        email: rawEmail ?? null,
        bodyPreview: responseText.slice(0, 500),
      });
      if (shouldUseEmailInboxFallback(rawEmail, rawPersonId)) {
        const fallbackResponse = await tryEmailInboxFallbackResponse(rawEmail);
        if (fallbackResponse) return fallbackResponse;
      }
      return NextResponse.json(
        {
          error: "Apollo API error",
          details: `Apollo returned ${response.status}. Check server logs for body.`,
          apolloStatus: response.status,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    let data: { person?: any };
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("[apollo-person-id-supabase-sync] Invalid JSON from Apollo", {
        personId: rawPersonId ?? null,
        email: rawEmail ?? null,
        bodyPreview: responseText.slice(0, 300),
      });
      if (shouldUseEmailInboxFallback(rawEmail, rawPersonId)) {
        const fallbackResponse = await tryEmailInboxFallbackResponse(rawEmail);
        if (fallbackResponse) return fallbackResponse;
      }
      return NextResponse.json(
        { error: "Invalid response from Apollo API" },
        { status: 502 }
      );
    }

    const person = data.person || data;
    if (!person || !person.id) {
      console.error("[apollo-person-id-supabase-sync] No person in response", {
        personId: rawPersonId ?? null,
        email: rawEmail ?? null,
        hasPerson: !!person,
        keys: person ? Object.keys(person) : [],
      });
      if (shouldUseEmailInboxFallback(rawEmail, rawPersonId)) {
        const fallbackResponse = await tryEmailInboxFallbackResponse(rawEmail);
        if (fallbackResponse) return fallbackResponse;
      }
      return NextResponse.json(
        {
          error: "No person data found in Apollo response",
          hint:
            "When enriching by email, we can infer a name from your inbox if OPENAI_API_KEY is set and matching messages exist.",
        },
        { status: 404 }
      );
    }

    const apolloPersonId = person.id;
    const contact = person.contact || {};
    const apolloOrgId =
      person.organization_id ||
      person.organization?.id ||
      contact.organization_id ||
      (() => {
        const hist = person.employment_history;
        if (Array.isArray(hist) && hist.length > 0) {
          const current = hist.find((e: any) => e.current);
          const entry = current || hist[0];
          return entry?.organization_id ?? null;
        }
        return null;
      })();
    const email =
      person.email ||
      person.primary_email ||
      null;

    let matchingPerson: any = null;
    const { data: byPersonId, error: byPersonErr } = await supabase
      .from("people")
      .select("*")
      .eq("apollo_person_id", apolloPersonId)
      .maybeSingle();

    if (byPersonErr) {
      console.error("[apollo-person-id-supabase-sync] Lookup by apollo_person_id failed", {
        error: byPersonErr,
        apolloPersonId,
      });
    } else if (byPersonId) {
      matchingPerson = byPersonId;
    }

    if (!matchingPerson && email) {
      const { data: byEmail, error: byEmailErr } = await supabase
        .from("people")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (byEmailErr) {
        console.error("[apollo-person-id-supabase-sync] Lookup by email failed", {
          error: byEmailErr,
        });
      } else if (byEmail) {
        matchingPerson = byEmail;
      }
    }

    let companyId: string | null = null;
    let companyFromDomain: EmailDomainCompanyResult | null = null;
    if (apolloOrgId) {
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .select("id")
        .eq("apollo_organization_id", apolloOrgId)
        .maybeSingle();

      if (companyErr) {
        console.error("[apollo-person-id-supabase-sync] Company lookup failed", {
          error: companyErr,
          apolloOrgId,
        });
      } else if (company) {
        companyId = company.id;
      }
    }

    // No company in DB: enrich via account sync (preferred) or organization sync, then link person to company
    if (!companyId) {
      const accountId = contact?.account_id ?? null;
      console.log("[apollo-person-id-supabase-sync] No company match; attempting enrichment", {
        accountId: accountId ?? "(none)",
        organizationId: apolloOrgId ?? "(none)",
      });
      const resolved = await enrichCompanyAndGetId(
        typeof accountId === "string" ? accountId : null,
        apolloOrgId
      );
      if (resolved) companyId = resolved;
    }

    // Still no company: derive domain from person email → apollo-domain-supabase-sync (Serper/OpenAI fallback)
    if (!companyId && email) {
      console.log(
        "[apollo-person-id-supabase-sync] No company via Apollo org/account; trying domain company sync",
        { email }
      );
      companyFromDomain = await enrichCompanyByEmailDomain(normalizePersonEmail(email));
      if (companyFromDomain) companyId = companyFromDomain.companyId;
    }

    if (companyId) {
      console.log("[apollo-person-id-supabase-sync] Company linked to person", {
        companyId,
        organizationId: companyFromDomain?.apolloOrganizationId ?? apolloOrgId ?? "(none)",
        viaDomainSync: Boolean(companyFromDomain),
      });
    }

    const org = person.organization || {};
    let phone: string | null = null;
    if (person.phone_numbers && Array.isArray(person.phone_numbers) && person.phone_numbers.length > 0) {
      const first = person.phone_numbers[0];
      phone = first.sanitized_number || first.raw_number || null;
    } else if (person.sanitized_phone) {
      phone = person.sanitized_phone;
    } else if (contact.sanitized_phone) {
      phone = contact.sanitized_phone;
    } else if (contact.phone_numbers && Array.isArray(contact.phone_numbers) && contact.phone_numbers.length > 0) {
      const first = contact.phone_numbers[0];
      phone = first.sanitized_number || first.raw_number || null;
    }

    const personData: Record<string, unknown> = {
      apollo_person_id: apolloPersonId,
      apollo_contact_id: person.contact_id || person.contact?.id || null,
      first_name: person.first_name ?? null,
      last_name: person.last_name ?? null,
      email: email ?? null,
      phone: phone ?? null,
      title: person.title ?? null,
      linkedin_url: person.linkedin_url ?? null,
      twitter_url: person.twitter_url ?? null,
      github_url: person.github_url ?? null,
      facebook_url: person.facebook_url ?? null,
      photo_url: person.photo_url ?? null,
      company_id: companyId ?? null,
      company_name:
        companyFromDomain?.companyName ?? org.name ?? person.organization_name ?? null,
      company_website:
        companyFromDomain?.companyWebsite ??
        org.website_url ??
        person.organization?.website_url ??
        null,
      apollo_organization_id: companyFromDomain?.apolloOrganizationId ?? apolloOrgId ?? null,
      city: person.city ?? null,
      state: person.state ?? null,
      country: person.country ?? null,
      headline: person.headline ?? null,
      seniority: person.seniority ?? null,
      time_zone: person.time_zone ?? contact.time_zone ?? null,
      last_enriched: new Date().toISOString(),
      last_apollo_update: person.updated_at || contact.updated_at || new Date().toISOString(),
      source: matchingPerson ? undefined : "apollo",
      status: matchingPerson?.status ?? "New",
      is_contact: false,
    };

    let resolvedPersonId: string;

    if (matchingPerson) {
      const { error: updateError } = await supabase
        .from("people")
        .update(personData)
        .eq("id", matchingPerson.id);

      if (updateError) {
        logDbError("people", "update", updateError, personData);
        return NextResponse.json(
          {
            error: "Failed to update person in database",
            details: updateError.message,
            code: updateError.code,
          },
          { status: 500 }
        );
      }
      resolvedPersonId = matchingPerson.id;
      console.log("[apollo-person-id-supabase-sync] Updated person", {
        personId: resolvedPersonId,
        apolloPersonId,
      });
    } else {
      const insertPayload = {
        ...personData,
        created_at: new Date().toISOString(),
      };
      const { data: newPerson, error: insertError } = await supabase
        .from("people")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        logDbError("people", "insert", insertError, insertPayload);
        return NextResponse.json(
          {
            error: "Failed to create person in database",
            details: insertError.message,
            code: insertError.code,
          },
          { status: 500 }
        );
      }
      resolvedPersonId = newPerson!.id;
      console.log("[apollo-person-id-supabase-sync] Created person", {
        personId: resolvedPersonId,
        apolloPersonId,
      });
    }

    // Sync related data from enrichment response (employment_history, departments, subdepartments)
    if (person.employment_history && Array.isArray(person.employment_history) && person.employment_history.length > 0) {
      await supabase.from("people_employment_history").delete().eq("person_id", resolvedPersonId);
      const employmentToInsert = person.employment_history.map((emp: any, index: number) => ({
        person_id: resolvedPersonId,
        title: emp.title || null,
        start_date: emp.start_date ? String(emp.start_date).split("T")[0] : null,
        end_date: emp.end_date ? String(emp.end_date).split("T")[0] : null,
        key: emp.key || emp.id || `${resolvedPersonId}-${index}`,
        current: emp.current ?? false,
        organization_id: emp.organization_id || null,
        organization_name: emp.organization_name || null,
      }));
      const { error: empErr } = await supabase.from("people_employment_history").insert(employmentToInsert);
      if (empErr) {
        console.error("[apollo-person-id-supabase-sync] employment_history insert failed", { error: empErr });
      }
    }
    if (person.departments && Array.isArray(person.departments)) {
      await supabase.from("people_departments").delete().eq("person_id", resolvedPersonId);
      if (person.departments.length > 0) {
        const departmentsToInsert = person.departments.map((dept: string) => ({
          person_id: resolvedPersonId,
          name: apolloKeyToDisplayName(dept),
          apollo_name: dept,
        }));
        const { error: deptErr } = await supabase.from("people_departments").insert(departmentsToInsert);
        if (deptErr) {
          console.error("[apollo-person-id-supabase-sync] people_departments insert failed", { error: deptErr });
        }
      }
    }
    if (person.subdepartments && Array.isArray(person.subdepartments)) {
      await supabase.from("people_subdepartments").delete().eq("person_id", resolvedPersonId);
      if (person.subdepartments.length > 0) {
        const subdepartmentsToInsert = person.subdepartments.map((subdept: string) => ({
          person_id: resolvedPersonId,
          name: apolloKeyToDisplayName(subdept),
          apollo_name: subdept,
        }));
        const { error: subErr } = await supabase.from("people_subdepartments").insert(subdepartmentsToInsert);
        if (subErr) {
          console.error("[apollo-person-id-supabase-sync] people_subdepartments insert failed", { error: subErr });
        }
      }
    }

    // people_territories + people_territories_join (from person.country; additive like contact sync)
    if (person.country && typeof person.country === "string") {
      const countryName = person.country.trim();
      if (countryName) {
        let { data: existingTerritory, error: territoryErr } = await supabase
          .from("people_territories")
          .select("id")
          .eq("name", countryName)
          .maybeSingle();

        if (territoryErr && territoryErr.code !== "PGRST116") {
          console.error("[apollo-person-id-supabase-sync] people_territories lookup failed", { error: territoryErr });
        } else {
          let territoryId: string | null = existingTerritory?.id ?? null;
          if (!territoryId) {
            const { data: newTerritory, error: createErr } = await supabase
              .from("people_territories")
              .insert({ name: countryName })
              .select("id")
              .single();
            if (createErr) {
              console.error("[apollo-person-id-supabase-sync] people_territories insert failed", { error: createErr });
            } else {
              territoryId = newTerritory?.id ?? null;
            }
          }
          if (territoryId) {
            const { data: existingJoin } = await supabase
              .from("people_territories_join")
              .select("id")
              .eq("person_id", resolvedPersonId)
              .eq("territories_id", territoryId)
              .maybeSingle();
            if (!existingJoin) {
              const { error: joinErr } = await supabase
                .from("people_territories_join")
                .insert({ person_id: resolvedPersonId, territories_id: territoryId });
              if (joinErr) {
                console.error("[apollo-person-id-supabase-sync] people_territories_join insert failed", { error: joinErr });
              }
            }
          }
        }
      }
    }

    // Person flow: if Apollo didn't return a contact_id, create a contact in Apollo so we can store it in Supabase
    let apolloContactIdFinal = person.contact_id || person.contact?.id || null;
    if (!apolloContactIdFinal) {
      try {
        const presentRawAddress = [person.city, person.state, person.country].filter(Boolean).join(", ") || undefined;
        const contactPayload: Record<string, unknown> = {
          first_name: person.first_name ?? undefined,
          last_name: person.last_name ?? undefined,
          organization_name: org.name ?? undefined,
          title: person.title ?? undefined,
          email: email ?? undefined,
          website_url: org.website_url ?? undefined,
          present_raw_address: presentRawAddress,
          run_dedupe: true,
        };
        if (phone) {
          contactPayload.direct_phone = phone;
        }
        const apolloAccountId = process.env.APOLLO_ACCOUNT_ID;
        if (apolloAccountId) {
          contactPayload.account_id = apolloAccountId;
        }
        if (person.linkedin_url) contactPayload.linkedin_url = person.linkedin_url;

        console.log("[apollo-person-id-supabase-sync] Creating contact in Apollo (person flow)", {
          first_name: contactPayload.first_name,
          last_name: contactPayload.last_name,
          organization_name: contactPayload.organization_name,
        });

        const createContactRes = await fetch(APOLLO_CREATE_CONTACT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": APOLLO_API_KEY,
          },
          body: JSON.stringify(contactPayload),
        });

        const createContactText = await createContactRes.text();
        if (!createContactRes.ok) {
          console.error("[apollo-person-id-supabase-sync] Apollo Create Contact failed", {
            status: createContactRes.status,
            body: createContactText.slice(0, 500),
          });
        } else {
          let contactResponse: { contact?: { id?: string } } | undefined;
          try {
            contactResponse = JSON.parse(createContactText) as { contact?: { id?: string } };
          } catch {
            console.error("[apollo-person-id-supabase-sync] Create Contact response not JSON", {
              bodyPreview: createContactText.slice(0, 200),
            });
          }
          if (contactResponse?.contact?.id) {
            apolloContactIdFinal = contactResponse.contact.id;
            console.log("[apollo-person-id-supabase-sync] Apollo contact created", {
              apollo_contact_id: apolloContactIdFinal,
            });
            const { error: updateContactErr } = await supabase
              .from("people")
              .update({ apollo_contact_id: apolloContactIdFinal })
              .eq("id", resolvedPersonId);
            if (updateContactErr) {
              console.error("[apollo-person-id-supabase-sync] Failed to save apollo_contact_id to Supabase", {
                error: updateContactErr,
              });
            }
          }
        }
      } catch (createContactErr) {
        console.error("[apollo-person-id-supabase-sync] Error creating Apollo contact", createContactErr);
      }
    }

    const firstName = person.first_name ?? matchingPerson?.first_name ?? null;
    const lastName = person.last_name ?? matchingPerson?.last_name ?? null;
    const personName =
      firstName && lastName
        ? `${firstName} ${lastName}`
        : firstName || lastName || null;

    return NextResponse.json({
      success: true,
      message: matchingPerson ? "Person updated" : "Person created",
      personId: resolvedPersonId,
      apollo_person_id: apolloPersonId,
      personName,
    });
  } catch (error) {
    console.error("[apollo-person-id-supabase-sync] Unexpected error", error);
    return NextResponse.json(
      {
        error: "Failed to sync person to Supabase",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
