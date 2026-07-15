/**
 * Apollo Organization ID to Supabase Sync
 * 1. GET https://api.apollo.io/api/v1/organizations/{id} then upsert company + related tables.
 * 2. If the company does not yet have an Apollo account, creates one via POST https://api.apollo.io/api/v1/accounts
 *    and stores apollo_account_id on the company.
 * POST body: { "organizationId": "5e66b6381e05b4008c8331b8" }
 * Requires master API key for Create Account (APOLLO_MASTER_API_KEY or APOLLO_API_KEY).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncCompanySocialUrls } from "@/lib/company-social";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_MASTER_API_KEY = process.env.APOLLO_MASTER_API_KEY || APOLLO_API_KEY;
const APOLLO_ORG_URL = "https://api.apollo.io/api/v1/organizations";
const APOLLO_CREATE_ACCOUNT_URL = "https://api.apollo.io/api/v1/accounts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json({ error: "Apollo API key not configured" }, { status: 500 });
  }

  try {
    const { organizationId } = await request.json();
    const rawId = typeof organizationId === "string" ? organizationId.trim() : null;
    if (!rawId) {
      return NextResponse.json(
        { error: "Organization ID is required", message: 'Body: { "organizationId": "..." }' },
        { status: 400 }
      );
    }

    const res = await fetch(`${APOLLO_ORG_URL}/${rawId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("[apollo-organization-id-supabase-sync] Apollo API error", {
        status: res.status,
        organizationId: rawId,
        body: text.slice(0, 400),
      });
      return NextResponse.json(
        { error: "Apollo API error", details: `Status ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    let data: { organization?: any };
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON from Apollo" }, { status: 502 });
    }

    const organization = data.organization || data;
    if (!organization || !organization.id) {
      return NextResponse.json(
        { error: "No organization data found" },
        { status: 404 }
      );
    }

    const apolloWebsite = organization.website_url || "";
    const apolloDomain = organization.primary_domain || normalizeUrl(apolloWebsite);
    const apolloOrgId = organization.id;

    let matchingCompany: { id: string; name?: string; website?: string; apollo_account_id?: string | null } | null = null;
    const { data: companyByApolloId, error: apolloIdError } = await supabase
      .from("companies")
      .select("id, name, website, apollo_account_id")
      .eq("apollo_organization_id", apolloOrgId)
      .maybeSingle();

    if (!apolloIdError && companyByApolloId) matchingCompany = companyByApolloId;

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

    if (apolloDomain && companyId) {
      const { data: existingDomain } = await supabase
        .from("companies_domains")
        .select("id")
        .eq("company_id", companyId)
        .eq("domain", apolloDomain)
        .maybeSingle();
      if (existingDomain) {
        await supabase.from("companies_domains").update({ is_primary: true, url: apolloWebsite, is_apollo_org_domain: true }).eq("id", existingDomain.id);
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

    if (companyId && Array.isArray(organization.keywords)) {
      const keywords = Array.from(new Set(organization.keywords.map((k: unknown) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)));
      if (keywords.length > 0) {
        const { data: existing } = await supabase.from("companies_keywords").select("keyword").eq("company_id", companyId);
        const existingSet = new Set((existing || []).map((r) => r.keyword));
        const toInsert = keywords.filter((k) => !existingSet.has(k)).map((k) => ({ company_id: companyId, keyword: k, source: "apollo" }));
        if (toInsert.length > 0) {
          await supabase.from("companies_keywords").insert(toInsert);
        }
      }
    }

    const techEntries: { name: string; uid?: string | null; category?: string | null }[] =
      Array.isArray(organization.current_technologies) && organization.current_technologies.length > 0
        ? organization.current_technologies.filter((t: any) => t?.name?.trim()).map((t: any) => ({ name: t.name.trim(), uid: t.uid ?? null, category: t.category ?? null }))
        : Array.isArray(organization.technology_names)
          ? organization.technology_names.map((t: unknown) => (typeof t === "string" ? { name: t.trim(), uid: null, category: null } : null)).filter(Boolean) as { name: string; uid: null; category: null }[]
          : [];

    if (companyId && techEntries.length > 0) {
      const names = techEntries.map((e) => e.name);
      const { data: existingTechs } = await supabase.from("companies_technologies").select("id, name").in("name", names);
      const byName = new Map((existingTechs || []).map((r) => [r.name, r.id]));
      const toCreate = techEntries.filter((e) => !byName.has(e.name));
      if (toCreate.length > 0) {
        const created = await supabase
          .from("companies_technologies")
          .insert(toCreate.map((e) => ({ uid: e.uid ?? null, name: e.name, category: e.category ?? null })))
          .select("id, name");
        (created.data || []).forEach((r) => byName.set(r.name, r.id));
      }
      const { data: existingJoins } = await supabase.from("companies_technologies_join").select("technology_id").eq("company_id", companyId);
      const existingJoinIds = new Set((existingJoins || []).map((r) => r.technology_id));
      const joinRows = names.map((n) => byName.get(n)).filter(Boolean).filter((id) => !existingJoinIds.has(id!)).map((technology_id) => ({ company_id: companyId, technology_id: technology_id!, source: "apollo" }));
      if (joinRows.length > 0) await supabase.from("companies_technologies_join").insert(joinRows);
    }

    if (companyId && organization.departmental_head_count && typeof organization.departmental_head_count === "object") {
      const entries = Object.entries(organization.departmental_head_count).filter(([, c]) => c != null && c !== "");
      const { data: existingHeadcount } = await supabase.from("companies_headcount").select("id, department").eq("company_id", companyId);
      const existingDepts = new Map((existingHeadcount || []).map((r) => [r.department, r.id]));
      await Promise.all(
        entries.map(async ([dept, count]) => {
          const headcount = parseInt(String(count)) || 0;
          const id = existingDepts.get(dept);
          if (id) {
            await supabase.from("companies_headcount").update({ headcount, source: "apollo" }).eq("id", id);
          } else {
            await supabase.from("companies_headcount").insert({ company_id: companyId, department: dept, headcount, source: "apollo" });
          }
        })
      );
    }

    if (companyId && Array.isArray(organization.suborganizations)) {
      const subs = organization.suborganizations.filter((s: any) => s?.id);
      if (subs.length > 0) {
        const { data: existing } = await supabase.from("companies_suborganizations").select("apollo_organization_id").eq("company_id", companyId);
        const existingIds = new Set((existing || []).map((r) => r.apollo_organization_id));
        const toInsert = subs
          .filter((s: any) => !existingIds.has(s.id))
          .map((s: any) => ({ company_id: companyId, apollo_organization_id: s.id, name: s.name || "", website: s.website_url || s.website || null }));
        if (toInsert.length > 0) await supabase.from("companies_suborganizations").insert(toInsert);
      }
    }

    if (companyId && Array.isArray(organization.funding_events)) {
      const events = organization.funding_events.filter(Boolean);
      if (events.length > 0) {
        const { data: existing } = await supabase.from("companies_funding_events").select("event_id").eq("company_id", companyId);
        const existingIds = new Set((existing || []).map((r) => r.event_id));
        const toInsert = events
          .filter((e: any) => e.id && !existingIds.has(e.id))
          .map((e: any) => ({ company_id: companyId, event_id: e.id || null, type: e.type || null, amount: e.amount || null, currency: e.currency || null, date: e.date || null, investors: e.investors || null, news_url: e.news_url || null }));
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

    // Create an Apollo Account from the enriched organization data if we don't have one yet.
    let apolloAccountId: string | null = matchingCompany?.apollo_account_id ?? null;
    if (companyId && !apolloAccountId && APOLLO_MASTER_API_KEY) {
      const accountName = companyData.name || organization.name || "Unnamed Company";
      const accountDomain = apolloDomain || null;
      const accountPhone = organization.phone || organization.primary_phone?.number || null;
      const rawAddress = organization.raw_address || [organization.city, organization.state, organization.country].filter(Boolean).join(", ") || null;

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
              else console.error("[apollo-organization-id-supabase-sync] Failed to set apollo_account_id", updateAccErr);
            }
          } catch {
            console.error("[apollo-organization-id-supabase-sync] Invalid JSON from Create Account", createText.slice(0, 200));
          }
        } else {
          console.error("[apollo-organization-id-supabase-sync] Create Account failed", { status: createRes.status, body: createText.slice(0, 400) });
        }
      } catch (err) {
        console.error("[apollo-organization-id-supabase-sync] Create Account request error", err);
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
    console.error("[apollo-organization-id-supabase-sync] Error", error);
    return NextResponse.json(
      { error: "Failed to sync organization", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
