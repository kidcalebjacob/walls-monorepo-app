"use client";

import { X, Filter, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";

interface OwnerOption {
  id: string;
  displayName: string;
}

interface DealsFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    status: string;
    stage: string;
    owner: string;
    searchTerm: string;
    amountRange: string;
  };
  onFilterChange: (filterKey: string, value: string) => void;
}

export function DealsFilter({
  isOpen,
  onClose,
  filters,
  onFilterChange,
}: DealsFilterProps) {
  const { user } = useAuth();
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState({
    owners: true,
    stages: true
  });

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const supabase = getSupabaseClient();

        // Get current user's app ID so we can exclude them from the list
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let currentAppUserId: string | null = null;
        if (authUser?.email) {
          const { data: meData } = await supabase
            .from("users")
            .select("id")
            .eq("email", authUser.email)
            .single();
          currentAppUserId = meData?.id ?? null;
          setCurrentUserId(currentAppUserId);
        }

        const { data: teamData, error: teamError } = await supabase
          .from("team")
          .select("user_id")
          .not("user_id", "is", null);

        if (teamError || !teamData?.length) {
          setOwners([]);
          return;
        }

        const userIds = Array.from(
          new Set(teamData.map((t: any) => t.user_id).filter(Boolean))
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

        const list: OwnerOption[] = (usersData || [])
          .filter((u: any) => u.id !== currentAppUserId)
          .map((u: any) => {
            const first = u.first_name || "";
            const last = u.last_name || "";
            const displayName = `${first} ${last}`.trim() || (u.email as string) || "Unknown";
            return { id: u.id, displayName };
          });

        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setOwners(list);
      } catch (error) {
        console.error("Error fetching owners for filter:", error);
        setOwners([]);
      } finally {
        setLoading(prev => ({ ...prev, owners: false }));
      }
    };

    const fetchStages = async () => {
      try {
        const db = getFirestore();
        const stagesRef = collection(db, "typesDealsStage");
        const querySnapshot = await getDocs(stagesRef);

        const stagesList = querySnapshot.docs.map(doc => doc.data().name || "");
        stagesList.sort();

        setStages(stagesList);
      } catch (error) {
        console.error("Error fetching stages:", error);
      } finally {
        setLoading(prev => ({ ...prev, stages: false }));
      }
    };

    fetchOwners();
    fetchStages();
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
                value={filters.status === "" ? "active" : filters.status}
                onValueChange={(value) => onFilterChange("status", value === "active" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Status:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stage Filter */}
            <div>
              <Select
                value={filters.stage || "all"}
                onValueChange={(value) => onFilterChange("stage", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Stage:</span>
                    <SelectValue placeholder={loading.stages ? "Loading stages..." : ""} />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem
                      key={stage}
                      value={stage}
                    >
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deal Owner Filter */}
            <div>
              <Select
                value={filters.owner === "" ? "me" : filters.owner}
                onValueChange={(value) => onFilterChange("owner", value === "me" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Deal Owner:</span>
                    <SelectValue placeholder={loading.owners ? "Loading..." : ""} />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="me">Me</SelectItem>
                  <SelectItem value="all">—</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem
                      key={owner.id}
                      value={owner.id}
                    >
                      {owner.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Range Filter */}
            <div>
              <Select
                value={filters.amountRange || "all"}
                onValueChange={(value) => onFilterChange("amountRange", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Amount Range:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="0-1000">$0 - $1,000</SelectItem>
                  <SelectItem value="1000-5000">$1,000 - $5,000</SelectItem>
                  <SelectItem value="5000-10000">$5,000 - $10,000</SelectItem>
                  <SelectItem value="10000+">$10,000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-black/10">
          <button
            onClick={() => {
              onFilterChange("status", "");
              onFilterChange("stage", "");
              onFilterChange("owner", "");
              onFilterChange("searchTerm", "");
              onFilterChange("amountRange", "");
            }}
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
