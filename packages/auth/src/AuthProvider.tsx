"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import {
  AuthContext,
  type UserProfile,
  type UserProfileApp,
} from "./AuthContext";
import { getSupabaseClient } from "./supabase-client";

const PROFILE_STORAGE_KEY = "walls_profile";

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

  const [userResult, accessResult] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, avatar_url, first_name, last_name, user_platform_id, is_admin, user_platform(url_redirect)",
      )
      .eq("id", userId)
      .single(),
    supabase
      .from("user_app_access")
      .select("app_id, order_index, apps(id, slug, name, icon_url, url_redirect)")
      .eq("user_id", userId)
      .order("order_index", { ascending: true }),
  ]);

  const supabaseUserData = userResult.data;
  const userError = userResult.error;
  const accessRows = accessResult.data ?? [];

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

  const appList: UserProfileApp[] = [];
  accessRows.forEach((row: {
    app_id: string;
    apps: unknown;
  }) => {
    const app = row.apps;
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
      const name = String(a.name);
      const urlRedirect =
        "url_redirect" in a && a.url_redirect
          ? String(a.url_redirect)
          : `/${slug}`;
      const iconUrl =
        "icon_url" in a && a.icon_url
          ? String(a.icon_url)
          : `https://assets.wallsentertainment.com/walls-app-icons/${slug}.svg`;
      const pathPart = urlRedirect.replace(/^\/*/, "");
      const path = `${platformBase}/${pathPart}`;
      appList.push({
        app_id: row.app_id,
        name,
        icon: iconUrl,
        path,
      });
    }
  });

  const initials = computeInitials(userFullName, email);

  return {
    avatarUrl,
    userFullName,
    initials,
    userType,
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
        setProfile(cached);
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem("authToken", session.access_token);
      } else {
        localStorage.removeItem("authToken");
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
