"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import {
  AuthContext,
  type UserProfile,
  type UserProfileApp,
} from "./AuthContext";
import { readActiveAccountIdFromDocumentCookie } from "./active-account";
import { resolveAppHref } from "./app-url";
import { getSupabaseClient } from "./supabase-client";

const PROFILE_STORAGE_KEY = "walls_profile_v2";

function getProfileStorageKey(userId: string) {
  return `${PROFILE_STORAGE_KEY}_${userId}`;
}

function readCachedProfile(userId: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getProfileStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.userApps)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function normalizeCachedProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    isAdmin: profile.isAdmin ?? profile.userType === "Admin",
  };
}

function writeCachedProfile(userId: string, profile: UserProfile) {
  try {
    localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profile));
  } catch {
    // ignore
  }
}

function computeInitials(
  userFullName: string,
  email: string | null | undefined,
): string | undefined {
  if (userFullName) {
    const parts = userFullName.trim().split(" ");
    if (parts.length > 0) {
      const first = parts[0].charAt(0).toUpperCase();
      const second =
        parts.length > 1
          ? parts[parts.length - 1].charAt(0).toUpperCase()
          : first;
      return first + second;
    }
  }
  if (email) {
    const parts = email.split("@")[0].split(".");
    if (parts.length > 0) {
      const first = parts[0].charAt(0).toUpperCase();
      const second =
        parts.length > 1 ? parts[1].charAt(0).toUpperCase() : first;
      return first + second;
    }
  }
  return undefined;
}

async function fetchUserProfile(
  userId: string,
  email: string | undefined,
): Promise<UserProfile> {
  const supabase = getSupabaseClient();

  const [userResult, membershipResult, legacyAccessResult] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, avatar_url, first_name, last_name, user_platform_id, is_admin, user_platform(url_redirect)",
      )
      .eq("id", userId)
      .single(),
    supabase
      .from("account_users")
      .select("account_id, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false }),
    supabase
      .from("user_app_access")
      .select(
        "app_id, order_index, apps(id, slug, name, icon_url, url_redirect, subdomain)",
      )
      .eq("user_id", userId)
      .order("order_index", { ascending: true }),
  ]);

  const supabaseUserData = userResult.data;
  const userError = userResult.error;
  const memberships = membershipResult.data ?? [];
  const accountIds = memberships
    .map((row) => row.account_id)
    .filter((id): id is string => !!id);
  const legacyAccessRows = legacyAccessResult.data ?? [];

  const preferredAccountId = readActiveAccountIdFromDocumentCookie();
  const defaultMembership = memberships.find((row) => row.is_default === true);
  const activeAccountId =
    (preferredAccountId &&
    accountIds.includes(preferredAccountId)
      ? preferredAccountId
      : null) ??
    (defaultMembership?.account_id as string | undefined) ??
    accountIds[0] ??
    null;

  let accountAccessRows: {
    app_id: string;
    apps: unknown;
  }[] = [];

  if (activeAccountId) {
    const { data } = await supabase
      .from("account_app_user_access")
      .select(
        "app_id, apps(id, slug, name, icon_url, url_redirect, subdomain)",
      )
      .eq("account_id", activeAccountId)
      .eq("user_id", userId);
    accountAccessRows = data ?? [];
  }

  const [{ count: accountUserGrantCount }, { count: accountGrantCount }] =
    accountIds.length > 0
      ? await Promise.all([
          supabase
            .from("account_app_user_access")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .in("account_id", accountIds),
          supabase
            .from("account_app_access")
            .select("id", { count: "exact", head: true })
            .in("account_id", accountIds),
        ])
      : [{ count: 0 }, { count: 0 }];

  const onSaaS =
    (accountUserGrantCount ?? 0) > 0 || (accountGrantCount ?? 0) > 0;

  let userFullName = "";
  let avatarUrl: string | null = null;
  let userType: string | null = null;
  let platformBase = "/agents";

  if (!userError && supabaseUserData) {
    const firstName = supabaseUserData.first_name ?? "";
    const lastName = supabaseUserData.last_name ?? "";
    userFullName = `${firstName} ${lastName}`.trim();
    avatarUrl = supabaseUserData.avatar_url ?? null;
    const rawPlatform = supabaseUserData.user_platform;
    const platformObj =
      rawPlatform && typeof rawPlatform === "object"
        ? Array.isArray(rawPlatform)
          ? rawPlatform[0]
          : rawPlatform
        : null;
    if (
      platformObj &&
      typeof platformObj === "object" &&
      "url_redirect" in platformObj &&
      platformObj.url_redirect
    ) {
      platformBase =
        String(platformObj.url_redirect).replace(/\/$/, "") ?? "/agents";
    }
  }

  if (!userError && supabaseUserData?.is_admin === true) {
    userType = "Admin";
  } else {
    userType = "Agent";
  }

  const isAdmin = supabaseUserData?.is_admin === true;

  const pushApp = (
    appList: UserProfileApp[],
    seen: Set<string>,
    appId: string,
    apps: unknown,
  ) => {
    if (seen.has(appId)) return;
    const app = apps;
    if (!app || typeof app !== "object") return;
    const a = Array.isArray(app) ? app[0] : app;
    if (
      a &&
      typeof a === "object" &&
      "slug" in a &&
      "name" in a &&
      a.slug != null &&
      a.name != null
    ) {
      const slug = String(a.slug);
      const name =
        slug === (process.env.NEXT_PUBLIC_ADMIN_APP_SLUG || "admin")
          ? "Admin console"
          : String(a.name);
      const urlRedirect =
        "url_redirect" in a && a.url_redirect != null
          ? String(a.url_redirect)
          : null;
      const subdomain =
        "subdomain" in a && a.subdomain != null
          ? String(a.subdomain)
          : null;
      const iconUrl =
        "icon_url" in a && a.icon_url
          ? String(a.icon_url)
          : `https://assets.wallsentertainment.com/walls-app-icons/${slug}.svg`;
      const path = resolveAppHref({
        slug,
        subdomain,
        urlRedirect,
        platformBase,
      });
      seen.add(appId);
      appList.push({
        app_id: appId,
        slug,
        name,
        icon: iconUrl,
        path,
        subdomain,
      });
    }
  };

  const appList: UserProfileApp[] = [];
  const seenAppIds = new Set<string>();

  if (onSaaS) {
    // Kenoo SaaS: apps for the active account only.
    accountAccessRows.forEach((row) => {
      pushApp(appList, seenAppIds, row.app_id, row.apps);
    });
  } else {
    // Legacy walls-app path: personal user_app_access grants.
    legacyAccessRows.forEach((row: { app_id: string; apps: unknown }) => {
      pushApp(appList, seenAppIds, row.app_id, row.apps);
    });
  }

  const initials = computeInitials(userFullName, email);

  return {
    avatarUrl,
    userFullName,
    initials,
    userType,
    isAdmin,
    userApps: appList,
  };
}

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FunctionComponent<AuthProviderProps> = ({
  children,
}) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState<boolean>(true);

  const loadProfile = React.useCallback(
    async (userId: string, userEmail: string | undefined) => {
      const cached = readCachedProfile(userId);
      if (cached) {
        setProfile(normalizeCachedProfile(cached));
        setProfileLoading(false);
      }
      try {
        const next = await fetchUserProfile(userId, userEmail);
        setProfile(next);
        writeCachedProfile(userId, next);
      } catch (error) {
        console.error("Error fetching user profile:", error);
        if (!cached) setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    },
    [],
  );

  const refreshProfile = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const next = await fetchUserProfile(user.id, user.email);
      setProfile(next);
      writeCachedProfile(user.id, next);
    } catch (error) {
      console.error("Error refreshing user profile:", error);
    }
  }, [user?.id, user?.email]);

  const updateProfileApps = React.useCallback(
    (apps: UserProfileApp[]) => {
      setProfile((prev) => {
        if (!prev) return prev;
        const next = { ...prev, userApps: apps };
        if (user?.id) writeCachedProfile(user.id, next);
        return next;
      });
    },
    [user?.id],
  );

  React.useEffect(() => {
    const supabase = getSupabaseClient();

    const clearUnauthenticatedState = () => {
      setUser(null);
      setIsLoading(false);
      setProfile(null);
      setProfileLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        clearUnauthenticatedState();
        return;
      }

      supabase.auth.getUser().then(({ data: { user: u }, error: userError }) => {
        const verifiedUser = userError ? null : (u ?? null);
        setUser(verifiedUser);
        setIsLoading(false);
        if (verifiedUser?.id) {
          loadProfile(verifiedUser.id, verifiedUser.email ?? undefined);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem("authToken", session.access_token);
      } else {
        localStorage.removeItem("authToken");
        clearUnauthenticatedState();
        return;
      }

      supabase.auth.getUser().then(({ data: { user: u }, error: userError }) => {
        const verifiedUser = userError ? null : (u ?? null);
        setUser(verifiedUser);
        setIsLoading(false);
        if (verifiedUser?.id) {
          loadProfile(verifiedUser.id, verifiedUser.email ?? undefined);
        } else {
          setProfile(null);
          setProfileLoading(true);
        }
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        profile,
        profileLoading,
        refreshProfile,
        updateProfileApps,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
