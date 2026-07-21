"use client";

import { X, Filter, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { TalentFilterSelect } from "./talent-filter-select";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";

interface OwnerOption {
  id: string;
  displayName: string;
}

interface SequenceFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    status: string;
    is_campaign: string;
    searchTerm: string;
    talent: string;
    owner: string;
    use_case: string;
  };
  onFilterChange: (filterKey: string, value: string | string[]) => void;
  onReset: () => void;
}

export function SequenceFilter({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onReset,
}: SequenceFilterProps) {
  const { user } = useAuth();
  const [owners, setOwners] = useState<OwnerOption[]>([]);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: teamData, error: teamError } = await supabase
          .from("team")
          .select("user_id")
          .not("user_id", "is", null);

        if (teamError || !teamData?.length) {
          setOwners([]);
          return;
        }

        const userIds = Array.from(
          new Set(teamData.map((t) => t.user_id).filter(Boolean))
        ) as string[];

        if (userIds.length === 0) {
          setOwners([]);
          return;
        }

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", userIds);

        if (usersError) {
          setOwners([]);
          return;
        }

        const currentUserId = user?.id || null;
        const currentUserEmail = (user?.email || "").toLowerCase();

        const list: OwnerOption[] = (usersData || [])
          .filter((u) => {
            const matchesCurrentUserId = currentUserId ? u.id === currentUserId : false;
            const matchesCurrentUserEmail =
              currentUserEmail && typeof u.email === "string"
                ? u.email.toLowerCase() === currentUserEmail
                : false;
            return !matchesCurrentUserId && !matchesCurrentUserEmail;
          })
          .map((u) => {
            const first = u.first_name || "";
            const last = u.last_name || "";
            const displayName =
              `${first} ${last}`.trim() || (u.email as string) || "Unknown";
            return { id: u.id, displayName };
          });

        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setOwners(list);
      } catch (error) {
        console.error("Error fetching owners for filter:", error);
        setOwners([]);
      }
    };

    fetchOwners();
  }, [user?.email]);

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 w-80 bg-white/80 backdrop-blur-xl border-r border-white/30 transform transition-transform duration-200 ease-in-out rounded-none shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "z-[110]"
      )}
    >
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-black/10 flex justify-between items-center bg-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-black" strokeWidth={1.5} />
            <h2 className="text-lg font-semibold text-black">Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 cursor-pointer transition-all duration-300 hover:opacity-70"
          >
            <X className="h-[18px] w-[18px] text-black" strokeWidth={1.5} />
          </button>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Status Filter */}
            <div>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => onFilterChange("status", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Status:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Is Campaign Filter */}
            <div>
              <Select
                value={filters.is_campaign || "default"}
                onValueChange={(value) => onFilterChange("is_campaign", value === "default" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Is Campaign:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="default">Yes</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Use Case Filter */}
            <div>
              <Select
                value={filters.use_case || "all"}
                onValueChange={(value) => onFilterChange("use_case", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Use Case:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="scouting">Scouting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Talent Filter */}
            <div>
              <TalentFilterSelect
                selectedTalentIds={filters.talent ? filters.talent.split(',').filter(id => id.trim()) : []}
                onTalentChange={(talentIds) => onFilterChange("talent", talentIds.length > 0 ? talentIds.join(',') : '')}
              />
            </div>

            {/* Owner Filter (placed last) */}
            <div>
              <Select
                value={filters.owner || "default"}
                onValueChange={(value) =>
                  onFilterChange("owner", value === "default" ? "" : value)
                }
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Owner:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="default">Me</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-black/10">
          <button
            onClick={onReset}
            className="w-full h-[50px] rounded-full border border-transparent hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 text-black font-medium"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}

