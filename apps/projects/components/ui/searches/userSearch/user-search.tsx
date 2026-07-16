"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Search } from "lucide-react";
import { createClient } from "@walls/supabase/client";
import { useAuth } from "@walls/auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@walls/ui/skeleton";
import { FallbackEmailAvatar } from "@/components/ui/fallback-email-avatar";

const SKELETON_ROW_WIDTHS = ["w-[88%]", "w-[72%]", "w-[80%]", "w-[64%]", "w-[76%]", "w-[70%]"] as const;

export interface UserSearchUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string | null;
  platformName?: string | null;
  platformCode?: string | null;
}

type DbUserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
  user_platform?: { name: string | null; code: string | null } | { name: string | null; code: string | null }[] | null;
};

export function mapDbUserToUserSearchUser(row: DbUserRow): UserSearchUser {
  const firstName = row.first_name || "";
  const lastName = row.last_name || "";
  const platform = Array.isArray(row.user_platform)
    ? row.user_platform[0]
    : row.user_platform;

  return {
    id: row.id,
    displayName: `${firstName} ${lastName}`.trim() || row.email || "Unknown",
    avatarUrl: row.avatar_url ?? null,
    email: row.email ?? null,
    platformName: platform?.name ?? null,
    platformCode: platform?.code ?? null,
  };
}

interface UserSearchProps {
  className?: string;
  values: string[];
  onToggle: (userId: string) => void;
  onUsersLoaded?: (users: UserSearchUser[]) => void;
  /** When set, only members of this WALLS account are searchable. */
  accountId?: string | null;
}

function UserListSkeleton() {
  return (
    <>
      {SKELETON_ROW_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center rounded-none px-4 py-2 pr-16">
          <div className="flex min-w-0 w-full items-center space-x-3">
            <Skeleton
              className="h-6 w-6 shrink-0 rounded-full bg-neutral-200/70"
              style={{ animationDelay: `${i * 75}ms` }}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton
                className={cn("h-3.5 max-w-full rounded-[3px] bg-neutral-200/65", w)}
                style={{ animationDelay: `${i * 75 + 40}ms` }}
              />
              <Skeleton
                className="h-2.5 w-[55%] max-w-full rounded-[3px] bg-neutral-200/50"
                style={{ animationDelay: `${i * 75 + 80}ms` }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
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

export function UserSearch({
  className,
  values,
  onToggle,
  onUsersLoaded,
  accountId,
}: UserSearchProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserSearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<UserSearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        if (!accountId) {
          setUsers([]);
          onUsersLoaded?.([]);
          return;
        }

        const supabase = createClient();
        const { data: membershipData, error: membershipError } = await supabase
          .from("account_users")
          .select("user_id")
          .eq("account_id", accountId)
          .not("user_id", "is", null);

        if (membershipError) throw membershipError;

        const userIds = Array.from(
          new Set(
            (membershipData ?? []).map((row) => row.user_id).filter(Boolean),
          ),
        ) as string[];

        if (userIds.length === 0) {
          setUsers([]);
          onUsersLoaded?.([]);
          return;
        }

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select(
            "id, first_name, last_name, avatar_url, email, user_platform(name, code)",
          )
          .in("id", userIds);

        if (usersError) throw usersError;

        const mapped = (usersData ?? []).map(mapDbUserToUserSearchUser);
        mapped.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(mapped);
        onUsersLoaded?.(mapped);
      } catch (error) {
        console.error("Error fetching users:", error);
        setUsers([]);
        onUsersLoaded?.([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchUsers();
  }, [accountId, onUsersLoaded]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const q = searchQuery.toLowerCase();
    setFilteredUsers(
      users.filter(
        (entry) =>
          entry.displayName.toLowerCase().includes(q) ||
          (entry.email?.toLowerCase().includes(q) ?? false),
      ),
    );
  }, [searchQuery, users]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const markImageError = (userId: string) => {
    setImageErrors((prev) => ({ ...prev, [userId]: true }));
  };

  const userLabel = (entry: UserSearchUser) => {
    return entry.id === user?.id ? "You" : entry.displayName;
  };

  return (
    <div
      className={cn(
        "flex max-h-[400px] flex-col overflow-hidden bg-white/80 backdrop-blur-xl",
        className,
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
            placeholder="Search account members…"
            className={cn(
              "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-2 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none",
              searchQuery.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
            )}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white/80 backdrop-blur-xl">
        {loading ? (
          <UserListSkeleton />
        ) : filteredUsers.length === 0 ? (
          <div className="px-4 py-2 text-sm font-light text-gray-500">
            No users found
          </div>
        ) : (
          filteredUsers.map((entry) => {
            const isSelected = values.includes(entry.id);
            const label = userLabel(entry);

            return (
              <div
                key={entry.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(entry.id);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={cn(
                  "relative flex cursor-pointer items-center rounded-none px-4 py-2 pr-16 hover:bg-neutral-100/60 focus:bg-neutral-100/60",
                  isSelected && "bg-neutral-100/60",
                )}
              >
                <div className="flex min-w-0 w-full items-center space-x-3">
                  <UserAvatar
                    name={label}
                    avatarUrl={entry.avatarUrl}
                    hasImageError={imageErrors[entry.id]}
                    onImageError={() => markImageError(entry.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-light">{label}</span>
                    {entry.email ? (
                      <span className="block truncate text-xs font-light text-neutral-400">
                        {entry.email}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isSelected ? (
                  <Check className="absolute right-4 h-4 w-4 text-neutral-700" />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
