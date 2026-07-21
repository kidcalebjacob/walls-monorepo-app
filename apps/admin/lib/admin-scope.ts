import {
  getActiveAccount,
  getCurrentUserId,
  resolveActiveAccountId,
  type AdminAccount,
} from "./account-context";

export type AdminDataScope = {
  accountId: string;
  userId: string;
  account: AdminAccount;
};

export async function getAdminDataScope(): Promise<AdminDataScope | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const [accountId, account] = await Promise.all([
    resolveActiveAccountId(userId),
    getActiveAccount(userId),
  ]);

  if (!accountId || !account || account.hasAppAccess === false) {
    return null;
  }

  return { accountId, userId, account };
}
