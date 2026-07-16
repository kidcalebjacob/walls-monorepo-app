"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { Check, Minus, Plus, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { FallbackEmailAvatar } from "@/components/agentMail/ui/fallback-email-avatar";

export type UserPlatformSectionKey = "agent" | "talent" | "external";

export interface UserSearchUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string | null;
  platformCode?: string | null;
  platformName?: string | null;
  sectionKey: UserPlatformSectionKey;
}

export interface UserSearchProps {
  values: string[];
  onToggle: (userId: string) => void;
  onUsersLoaded?: (users: UserSearchUser[]) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

type UserSectionConfig = {
  key: UserPlatformSectionKey;
  label: string;
};

const USER_SEARCH_SECTIONS: UserSectionConfig[] = [
  { key: "agent", label: "Agents" },
  { key: "talent", label: "Talent" },
  { key: "external", label: "External" },
];

/** Keeps the panel inside the viewport when used in a Radix Popover (inherits --radix-popover-content-available-height). */
const contentMaxHeightClass =
  "max-h-[min(500px,var(--radix-popover-content-available-height,calc(100dvh-2rem)))]";

const SECTION_ORDER: UserPlatformSectionKey[] = ["agent", "talent", "external"];

export type DbUserSearchRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
  user_platform?: { name: string; code: string } | { name: string; code: string }[] | null;
};

export function parseUserPlatform(
  raw: { name: string; code: string } | { name: string; code: string }[] | null | undefined
): { name: string; code: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const single = Array.isArray(raw) ? raw[0] : raw;
  if (single && "name" in single && "code" in single) {
    return { name: single.name, code: single.code };
  }
  return null;
}

export function resolveSectionKey(platformCode: string | null | undefined): UserPlatformSectionKey {
  const code = platformCode?.toLowerCase();
  if (code === "agent") return "agent";
  if (code === "talent") return "talent";
  return "external";
}

export function mapDbUserToUserSearchUser(row: DbUserSearchRow): UserSearchUser {
  const platform = parseUserPlatform(row.user_platform);
  const displayName =
    `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.email || "Unknown";
  const platformCode = platform?.code ?? null;

  return {
    id: row.id,
    displayName,
    avatarUrl: row.avatar_url ?? null,
    email: row.email ?? null,
    platformCode,
    platformName: platform?.name ?? null,
    sectionKey: resolveSectionKey(platformCode),
  };
}

function sortUsersInSection(
  list: UserSearchUser[],
  currentUserId: string | null | undefined
): UserSearchUser[] {
  return [...list].sort((a, b) => {
    if (currentUserId) {
      if (a.id === currentUserId && b.id !== currentUserId) return -1;
      if (b.id === currentUserId && a.id !== currentUserId) return 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

function UserAvatar({
  name,
  avatarUrl,
  hasImageError,
  onImageError,
}: {
  name: string;
  avatarUrl?: string | null;
  hasImageError?: boolean;
  onImageError?: () => void;
}) {
  const showPhoto = Boolean(avatarUrl?.trim()) && !hasImageError;

  return (
    <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
      {showPhoto ? (
        <Image
          src={avatarUrl!}
          alt=""
          width={24}
          height={24}
          className="h-full w-full object-cover"
          sizes="24px"
          onError={onImageError}
        />
      ) : (
        <FallbackEmailAvatar name={name} className="text-[10px]" />
      )}
    </div>
  );
}

function UserListRow({
  user,
  label,
  isSelected,
  imageErrors,
  onToggle,
  onImageError,
}: {
  user: UserSearchUser;
  label: string;
  isSelected: boolean;
  imageErrors: Record<string, boolean>;
  onToggle: (userId: string) => void;
  onImageError: (userId: string) => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(user.id);
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={cn(
        "relative flex cursor-pointer items-center rounded-none px-4 py-2 pr-10 hover:bg-neutral-100/60 focus:bg-neutral-100/60",
        isSelected && "bg-neutral-100/60"
      )}
    >
      <div className="flex min-w-0 w-full items-center space-x-3">
        <UserAvatar
          name={label}
          avatarUrl={user.avatarUrl}
          hasImageError={imageErrors[user.id]}
          onImageError={() => onImageError(user.id)}
        />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-light">{label}</span>
          {user.email ? (
            <span className="block truncate text-xs font-light text-neutral-400">
              {user.email}
            </span>
          ) : null}
        </div>
      </div>
      {isSelected ? (
        <Check className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-[var(--kenoo-sky)] stroke-[1.5]" />
      ) : null}
    </div>
  );
}

function PlatformSection({
  section,
  users,
  expanded,
  onToggleExpanded,
  values,
  currentUserId,
  imageErrors,
  onToggle,
  onImageError,
}: {
  section: UserSectionConfig;
  users: UserSearchUser[];
  expanded: boolean;
  onToggleExpanded: () => void;
  values: string[];
  currentUserId: string | null | undefined;
  imageErrors: Record<string, boolean>;
  onToggle: (userId: string) => void;
  onImageError: (userId: string) => void;
}) {
  const sortedUsers = useMemo(
    () => sortUsersInSection(users, currentUserId),
    [users, currentUserId]
  );

  const userLabel = (u: UserSearchUser) =>
    currentUserId && u.id === currentUserId ? "You" : u.displayName;

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleExpanded();
        }}
        onMouseDown={(e) => e.preventDefault()}
        className="flex w-full cursor-pointer items-center border-b border-neutral-200/60 bg-neutral-100/50 px-4 py-2 transition-colors hover:bg-neutral-200/40"
      >
        <span className="text-sm font-light text-neutral-700">{section.label}</span>
        <span className="ml-2 text-xs font-light text-neutral-400">({users.length})</span>
        <div className="flex-1" />
        {expanded ? (
          <Minus className="h-4 w-4 text-neutral-500 stroke-[1.5]" />
        ) : (
          <Plus className="h-4 w-4 text-neutral-500 stroke-[1.5]" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {sortedUsers.length === 0 ? (
              <div className="px-4 py-2 text-sm font-light text-gray-500">
                No users in this section
              </div>
            ) : (
              sortedUsers.map((u) => (
                <UserListRow
                  key={u.id}
                  user={u}
                  label={userLabel(u)}
                  isSelected={values.includes(u.id)}
                  imageErrors={imageErrors}
                  onToggle={onToggle}
                  onImageError={onImageError}
                />
              ))
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function UserSearch({
  values,
  onToggle,
  onUsersLoaded,
  searchPlaceholder = "Search members…",
  emptyMessage = "No users found",
  className,
}: UserSearchProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserSearchUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserSearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<
    Record<UserPlatformSectionKey, boolean>
  >({
    agent: true,
    talent: true,
    external: true,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const MIN_SKELETON_MS = 400;
    const start = Date.now();

    const fetchUsers = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: usersRows, error } = await supabase
          .from("users")
          .select(
            "id, first_name, last_name, avatar_url, email, user_platform_id, user_platform(name, code)"
          );

        if (error) throw error;

        const mappedUsers: UserSearchUser[] = (usersRows ?? []).map((row) =>
          mapDbUserToUserSearchUser(row as DbUserSearchRow)
        );

        setUsers(mappedUsers);
        setFilteredUsers(mappedUsers);
        onUsersLoaded?.(mappedUsers);
      } catch (err) {
        console.error("[user-search] Error fetching users:", err);
      } finally {
        const elapsed = Date.now() - start;
        if (elapsed < MIN_SKELETON_MS) {
          await new Promise((r) => setTimeout(r, MIN_SKELETON_MS - elapsed));
        }
        setLoading(false);
      }
    };

    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount; onUsersLoaded is optional callback
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredUsers(
      users.filter(
        (u) =>
          u.displayName.toLowerCase().includes(query) ||
          (u.email?.toLowerCase().includes(query) ?? false)
      )
    );
  }, [searchQuery, users]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const currentUser = user?.email ? users.find((u) => u.email === user.email) : null;

  const usersBySection = useMemo(() => {
    const grouped: Record<UserPlatformSectionKey, UserSearchUser[]> = {
      agent: [],
      talent: [],
      external: [],
    };
    for (const u of filteredUsers) {
      grouped[u.sectionKey].push(u);
    }
    return grouped;
  }, [filteredUsers]);

  const visibleSections = useMemo(
    () => USER_SEARCH_SECTIONS.filter((section) => usersBySection[section.key].length > 0),
    [usersBySection]
  );

  const hasAnyUsers = filteredUsers.length > 0;

  const markImageError = (userId: string) => {
    setImageErrors((prev) => ({ ...prev, [userId]: true }));
  };

  const toggleSection = (key: UserPlatformSectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading users"
        className={cn(
          "flex h-full max-h-full min-h-0 flex-col overflow-hidden",
          contentMaxHeightClass,
          className
        )}
      >
        <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
          <Skeleton className="h-9 w-full rounded-[3px] bg-neutral-200/65" />
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain bg-white/80 p-2 backdrop-blur-xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="h-6 w-6 shrink-0 rounded-full bg-neutral-200/70" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 max-w-[140px] rounded-[3px] bg-neutral-200/65" />
                <Skeleton className="h-3 max-w-[180px] rounded-[3px] bg-neutral-200/55" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full max-h-full min-h-0 flex-col overflow-hidden",
        contentMaxHeightClass,
        className
      )}
    >
      <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              e.stopPropagation();
              setSearchQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") setSearchQuery("");
            }}
            placeholder={searchPlaceholder}
            className={cn(
              "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-2 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none",
              searchQuery.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white/80 backdrop-blur-xl"
        onWheel={(e) => e.stopPropagation()}
      >
        {!hasAnyUsers ? (
          <div className="px-4 py-2 text-sm font-light text-gray-500">{emptyMessage}</div>
        ) : (
          SECTION_ORDER.map((sectionKey) => {
            const section = USER_SEARCH_SECTIONS.find((s) => s.key === sectionKey);
            if (!section || !visibleSections.some((s) => s.key === sectionKey)) {
              return null;
            }

            return (
              <PlatformSection
                key={sectionKey}
                section={section}
                users={usersBySection[sectionKey]}
                expanded={expandedSections[sectionKey]}
                onToggleExpanded={() => toggleSection(sectionKey)}
                values={values}
                currentUserId={currentUser?.id}
                imageErrors={imageErrors}
                onToggle={onToggle}
                onImageError={markImageError}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
