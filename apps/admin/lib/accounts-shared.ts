export type AccountType = "personal" | "organization";

export type AccountRole = "owner" | "admin" | "member";

export type AccountRecord = {
  id: string;
  accountType: AccountType;
  name: string;
  personalOwnerId: string | null;
};

export type AccountMemberRecord = {
  id: string;
  userId: string;
  role: AccountRole;
  isDefault: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
};

export function canManageAccountMembers(role: AccountRole): boolean {
  return role === "owner" || role === "admin";
}

export function canChangeAccountMemberRole(
  actorRole: AccountRole,
  targetRole: AccountRole,
): boolean {
  if (actorRole === "owner") {
    return true;
  }

  if (actorRole === "admin") {
    return targetRole !== "owner";
  }

  return false;
}

export function canRemoveAccountMember(
  actorRole: AccountRole,
  targetRole: AccountRole,
  actorUserId: string,
  targetUserId: string,
): boolean {
  if (actorUserId === targetUserId) {
    return false;
  }

  return canChangeAccountMemberRole(actorRole, targetRole);
}
