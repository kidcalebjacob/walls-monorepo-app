import { redirect } from "next/navigation";

import { getAdminDataScope } from "@/lib/admin-scope";

export default async function AdminAccountsPage() {
  const scope = await getAdminDataScope();
  if (scope) {
    redirect(`/accounts/${scope.accountId}`);
  }

  redirect("/");
}
