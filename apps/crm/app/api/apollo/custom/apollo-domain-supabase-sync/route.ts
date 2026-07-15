import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { syncCompanySocialUrls } from "@/lib/company-social";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_MASTER_API_KEY = process.env.APOLLO_MASTER_API_KEY || APOLLO_API_KEY;
const APOLLO_ORG_ENRICH_URL = "https://api.apollo.io/v1/organizations/enrich";
const APOLLO_CREATE_ACCOUNT_URL = "https://api.apollo.io/api/v1/accounts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Normalize a domain or URL down to a bare domain
const normalizeUrl = (url: string): string => {
  if (!url) return "";
  try {
    let n = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    n = n.split("/")[0].toLowerCase().trim();
    return n;
  } catch {
    return url.toLowerCase().trim();
  }
};

/** Serper organic result shape */
interface SerperOrganicItem {
  title?: string;
  link?: string;
  snippet?: string;
}

async function serperSearchForCompanyDomain(domain: string, num: number): Promise<SerperOrganicItem[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  const query = `${domain} company`;
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { organic?: SerperOrganicItem[] };
    return Array.isArray(data.organic) ? data.organic.filter((r) => r.link) : [];
  } catch {
    return [];
  }
}

function placeholderCompanyNameFromDomain(domain: string): string {
  const leaf = domain.split(".")[0]?.trim() || domain;
  if (!leaf) return domain;
  return leaf
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function inferCompanyNameAndIndustryFromSerper(
  normalizedDomain: string,
  organic: SerperOrganicItem[]
): Promise<{ name: string; industry: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { name: placeholderCompanyNameFromDomain(normalizedDomain), industry: null };
  }
  const openai = new OpenAI({ apiKey });
  const resultsText = organic.length
    ? organic
        .slice(0, 8)
        .map(
          (r, i) =>
            `#${i + 1}\nTitle: ${r.title ?? ""}\nLink: ${r.link ?? ""}\nSnippet: ${r.snippet ?? ""}`
        )
        .join("\n\n")
    : "(No organic web results were returned for this search.)";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            'You extract structured company facts from web search snippets. The canonical company domain is fixed — do not invent a different domain. Return strict JSON with keys: "company_name" (string: best official or brand name for the business at this domain) and "industry" (string: a concise industry label such as "Enterprise Software", "Healthcare", "Retail", or null only if truly unknown). Prefer snippets that clearly refer to this domain.',
        },
        {
          role: "user",
          content: `Domain (canonical): ${normalizedDomain}\n\nSearch results:\n${resultsText}\n\nRespond with JSON only: {"company_name":"...","industry":"..." or null}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return { name: placeholderCompanyNameFromDomain(normalizedDomain), industry: null };
    const parsed = JSON.parse(raw) as { company_name?: string; industry?: string | null };
    const name =
      typeof parsed.company_name === "string" && parsed.company_name.trim()
        ? parsed.company_name.trim()
        : placeholderCompanyNameFromDomain(normalizedDomain);
    let industry: string | null = null;
    if (typeof parsed.industry === "string" && parsed.industry.trim()) {
      industry = parsed.industry.trim();
    } else if (parsed.industry === null) {
      industry = null;
    }
    return { name, industry };
  } catch (err) {
    console.error("[apollo-domain-supabase-sync] Fallback OpenAI parse error", err);
    return { name: placeholderCompanyNameFromDomain(normalizedDomain), industry: null };
  }
}

/**
 * When Apollo has no org for the domain: Serper + OpenAI to fill name, domain, website, industry on `companies` only.
 * Requires SERPER_API_KEY and OPENAI_API_KEY.
 */
async function trySerperOpenAiCompaniesFallback(
  normalizedDomain: string
): Promise<NextResponse | null> {
  if (!process.env.SERPER_API_KEY || !process.env.OPENAI_API_KEY) {
    console.log(
      "[apollo-domain-supabase-sync] Serper/OpenAI fallback skipped (set SERPER_API_KEY and OPENAI_API_KEY)"
    );
    return null;
  }

  const organic = await serperSearchForCompanyDomain(normalizedDomain, 8);
  const inferred = await inferCompanyNameAndIndustryFromSerper(normalizedDomain, organic);
  const website = `https://${normalizedDomain}`;

  const companyPayload = {
    name: inferred.name,
    domain: normalizedDomain,
    website,
    industry: inferred.industry,
    last_enriched: new Date().toISOString(),
  };

  let matchingCompany: { id: string; apollo_account_id?: string | null } | null = null;

  const { data: byCompanyDomain } = await supabase
    .from("companies")
    .select("id, apollo_account_id")
    .eq("domain", normalizedDomain)
    .limit(1);
  if (byCompanyDomain?.[0]) matchingCompany = byCompanyDomain[0];

  if (!matchingCompany) {
    const { data: byDomRow } = await supabase
      .from("companies_domains")
      .select("company_id")
      .eq("domain", normalizedDomain)
      .limit(1)
      .maybeSingle();
    if (byDomRow?.company_id) {
      const { data: c } = await supabase
        .from("companies")
        .select("id, apollo_account_id")
        .eq("id", byDomRow.company_id)
        .single();
      if (c) matchingCompany = c;
    }
  }

  let companyId: string;
  if (matchingCompany) {
    const { error: updateError } = await supabase
      .from("companies")
      .update(companyPayload)
      .eq("id", matchingCompany.id);
    if (updateError) {
      console.error("[apollo-domain-supabase-sync] Fallback company update error", updateError);
      return null;
    }
    companyId = matchingCompany.id;
  } else {
    const { data: newCompany, error: insertError } = await supabase
      .from("companies")
      .insert({ ...companyPayload, created_at: new Date().toISOString() })
      .select("id")
      .single();
    if (insertError) {
      console.error("[apollo-domain-supabase-sync] Fallback company insert error", insertError);
      return null;
    }
    companyId = newCompany!.id;
  }

  return NextResponse.json({
    success: true,
    message: matchingCompany ? "Company updated" : "Company created",
    companyId,
    companyName: companyPayload.name,
    apollo_organization_id: null,
    apollo_account_id: matchingCompany?.apollo_account_id ?? null,
    source: "serper_openai_fallback",
  });
}

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json({ error: "Apollo API key not configured" }, { status: 500 });
  }

  try {
    const { domain, companyId: requestedCompanyId } = await request.json();
    const rawDomain = typeof domain === "string" ? domain.trim() : "";

    if (!rawDomain) {
      return NextResponse.json(
        {
          error: "Domain is required",
          message: 'Body: { "domain": "example.com" }',
        },
        { status: 400 }
      );
    }

    const normalizedDomain = normalizeUrl(rawDomain);

    // 1) Enrich organization in Apollo by domain
    const enrichRes = await fetch(APOLLO_ORG_ENRICH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({ domain: normalizedDomain }),
    });

    const enrichText = await enrichRes.text();
    if (!enrichRes.ok) {
      console.error("[apollo-domain-supabase-sync] Apollo org enrich error", {
        status: enrichRes.status,
        domain: normalizedDomain,
        body: enrichText.slice(0, 400),
      });
      return NextResponse.json(
        { error: "Apollo organization enrich error", details: `Status ${enrichRes.status}` },
        { status: enrichRes.status >= 500 ? 502 : enrichRes.status }
      );
    }

    let enrichData: { organization?: any };
    try {
      enrichData = JSON.parse(enrichText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON from Apollo organization enrich" }, { status: 502 });
    }

    const organization = enrichData.organization || enrichData;
    if (!organization || !organization.id) {
      const fallbackResponse = await trySerperOpenAiCompaniesFallback(normalizedDomain);
      if (fallbackResponse) return fallbackResponse;
      return NextResponse.json(
        {
          error: "No organization data found for domain",
          domain: normalizedDomain,
          hint: "Set SERPER_API_KEY and OPENAI_API_KEY to create a minimal company row from web search when Apollo has no match.",
        },
        { status: 404 }
      );
    }

    const apolloWebsite = organization.website_url || "";
    const apolloDomain = organization.primary_domain || normalizeUrl(apolloWebsite) || normalizedDomain;
    const apolloOrgId = organization.id;

    // 2) Find or create the company in Supabase
    let matchingCompany: { id: string; name?: string; website?: string; apollo_account_id?: string | null } | null = null;

    if (requestedCompanyId) {
      const { data: companyById, error: companyByIdError } = await supabase
        .from("companies")
        .select("id, name, website, apollo_account_id")
        .eq("id", requestedCompanyId)
        .maybeSingle();

      if (companyByIdError) {
        throw new Error(`Error fetching company: ${companyByIdError.message}`);
      }

      if (!companyById) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }

      matchingCompany = companyById;
    }

    // Try by apollo_organization_id first (strongest key)
    if (!matchingCompany) {
      const { data: companyByApolloId, error: apolloIdError } = await supabase
        .from("companies")
        .select("id, name, website, apollo_account_id")
        .eq("apollo_organization_id", apolloOrgId)
        .maybeSingle();

      if (!apolloIdError && companyByApolloId) matchingCompany = companyByApolloId;
    }

    if (!matchingCompany && apolloDomain) {
      const { data: companyByDomain } = await supabase
        .from("companies")
        .select("id, name, website, apollo_account_id")
        .eq("domain", apolloDomain)
        .maybeSingle();
      if (companyByDomain) matchingCompany = companyByDomain;
    }

    if (!matchingCompany && normalizedDomain) {
      const { data: companyByRequestDomain } = await supabase
        .from("companies")
        .select("id, name, website, apollo_account_id")
        .eq("domain", normalizedDomain)
        .maybeSingle();
      if (companyByRequestDomain) matchingCompany = companyByRequestDomain;
    }

    // Fallback: companies_domains by domain
    if (!matchingCompany && apolloDomain) {
      const { data: byDomain } = await supabase
        .from("companies_domains")
        .select("company_id")
        .eq("domain", apolloDomain)
        .limit(1)
        .maybeSingle();
      if (byDomain?.company_id) {
        const { data: c } = await supabase
          .from("companies")
          .select("id, name, website, apollo_account_id")
          .eq("id", byDomain.company_id)
          .single();
        if (c) matchingCompany = c;
      }
    }

    const companyData: any = {
      name: matchingCompany?.name || organization.name || "Unnamed Company",
      apollo_organization_id: apolloOrgId || null,
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

    let companyId: string;
    if (matchingCompany) {
      const { error: updateError } = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", matchingCompany.id);
      if (updateError) throw new Error(updateError.message);
      companyId = matchingCompany.id;
    } else {
      const { data: newCompany, error: insertError } = await supabase
        .from("companies")
        .insert({ ...companyData, created_at: new Date().toISOString() })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      companyId = newCompany!.id;
    }

    // companies_domains
    if (apolloDomain && companyId) {
      const { data: existingDomain } = await supabase
        .from("companies_domains")
        .select("id")
        .eq("company_id", companyId)
        .eq("domain", apolloDomain)
        .maybeSingle();
      if (existingDomain) {
        await supabase
          .from("companies_domains")
          .update({ is_primary: true, url: apolloWebsite, is_apollo_org_domain: true })
          .eq("id", existingDomain.id);
      } else {
        await supabase.from("companies_domains").insert({
          company_id: companyId,
          domain: apolloDomain,
          is_primary: true,
          url: apolloWebsite,
          is_apollo_org_domain: true,
        });
      }
    }

    // companies_keywords
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

    // companies_technologies & join
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

    // companies_headcount
    if (companyId && organization.departmental_head_count && typeof organization.departmental_head_count === "object") {
      const entries = Object.entries(organization.departmental_head_count).filter(
        ([, c]) => c != null && c !== ""
      );
      const { data: existingHeadcount } = await supabase
        .from("companies_headcount")
        .select("id, department")
        .eq("company_id", companyId);
      const existingDepts = new Map((existingHeadcount || []).map((r) => [r.department, r.id]));
      await Promise.all(
        entries.map(async ([dept, count]) => {
          const headcount = parseInt(String(count)) || 0;
          const id = existingDepts.get(dept);
          if (id) {
            await supabase
              .from("companies_headcount")
              .update({ headcount, source: "apollo" })
              .eq("id", id);
          } else {
            await supabase
              .from("companies_headcount")
              .insert({ company_id: companyId, department: dept, headcount, source: "apollo" });
          }
        })
      );
    }

    // companies_suborganizations
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

    // companies_funding_events
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
      const companyName = companyData.name || organization.name || "Unknown";
      await syncCompanySocialUrls(supabase, companyId, companyName, {
        linkedin: organization.linkedin_url,
        twitter: organization.twitter_url,
        facebook: organization.facebook_url,
      });
    }

    // Optionally create an Apollo Account from enriched organization if we don't have one yet
    let apolloAccountId: string | null = matchingCompany?.apollo_account_id ?? null;
    if (companyId && !apolloAccountId && APOLLO_MASTER_API_KEY) {
      const accountName = companyData.name || organization.name || "Unnamed Company";
      const accountDomain = apolloDomain || null;
      const accountPhone = organization.phone || organization.primary_phone?.number || null;
      const rawAddress =
        organization.raw_address ||
        [organization.city, organization.state, organization.country].filter(Boolean).join(", ") ||
        null;

      const accountPayload: Record<string, string> = {
        name: accountName,
      };
      if (accountDomain) accountPayload.domain = accountDomain;
      if (accountPhone) accountPayload.phone = accountPhone;
      if (rawAddress) accountPayload.raw_address = rawAddress;

      try {
        const createRes = await fetch(APOLLO_CREATE_ACCOUNT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": APOLLO_MASTER_API_KEY,
          },
          body: JSON.stringify(accountPayload),
        });

        const createText = await createRes.text();
        if (createRes.ok) {
          try {
            const createData = JSON.parse(createText);
            const newAccountId = createData.account?.id;
            if (newAccountId) {
              const { error: updateAccErr } = await supabase
                .from("companies")
                .update({ apollo_account_id: newAccountId })
                .eq("id", companyId);
              if (!updateAccErr) apolloAccountId = newAccountId;
              else console.error("[apollo-domain-supabase-sync] Failed to set apollo_account_id", updateAccErr);
            }
          } catch {
            console.error(
              "[apollo-domain-supabase-sync] Invalid JSON from Create Account",
              createText.slice(0, 200)
            );
          }
        } else {
          console.error("[apollo-domain-supabase-sync] Create Account failed", {
            status: createRes.status,
            body: createText.slice(0, 400),
          });
        }
      } catch (err) {
        console.error("[apollo-domain-supabase-sync] Create Account request error", err);
      }
    }

    const companyName = companyData.name || organization.name || null;
    return NextResponse.json({
      success: true,
      message: matchingCompany ? "Company updated" : "Company created",
      companyId,
      apollo_organization_id: apolloOrgId,
      apollo_account_id: apolloAccountId,
      companyName,
    });
  } catch (error) {
    console.error("[apollo-domain-supabase-sync] Error", error);
    return NextResponse.json(
      {
        error: "Failed to sync organization by domain",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

