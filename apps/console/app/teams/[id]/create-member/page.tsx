import { CreateTeamMember } from "@/components/console/adminTeams/create-member/create-team-member";

export default async function CreateTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreateTeamMember teamGroupId={id} />;
}
