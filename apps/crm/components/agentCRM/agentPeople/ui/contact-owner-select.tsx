"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { parseUserPlatform } from "@/components/ui/searches/userSearch/user-search";
import { AgentOption } from "../index/types";
import { cn } from "@/lib/utils";

const UNASSIGNED_VALUE = "__unassigned__";

interface ContactOwnerSelectProps {
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  agents?: AgentOption[];
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

async function fetchAgentOptions(): Promise<AgentOption[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, avatar_url, email, is_admin, user_platform(name, code)")
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("Error fetching agents:", error);
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const platform = parseUserPlatform(
        row.user_platform as { name: string; code: string } | { name: string; code: string }[] | null
      );
      const code = platform?.code?.toLowerCase();
      return code === "agent" || row.is_admin;
    })
    .map((row) => {
      const displayName =
        `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.email || "Unknown";
      return {
        id: row.id,
        displayName,
        email: row.email || "",
        avatarUrl: row.avatar_url ?? null,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function AgentAvatar({ agent, size = "sm" }: { agent: AgentOption; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "w-4 h-4" : "w-5 h-5";
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";

  if (agent.avatarUrl) {
    return (
      <div className={cn("relative overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center", dim)}>
        <Image
          src={agent.avatarUrl}
          alt={agent.displayName}
          fill
          sizes={size === "xs" ? "16px" : "20px"}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center", dim)}>
      <span className={cn(textSize, "text-gray-600")}>{agent.displayName.charAt(0)}</span>
    </div>
  );
}

export function ContactOwnerSelect({
  value,
  onValueChange,
  agents: agentsProp,
  className,
  compact = false,
  disabled = false,
  onClick,
}: ContactOwnerSelectProps) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentOption[]>(agentsProp ?? []);
  const [loading, setLoading] = useState(!agentsProp);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (agentsProp) {
      setAgents(agentsProp);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchAgentOptions().then((list) => {
      if (!cancelled) {
        setAgents(list);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [agentsProp]);

  const currentUser = user?.email ? agents.find((a) => a.email === user.email) : null;
  const selectedAgent = value ? agents.find((a) => a.id === value) : null;

  const filteredAgents = searchQuery.trim()
    ? agents.filter(
        (agent) =>
          agent.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : agents;

  const selectValue = value || UNASSIGNED_VALUE;

  return (
    <Select
      value={selectValue}
      disabled={disabled}
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSearchQuery("");
        else setTimeout(() => inputRef.current?.focus(), 0);
      }}
      onValueChange={(val) => {
        onValueChange(val === UNASSIGNED_VALUE ? null : val);
        setSearchQuery("");
      }}
    >
      <SelectTrigger
        className={cn(
          compact
            ? "h-auto min-h-0 border-0 bg-transparent shadow-none px-0 py-0 focus:ring-0 [&>svg]:hidden max-w-full"
            : "border-0 bg-transparent w-full [&>*]:border-0 [&>*]:bg-transparent [&_*]:font-light [&_*]:text-neutral-900 focus:ring-0 h-8",
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
      >
        {selectedAgent ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <AgentAvatar agent={selectedAgent} size={compact ? "xs" : "sm"} />
            <span className={cn("truncate text-left", compact ? "text-sm font-light" : "")}>
              {selectedAgent.id === currentUser?.id ? "You" : selectedAgent.displayName}
            </span>
          </div>
        ) : (
          <span className={cn(compact ? "text-sm font-light text-muted-foreground" : "text-gray-500")}>
            <SelectValue placeholder="Unassigned" />
          </span>
        )}
      </SelectTrigger>
      <SelectContent
        className="bg-neutral-300/20 backdrop-blur-xl border border-white/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-gray-900/10">
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
            placeholder="Search agents..."
            className="w-full px-3 py-2 text-sm border-1 rounded-md bg-black/10 backdrop-blur-xl focus:outline-none placeholder:text-gray-600"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {loading ? (
          <div className="py-2 px-4 text-sm text-gray-500">Loading...</div>
        ) : (
          <>
            <SelectItem
              value={UNASSIGNED_VALUE}
              className={cn(
                "rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 pr-4 pl-2 [&>span:first-child]:hidden",
                !value ? "bg-kenoo-yellow/40" : ""
              )}
            >
              <span className="text-sm font-light text-muted-foreground">Unassigned</span>
            </SelectItem>
            {filteredAgents.length === 0 ? (
              <div className="py-2 px-4 text-sm text-gray-500">No agents found</div>
            ) : (
              filteredAgents.map((agent) => (
                <SelectItem
                  key={agent.id}
                  value={agent.id}
                  className={cn(
                    "rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 pr-4 pl-2 [&>span:first-child]:hidden",
                    value === agent.id ? "bg-kenoo-yellow/40" : ""
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <AgentAvatar agent={agent} />
                    <span className="truncate">
                      {agent.id === currentUser?.id ? "You" : agent.displayName}
                      {!compact && (
                        <span className="text-gray-500"> &lt;{agent.email}&gt;</span>
                      )}
                    </span>
                  </div>
                </SelectItem>
              ))
            )}
          </>
        )}
      </SelectContent>
    </Select>
  );
}

export { fetchAgentOptions };
