import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getInstagramUsernameFromAccounts,
  representationPathSegment,
} from "@/lib/representation/instagram-username";
import type { RelatedTalentCard } from "@/lib/representation/types";

type TalentRow = {
  id: string;
  avatar_url: string | null;
  slug: string | null;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  profile:
    | {
        name: string | null;
        profile_categories: { name?: string } | null;
      }
    | {
        name: string | null;
        profile_categories: { name?: string } | null;
      }[]
    | null;
};

export async function fetchRelatedTalents(
  supabase: SupabaseClient,
  currentTalentId: string,
  limit = 5
): Promise<RelatedTalentCard[]> {
  const { data: current } = await supabase
    .from("talent")
    .select("agent_team_id")
    .eq("id", currentTalentId)
    .maybeSingle();

  let query = supabase
    .from("talent")
    .select(
      `
      id,
      avatar_url,
      slug,
      profile_id,
      first_name,
      last_name,
      profile:profiles!talent_profile_id_fkey(
        name,
        profile_categories!profiles_category_id_fkey(name)
      )
    `
    )
    .eq("status", "Active")
    .neq("id", currentTalentId)
    .neq("contract_type", "released")
    .order("id", { ascending: true })
    .limit(limit + 12);

  if (current?.agent_team_id) {
    query = query.eq("agent_team_id", current.agent_team_id);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("fetchRelatedTalents:", error);
    return [];
  }

  const talentRows = (rows || []) as TalentRow[];
  if (talentRows.length === 0) return [];

  const profileIds = talentRows
    .map((t) => t.profile_id)
    .filter((id): id is string => Boolean(id));

  const instagramByProfileId = new Map<string, string>();

  if (profileIds.length > 0) {
    const { data: igAccounts } = await supabase
      .from("social_accounts")
      .select("profile_id, username, url, platform")
      .eq("platform", "instagram")
      .in("profile_id", profileIds);

    for (const row of igAccounts || []) {
      if (!row.profile_id || instagramByProfileId.has(row.profile_id)) continue;
      const handle = getInstagramUsernameFromAccounts([
        {
          platform: "instagram",
          username: row.username,
          url: row.url,
        },
      ]);
      if (handle) instagramByProfileId.set(row.profile_id, handle);
    }
  }

  const cards: RelatedTalentCard[] = talentRows
    .map((t) => {
      const profile = Array.isArray(t.profile) ? t.profile[0] : t.profile;
      const name =
        profile?.name ||
        [t.first_name, t.last_name].filter(Boolean).join(" ") ||
        "Creator";
      const instagram_username = t.profile_id
        ? instagramByProfileId.get(t.profile_id) ?? null
        : null;
      const representation_path = instagram_username
        ? representationPathSegment(instagram_username, t.slug || t.id)
        : t.slug || t.id;

      return {
        id: t.id,
        name,
        avatar_url: t.avatar_url,
        category:
          (profile?.profile_categories as { name?: string } | null)?.name ||
          null,
        representation_path,
        instagram_username,
      };
    })
    .filter((c) => c.representation_path);

  return cards.slice(0, limit);
}
