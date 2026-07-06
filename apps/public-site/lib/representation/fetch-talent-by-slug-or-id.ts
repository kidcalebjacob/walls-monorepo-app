import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeInstagramUsername } from "@/lib/representation/instagram-username";

/** Fields needed for public representation pages (mediakit parity). */
export const PUBLIC_TALENT_SELECT =
  "id, walls_email, city, country, avatar_url, slug, profile_id, first_name, last_name, bio_short, contract_type";

export type PublicTalentRow = {
  id: string;
  walls_email: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  slug: string | null;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  bio_short: string | null;
  contract_type: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchTalentByProfileId(
  supabase: SupabaseClient,
  profileId: string
): Promise<PublicTalentRow | null> {
  const { data, error } = await supabase
    .from("talent")
    .select(PUBLIC_TALENT_SELECT)
    .eq("profile_id", profileId)
    .limit(1);

  if (error) {
    console.error("fetchTalentByProfileId:", error);
    return null;
  }
  return (data?.[0] as PublicTalentRow) ?? null;
}

async function fetchTalentByInstagramUsername(
  supabase: SupabaseClient,
  username: string
): Promise<PublicTalentRow | null> {
  const handle = normalizeInstagramUsername(username);
  if (!handle) return null;

  const { data: socialRow, error: socialError } = await supabase
    .from("social_accounts")
    .select("profile_id")
    .eq("platform", "instagram")
    .ilike("username", handle)
    .not("profile_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (socialError) {
    console.error("fetchTalentByInstagramUsername:", socialError);
    return null;
  }

  if (!socialRow?.profile_id) return null;
  return fetchTalentByProfileId(supabase, socialRow.profile_id);
}

/**
 * Resolve talent for public representation pages.
 * 1) Instagram @username (primary public URL)
 * 2) talent.slug
 * 3) talent.id when segment is a UUID
 */
export async function fetchTalentBySlugOrId(
  supabase: SupabaseClient,
  handleOrLegacyKey: string
): Promise<PublicTalentRow | null> {
  const key = handleOrLegacyKey.trim();
  if (!key) return null;

  const byInstagram = await fetchTalentByInstagramUsername(supabase, key);
  if (byInstagram) return byInstagram;

  const { data: byTalentSlug, error: slugError } = await supabase
    .from("talent")
    .select(PUBLIC_TALENT_SELECT)
    .eq("slug", key)
    .limit(1);

  if (slugError) {
    console.error("fetchTalentBySlugOrId (talent.slug):", slugError);
    return null;
  }
  if (byTalentSlug?.[0]) {
    return byTalentSlug[0] as PublicTalentRow;
  }

  if (UUID_RE.test(key)) {
    const { data: byId, error: idError } = await supabase
      .from("talent")
      .select(PUBLIC_TALENT_SELECT)
      .eq("id", key)
      .limit(1);

    if (idError) {
      console.error("fetchTalentBySlugOrId (id):", idError);
      return null;
    }
    if (byId?.[0]) {
      return byId[0] as PublicTalentRow;
    }
  }

  return null;
}
