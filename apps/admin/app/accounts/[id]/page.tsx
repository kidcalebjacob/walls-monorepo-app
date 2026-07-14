import { notFound } from "next/navigation";

import { createClient } from "@walls/supabase/server";
import {
  AdminAccountDetail,
  type AccountDetail,
} from "@/components/admin/adminAccounts/admin-view-account";

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: accountRow, error } = await supabase
    .from("accounts")
    .select(
      "id, created_at, updated_at, account_type, name, slug, icon_url, website, description, email, phone",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !accountRow) {
    notFound();
  }

  const [{ data: accessRows }, { count: memberCount }] = await Promise.all([
    supabase
      .from("account_app_access")
      .select("app_id, apps(id, slug, name, icon_url)")
      .eq("account_id", id),
    supabase
      .from("account_users")
      .select("id", { count: "exact", head: true })
      .eq("account_id", id),
  ]);

  const appAccess =
    accessRows
      ?.map((row) => {
        const appRaw = row.apps;
        const app = Array.isArray(appRaw) ? appRaw[0] : appRaw;
        if (!app) return null;
        return {
          id: app.id as string,
          slug: app.slug as string,
          name: app.name as string,
          icon_url: (app.icon_url as string | null) ?? null,
        };
      })
      .filter(Boolean) ?? [];

  const account: AccountDetail = {
    id: accountRow.id,
    created_at: accountRow.created_at,
    updated_at: accountRow.updated_at,
    account_type: accountRow.account_type as AccountDetail["account_type"],
    name: accountRow.name,
    slug: accountRow.slug,
    icon_url: accountRow.icon_url,
    website: accountRow.website,
    description: accountRow.description,
    email: accountRow.email,
    phone: accountRow.phone,
    member_count: memberCount ?? 0,
    app_access: appAccess as AccountDetail["app_access"],
  };

  return <AdminAccountDetail account={account} />;
}
