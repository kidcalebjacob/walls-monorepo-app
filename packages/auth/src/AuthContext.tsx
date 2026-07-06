import { createContext, useContext } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface User {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  providerId?: string;
}

/** Profile data loaded once globally and consumed by UserProfileButton and others. */
export interface UserProfileApp {
  app_id: string;
  name: string;
  icon: string;
  path: string;
}

export interface UserProfile {
  avatarUrl: string | null;
  userFullName: string;
  initials: string | undefined;
  userType: string | null;
  userApps: UserProfileApp[];
}

export interface AuthContextValue {
  user: SupabaseUser | null;
  isLoading: boolean;
  /** Fetched once in AuthProvider; null until loaded (or from cache). */
  profile: UserProfile | null;
  /** True while the first profile fetch is in flight (or no cached profile). */
  profileLoading: boolean;
  /** Re-fetch profile from server. */
  refreshProfile: () => Promise<void>;
  /** Update only apps (e.g. after reorder); updates context and localStorage cache. */
  updateProfileApps: (apps: UserProfileApp[]) => void;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  profile: null,
  profileLoading: true,
  refreshProfile: async () => {},
  updateProfileApps: () => {},
});

export const useAuth = () => useContext(AuthContext);
