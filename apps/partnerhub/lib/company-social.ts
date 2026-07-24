import type { SupabaseClient } from "@supabase/supabase-js";

/** Lowercase username with no leading @. */
export function cleanSocialUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function extractUsernameFromSocialUrl(
  url: string,
  platform?: string
): string | null {
  if (!url?.trim()) return null;

  const lowerPlatform = platform?.toLowerCase();

  try {
    const parsed = new URL(url);
    if (lowerPlatform === "linkedin") {
      const match = parsed.pathname.match(/\/company\/([^/?#]+)/i);
      if (match?.[1]) return cleanSocialUsername(match[1]);
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? cleanSocialUsername(last) : null;
  } catch {
    if (lowerPlatform === "linkedin") {
      const match = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
      if (match?.[1]) return cleanSocialUsername(match[1]);
    }
    return null;
  }
}

export type CompanySocialUrls = {
  linkedin: string;
  twitter: string;
  facebook: string;
};

const EMPTY_SOCIAL_URLS: CompanySocialUrls = {
  linkedin: "",
  twitter: "",
  facebook: "",
};

export async function fetchCompanySocialUrls(
  supabase: SupabaseClient,
  companyId: string
): Promise<CompanySocialUrls> {
  const result = { ...EMPTY_SOCIAL_URLS };

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "company");

  if (profilesError || !profiles?.length) return result;

  const profileIds = profiles.map((p) => p.id);
  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("platform, url")
    .in("profile_id", profileIds);

  if (accountsError || !accounts?.length) return result;

  for (const account of accounts) {
    const platform = account.platform?.toLowerCase();
    const url = account.url;
    if (!url) continue;

    if (platform === "linkedin") {
      result.linkedin = url;
    } else if (platform === "twitter" || platform === "x") {
      result.twitter = url;
    } else if (platform === "facebook") {
      result.facebook = url;
    }
  }

  return result;
}

export async function getOrCreateCompanyProfile(
  supabase: SupabaseClient,
  companyId: string,
  name: string
): Promise<{ id: string } | null> {
  const profileName = name.trim() || "Unknown";

  let { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "company")
    .eq("name", profileName)
    .maybeSingle();

  if (!profile) {
    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert({
        company_id: companyId,
        type: "company",
        name: profileName,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating company profile:", error);
      return null;
    }
    profile = newProfile;
  }

  return profile;
}

export async function upsertCompanySocialAccount(
  supabase: SupabaseClient,
  profileId: string,
  platform: string,
  url: string,
  rawUsername?: string | null
): Promise<void> {
  if (!url?.trim()) return;

  const username = rawUsername
    ? cleanSocialUsername(rawUsername)
    : extractUsernameFromSocialUrl(url, platform);

  if (!username) return;

  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("profile_id", profileId)
    .eq("platform", platform)
    .maybeSingle();

  const payload = {
    profile_id: profileId,
    platform,
    username,
    url,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("social_accounts")
      .update({ url, username })
      .eq("id", existing.id);
    if (error) console.error(`Error updating ${platform} social account:`, error);
  } else {
    const { error } = await supabase.from("social_accounts").insert(payload);
    if (error) console.error(`Error inserting ${platform} social account:`, error);
  }
}

export async function syncCompanySocialUrls(
  supabase: SupabaseClient,
  companyId: string,
  companyName: string,
  urls: {
    linkedin?: string | null;
    twitter?: string | null;
    facebook?: string | null;
  }
): Promise<void> {
  const profile = await getOrCreateCompanyProfile(supabase, companyId, companyName);
  if (!profile) return;

  const tasks: Promise<void>[] = [];
  if (urls.linkedin) {
    tasks.push(
      upsertCompanySocialAccount(supabase, profile.id, "linkedin", urls.linkedin)
    );
  }
  if (urls.twitter) {
    tasks.push(
      upsertCompanySocialAccount(supabase, profile.id, "twitter", urls.twitter)
    );
  }
  if (urls.facebook) {
    tasks.push(
      upsertCompanySocialAccount(supabase, profile.id, "facebook", urls.facebook)
    );
  }
  await Promise.all(tasks);
}
