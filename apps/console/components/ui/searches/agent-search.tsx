"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { createClient } from "@walls/supabase/client";
import { useAuth } from "@walls/auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@walls/ui/skeleton";
import { FallbackEmailAvatar } from "@/components/ui/fallback-email-avatar";

const SKELETON_ROW_WIDTHS = ["w-[88%]", "w-[72%]", "w-[80%]", "w-[64%]", "w-[76%]", "w-[70%]"] as const;

interface Agent {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string | null;
  /** Set when listing via `team` rows — used for "You" label. */
  linkedUserId?: string;
}

interface AgentSearchProps {
  value: string;
  onSelect: (agentId: string) => void;
  /** Limit list to members of this team group (management header switcher). */
  teamGroupId?: string;
  /** `user` = users.id (default). `team` = team.id — use with `teamGroupId`. */
  idField?: "user" | "team";
  /** When set, only these user IDs are listed (e.g. project members). */
  allowedUserIds?: string[];
  emptyMessage?: string;
}

function AgentListSkeleton() {
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

function AgentAvatar({
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

function mapUserRowToAgent(u: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
}): Agent {
  const firstName = u.first_name || "";
  const lastName = u.last_name || "";
  const displayName = `${firstName} ${lastName}`.trim() || u.email || "Unknown";
  return {
    id: u.id,
    displayName,
    avatarUrl: u.avatar_url ?? null,
    email: u.email ?? null,
  };
}

export function AgentSearch({
  value,
  onSelect,
  teamGroupId,
  idField = "user",
  allowedUserIds,
  emptyMessage = "No people found",
}: AgentSearchProps) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
      try {
        const supabase = createClient();

        if (allowedUserIds !== undefined) {
          if (allowedUserIds.length === 0) {
            setAgents([]);
            return;
          }

          const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, first_name, last_name, avatar_url, email")
            .in("id", allowedUserIds);

          if (usersError) {
            throw usersError;
          }

          const agentsData = (usersData ?? []).map(mapUserRowToAgent);
          agentsData.sort((a, b) => a.displayName.localeCompare(b.displayName));
          setAgents(agentsData);
          return;
        }

        if (teamGroupId || idField === "team") {
          let teamQuery = supabase
            .from("team")
            .select(
              "id, user_id, user:user_id(id, first_name, last_name, avatar_url, email)",
            )
            .not("user_id", "is", null);

          if (teamGroupId) {
            teamQuery = teamQuery.eq("team_group_id", teamGroupId);
          }

          const { data: teamRows, error: teamError } = await teamQuery;

          if (teamError) {
            throw teamError;
          }

          const agentsData: Agent[] = (teamRows ?? [])
            .map((row) => {
              const rawUser = row.user;
              const u = Array.isArray(rawUser) ? rawUser[0] : rawUser;
              if (!u || !row.user_id) return null;

              const firstName = u.first_name || "";
              const lastName = u.last_name || "";
              const displayName =
                `${firstName} ${lastName}`.trim() || u.email || "Unknown";

              return {
                id: idField === "team" ? row.id : row.user_id,
                displayName,
                avatarUrl: u.avatar_url ?? null,
                email: u.email ?? null,
                linkedUserId: row.user_id as string,
              };
            })
            .filter(Boolean) as Agent[];

          agentsData.sort((a, b) => a.displayName.localeCompare(b.displayName));
          setAgents(agentsData);
          return;
        }

        const { data: teamData, error: teamError } = await supabase
          .from("team")
          .select("user_id")
          .not("user_id", "is", null);

        if (teamError) {
          throw teamError;
        }

        if (!teamData || teamData.length === 0) {
          setAgents([]);
          return;
        }

        const uniqueUserIds = new Set(
          teamData.map((t) => t.user_id).filter(Boolean),
        );
        const userIds = Array.from(uniqueUserIds) as string[];

        if (userIds.length === 0) {
          setAgents([]);
          return;
        }

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, first_name, last_name, avatar_url, email")
          .in("id", userIds);

        if (usersError) {
          throw usersError;
        }

        const agentsData = (usersData || []).map(mapUserRowToAgent);
        agentsData.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAgents(agentsData);
      } catch (error) {
        console.error("Error fetching agents:", error);
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, [teamGroupId, idField, allowedUserIds?.join(",")]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredAgents(agents);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredAgents(
      agents.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          (a.email?.toLowerCase().includes(q) ?? false)
      )
    );
  }, [searchQuery, agents]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const currentUserAgent = user?.id
    ? agents.find(
        (a) => a.linkedUserId === user.id || a.id === user.id,
      )
    : user?.email
      ? agents.find((a) => a.email === user.email)
      : null;

  const markImageError = (agentId: string) => {
    setImageErrors((prev) => ({ ...prev, [agentId]: true }));
  };

  const agentLabel = (agent: Agent) => {
    const isYou =
      agent.id === currentUserAgent?.id ||
      (user?.id != null &&
        (agent.linkedUserId === user.id || agent.id === user.id));
    return isYou ? "You" : agent.displayName;
  };

  return (
    <div className="flex max-h-[400px] flex-col overflow-hidden bg-white/80 backdrop-blur-xl">
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
            placeholder="Search…"
            className={cn(
              "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-2 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none",
              searchQuery.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white/80 backdrop-blur-xl">
        {loading ? (
          <AgentListSkeleton />
        ) : filteredAgents.length === 0 ? (
          <div className="px-4 py-2 text-sm font-light text-gray-500">{emptyMessage}</div>
        ) : (
          filteredAgents.map((agent) => {
            const isSelected = value === agent.id;
            const label = agentLabel(agent);

            return (
              <div
                key={agent.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(agent.id);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={cn(
                  "relative flex cursor-pointer items-center rounded-none px-4 py-2 pr-16 hover:bg-neutral-100/60 focus:bg-neutral-100/60",
                  isSelected && "bg-neutral-100/60"
                )}
              >
                <div className="flex min-w-0 w-full items-center space-x-3">
                  <AgentAvatar
                    name={label}
                    avatarUrl={agent.avatarUrl}
                    hasImageError={imageErrors[agent.id]}
                    onImageError={() => markImageError(agent.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-light">{label}</span>
                    {agent.email ? (
                      <span className="block truncate text-xs font-light text-neutral-400">
                        {agent.email}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
