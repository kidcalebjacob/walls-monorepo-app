import { notFound } from "next/navigation";

import { createClient } from "@walls/supabase/server";
import { AdminViewTeam } from "@/components/admin/adminTeams/admin-view-teams";

export default async function AdminTeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: groupRow, error } = await supabase
    .from("team_groups")
    .select("id, name, objective, created_at, avatar_url, lead_team_member_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !groupRow) {
    notFound();
  }

  let leadName: string | null = null;
  if (groupRow.lead_team_member_id) {
    const { data: lead } = await supabase
      .from("users")
      .select("first_name, last_name, email")
      .eq("id", groupRow.lead_team_member_id)
      .maybeSingle();
    if (lead) {
      const name = `${(lead.first_name ?? "").trim()} ${(lead.last_name ?? "").trim()}`.trim();
      leadName = name || lead.email || null;
    }
  }

  const { data: memberRows } = await supabase
    .from("team")
    .select(
      "id, title, email, phone_extension, linkedin_url, user_id, user:user_id(first_name, last_name, avatar_url, is_admin)",
    )
    .eq("team_group_id", id)
    .order("title", { ascending: true });

  const members = (memberRows ?? []).map((row) => {
    const userRaw = row.user;
    const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
    return {
      id: row.id as string,
      title: (row.title as string) ?? "",
      email: (row.email as string | null) ?? null,
      phone_extension:
        row.phone_extension != null ? Number(row.phone_extension) : null,
      is_admin: user?.is_admin === true,
      linkedin_url: (row.linkedin_url as string | null) ?? null,
      user_id: (row.user_id as string | null) ?? null,
      first_name: (user?.first_name as string | null) ?? null,
      last_name: (user?.last_name as string | null) ?? null,
      avatar_url: (user?.avatar_url as string | null) ?? null,
    };
  });

  return (
    <AdminViewTeam
      group={{
        id: groupRow.id,
        name: groupRow.name,
        objective: groupRow.objective,
        created_at: groupRow.created_at,
        avatar_url: groupRow.avatar_url,
        lead_name: leadName,
        members,
      }}
    />
  );
}
