"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search } from "lucide-react";
import { FallbackEmailAvatar } from "@/components/agentMail/ui/fallback-email-avatar";

export interface SenderSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** When false, only show the sender name in the trigger; email still shows in the dropdown list. */
  showEmailInTrigger?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

interface Sender {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  hasGmail: boolean;
}

function SenderAvatar({
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

export function SenderSearch({
  value,
  onValueChange,
  className,
  showEmailInTrigger = true,
  placeholder = "Select sender...",
  disabled = false,
}: SenderSearchProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [filteredSenders, setFilteredSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchIsAdmin = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const { data: currentUserData } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        setIsAdmin(currentUserData?.is_admin === true);
      } catch (e) {
        console.error("[sender-search] fetchIsAdmin error:", e);
        setIsAdmin(false);
      }
    };

    fetchIsAdmin();
  }, [user?.id]);

  useEffect(() => {
    const MIN_SKELETON_MS = 400;
    const start = Date.now();

    const fetchSenders = async () => {
      try {
        const supabase = getSupabaseClient();

        const { data: teamData, error: teamError } = await supabase
          .from("team")
          .select("user_id")
          .not("user_id", "is", null);

        if (teamError) {
          throw teamError;
        }

        if (!teamData || teamData.length === 0) {
          setSenders([]);
          return;
        }

        const uniqueUserIds = new Set(teamData.map((t) => t.user_id).filter(Boolean));
        const userIds = Array.from(uniqueUserIds) as string[];

        if (userIds.length === 0) {
          setSenders([]);
          return;
        }

        const { data: gmailConnections, error: connectionsError } = await supabase
          .from("user_connections")
          .select("user_id")
          .in("user_id", userIds)
          .eq("provider", "google")
          .eq("service", "gmail")
          .is("revoked_at", null);

        if (connectionsError) {
          console.error("Error fetching Gmail connections:", connectionsError);
        }

        const usersWithGmail = new Set(
          (gmailConnections || []).map((c) => c.user_id).filter(Boolean)
        );

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, first_name, last_name, avatar_url, email")
          .in("id", userIds);

        if (usersError) {
          throw usersError;
        }

        const sendersData: Sender[] = (usersData || []).map((row) => {
          const firstName = row.first_name || "";
          const lastName = row.last_name || "";
          const displayName = `${firstName} ${lastName}`.trim() || row.email || "Unknown";

          return {
            id: row.id,
            displayName,
            email: row.email || "",
            avatarUrl: row.avatar_url,
            hasGmail: usersWithGmail.has(row.id),
          };
        });

        const currentUserEmail = user?.email;
        sendersData.sort((a, b) => {
          if (a.email === currentUserEmail && b.email !== currentUserEmail) return -1;
          if (b.email === currentUserEmail && a.email !== currentUserEmail) return 1;
          return a.displayName.localeCompare(b.displayName);
        });

        setSenders(sendersData);
        setFilteredSenders(sendersData);
      } catch (error) {
        console.error("Error fetching senders:", error);
      } finally {
        const elapsed = Date.now() - start;
        if (elapsed < MIN_SKELETON_MS) {
          await new Promise((r) => setTimeout(r, MIN_SKELETON_MS - elapsed));
        }
        setLoading(false);
      }
    };

    fetchSenders();
  }, [user?.email]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSenders(senders);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredSenders(
      senders.filter(
        (sender) =>
          sender.displayName.toLowerCase().includes(query) ||
          sender.email.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, senders]);

  const selectedSender = senders.find((s) => s.id === value);
  const currentUser = user?.email ? senders.find((s) => s.email === user.email) : null;

  const isCurrentUserSender = (sender: Sender) =>
    Boolean(currentUser && sender.id === currentUser.id);

  const canSelectSender = (sender: Sender) => {
    if (!sender.hasGmail) return false;
    if (isAdmin) return true;
    return isCurrentUserSender(sender);
  };

  const senderLabel = (sender: Sender) =>
    isCurrentUserSender(sender) ? "You" : sender.displayName;

  const triggerLabel = selectedSender
    ? showEmailInTrigger
      ? `${senderLabel(selectedSender)} <${selectedSender.email}>`
      : senderLabel(selectedSender)
    : placeholder;

  const markImageError = (senderId: string) => {
    setImageErrors((prev) => ({ ...prev, [senderId]: true }));
  };

  const handleConnectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    router.push("/agents/settings/connect");
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading senders"
        className={cn(
          "relative flex h-10 w-full items-center justify-between px-3 py-2",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-6 w-6 shrink-0 rounded-full bg-neutral-200/70" />
          <Skeleton className="h-4 max-w-[200px] flex-1 rounded-[3px] bg-neutral-200/65" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Select
        value=""
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setSearchQuery("");
          } else {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        onValueChange={() => {}}
      >
        <SelectTrigger
          disabled={disabled}
          className={cn(
            "relative flex h-10 w-full items-center justify-between border-0 bg-transparent px-3 py-2 shadow-none focus:ring-0 focus:ring-offset-0 [&>:last-child]:hidden",
            className
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectedSender ? (
              <SenderAvatar
                name={senderLabel(selectedSender)}
                avatarUrl={selectedSender.avatarUrl}
                hasImageError={imageErrors[selectedSender.id]}
                onImageError={() => markImageError(selectedSender.id)}
              />
            ) : null}
            <span className="truncate text-sm font-light text-neutral-500">{triggerLabel}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-neutral-500 stroke-[1.25]" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          align="start"
          sideOffset={8}
          className="!z-[9999] flex max-h-[min(500px,var(--radix-select-content-available-height))] min-w-[350px] w-full flex-col overflow-hidden rounded-lg bg-white/80 p-0 shadow-2xl backdrop-blur-xl [&>div]:!p-0"
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
                placeholder="Search senders…"
                className={cn(
                  "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-2 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none",
                  searchQuery.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white/80 backdrop-blur-xl">
            {filteredSenders.length === 0 ? (
              <div className="px-4 py-2 text-sm font-light text-gray-500">No senders found</div>
            ) : (
              filteredSenders.map((sender) => {
                const isSelected = value === sender.id;
                const label = senderLabel(sender);
                const selectable = canSelectSender(sender);
                const showConnect = !sender.hasGmail && isCurrentUserSender(sender);

                return (
                  <div
                    key={sender.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (selectable) {
                        onValueChange(sender.id);
                        setIsOpen(false);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className={cn(
                      "relative flex items-center rounded-none px-4 py-2",
                      selectable
                        ? "cursor-pointer hover:bg-neutral-100/60 focus:bg-neutral-100/60"
                        : "cursor-not-allowed opacity-50",
                      isSelected && selectable && "bg-neutral-100/60",
                      showConnect ? "pr-28" : "pr-16"
                    )}
                  >
                    <div className="flex min-w-0 w-full items-center space-x-3">
                      <SenderAvatar
                        name={label}
                        avatarUrl={sender.avatarUrl}
                        hasImageError={imageErrors[sender.id]}
                        onImageError={() => markImageError(sender.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-light">{label}</span>
                        {sender.email ? (
                          <span className="block truncate text-xs font-light text-neutral-400">
                            {sender.email}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {showConnect ? (
                      <button
                        type="button"
                        onClick={handleConnectClick}
                        className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded px-2 py-1 text-[10px] font-light lowercase tracking-wide text-[var(--kenoo-sky)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kenoo-sky)] focus-visible:ring-offset-1"
                      >
                        <Plus className="h-3 w-3" />
                        connect
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
