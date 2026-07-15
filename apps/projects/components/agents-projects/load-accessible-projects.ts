import { getSupabaseClient } from "@walls/auth";
import type { Project } from "./types";

const DEFAULT_SELECT =
  "id, name, slug, description, status, start_date, due_date, completed_at, owner_id, account_id, priority, color, metadata, created_at, updated_at";

/** Column sets for `loadAccessibleProjects` — use these instead of arbitrary strings. */
export const ACCESSIBLE_PROJECT_SELECT = {
  default: DEFAULT_SELECT,
  summary: "id, name, color, status, slug, owner_id, account_id",
  timeline:
    "id, name, color, status, description, due_date, start_date, priority, owner_id, account_id, completed_at, metadata, created_at, updated_at, slug",
} as const;

export type AccessibleProjectSelect =
  (typeof ACCESSIBLE_PROJECT_SELECT)[keyof typeof ACCESSIBLE_PROJECT_SELECT];

function toProjectRows(data: unknown): Project[] {
  if (!Array.isArray(data)) return [];
  return data as Project[];
}

/**
 * Projects the user owns or is listed on in `project_members`, scoped to the
 * active WALLS account.
 */
export async function loadAccessibleProjects(
  userId: string,
  options: { accountId: string; select?: AccessibleProjectSelect },
): Promise<Project[]> {
  const supabase = getSupabaseClient();
  const { accountId, select } = options;

  const { data: memberRows, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  if (memberError) throw memberError;

  const memberProjectIds = (memberRows ?? []).map((r) => r.project_id);
  const accessFilter =
    memberProjectIds.length > 0
      ? `owner_id.eq.${userId},id.in.(${memberProjectIds.join(",")})`
      : `owner_id.eq.${userId}`;

  const { data, error } = await supabase
    .from("projects")
    .select(select ?? DEFAULT_SELECT)
    .eq("account_id", accountId)
    .or(accessFilter)
    .order("name");

  if (error) throw error;
  return toProjectRows(data);
}
