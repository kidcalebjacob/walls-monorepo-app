import { notFound } from "next/navigation";

import { createClient } from "@walls/supabase/server";
import {
  AdminAppDetail,
  type AppDetail,
} from "@/components/admin/adminApps/admin-view-app";

export default async function AdminAppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("apps")
    .select(
      "id, slug, name, description, icon_url, is_active, created_at, updated_at, url_redirect",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const app: AppDetail = {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    icon_url: data.icon_url,
    is_active: data.is_active === true,
    created_at: data.created_at,
    updated_at: data.updated_at,
    url_redirect: data.url_redirect,
  };

  return <AdminAppDetail app={app} />;
}
