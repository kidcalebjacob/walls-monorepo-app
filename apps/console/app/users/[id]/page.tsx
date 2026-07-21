import { notFound } from "next/navigation";

import { createClient } from "@walls/supabase/server";
import {
  AdminUserDetail,
  type UserDetail,
} from "@/components/console/adminUsers/admin-view-user";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userRow, error } = await supabase
    .from("users")
    .select(
      "id, created_at, first_name, last_name, email, phone_number, user_platform_id, avatar_url, date_of_birth, address, timezone, daily_email_limit, personal_email, country_code, is_admin, user_platform(id, code, name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !userRow) {
    notFound();
  }

  const [{ data: accessRows }, { data: commissionRow }] = await Promise.all([
    supabase
      .from("user_app_access")
      .select("app_id, apps(id, slug, name, icon_url)")
      .eq("user_id", id),
    supabase
      .from("user_commission_defaults")
      .select("commission_bps, role")
      .eq("user_id", id)
      .maybeSingle(),
  ]);

  const platformRaw = userRow.user_platform;
  const platform = Array.isArray(platformRaw) ? platformRaw[0] : platformRaw;

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

  const user: UserDetail = {
    id: userRow.id,
    created_at: userRow.created_at,
    first_name: userRow.first_name,
    last_name: userRow.last_name,
    email: userRow.email,
    phone_number: userRow.phone_number,
    user_platform_id: userRow.user_platform_id,
    avatar_url: userRow.avatar_url,
    date_of_birth: userRow.date_of_birth,
    address: userRow.address,
    timezone: userRow.timezone,
    daily_email_limit: userRow.daily_email_limit,
    personal_email: userRow.personal_email,
    person_id: null,
    country_code: userRow.country_code,
    is_admin: userRow.is_admin === true,
    platform: platform
      ? {
          id: platform.id as string,
          code: platform.code as string,
          name: platform.name as string,
        }
      : null,
    app_access: appAccess as UserDetail["app_access"],
    commission_bps:
      commissionRow?.commission_bps != null
        ? Number(commissionRow.commission_bps)
        : null,
    commission_role: (commissionRow?.role as string | null) ?? null,
  };

  return <AdminUserDetail user={user} />;
}
