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
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { SequenceSwitch } from "@/components/agentCRM/agentSequences/ui/sequence-switch";
import { Portal } from "@radix-ui/react-portal";

interface EmployeeOption {
  id: string;
  displayName: string;
}

interface Country {
  id: string;
  name: string;
}

interface PrimaryNiche {
  id: string;
  name: string;
}

interface ScouterFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    agencyStatus: string;
    country: string;
    createdBy: string;
    primaryNiche: string;
    searchTerm: string;
    contactStatus: string;
    showHidden: string;
    showBlocked: string;
    showLiked: string;
  };
  onFilterChange: (filterKey: string, value: string) => void;
  onResetFilters: () => void;
  canManageBlocked: boolean;
}

const triggerClassName =
  "border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300";

const mobileTriggerClassName =
  "border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 h-16 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300";

export function ScouterFilter({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onResetFilters,
  canManageBlocked,
}: ScouterFilterProps) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [primaryNiches, setPrimaryNiches] = useState<PrimaryNiche[]>([]);
  const [loading, setLoading] = useState({
    employees: true,
    countries: true,
    niches: true
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const supabase = getSupabaseClient();

        const { data: teamData, error: teamError } = await supabase
          .from('team')
          .select('id, user_id')
          .not('user_id', 'is', null);

        if (teamError) {
          throw teamError;
        }

        if (!teamData || teamData.length === 0) {
          setEmployees([]);
          setLoading(prev => ({ ...prev, employees: false }));
          return;
        }

        const uniqueUserIds = new Set(teamData
          .map(t => t.user_id)
          .filter(Boolean));
        const userIds = Array.from(uniqueUserIds) as string[];

        if (userIds.length === 0) {
          setEmployees([]);
          setLoading(prev => ({ ...prev, employees: false }));
          return;
        }

        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', userIds);

        if (usersError) {
          throw usersError;
        }

        const userMap = new Map<string, { first_name: string; last_name: string; email: string }>();
        (usersData || []).forEach((u) => {
          userMap.set(u.id, {
            first_name: u.first_name || '',
            last_name: u.last_name || '',
            email: u.email || '',
          });
        });

        const employeesList: EmployeeOption[] = teamData
          .map((team) => {
            if (team.user_id === user?.id) return null;

            const userData = team.user_id ? userMap.get(team.user_id) : null;
            if (!userData) return null;

            const firstName = userData.first_name || '';
            const lastName = userData.last_name || '';
            const displayName = `${firstName} ${lastName}`.trim() || userData.email || 'Unknown';

            return {
              id: team.id,
              displayName,
            };
          })
          .filter((item): item is EmployeeOption => item !== null);

        employeesList.sort((a, b) => a.displayName.localeCompare(b.displayName));

        setEmployees(employeesList);
      } catch (error) {
        console.error("Error fetching employees:", error);
        setEmployees([]);
      } finally {
        setLoading(prev => ({ ...prev, employees: false }));
      }
    };

    const fetchCountries = async () => {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from("profiles")
          .select("country")
          .eq("type", "talent")
          .is("talent_id", null)
          .not("country", "is", null);

        if (error) {
          console.error("Error fetching countries:", error);
          setCountries([]);
          setLoading(prev => ({ ...prev, countries: false }));
          return;
        }

        const uniqueCountries = Array.from(
          new Set((data || []).map((p) => p.country).filter(Boolean))
        ) as string[];

        const countriesData: Country[] = uniqueCountries.map((country) => ({
          id: country,
          name: country,
        }));

        countriesData.sort((a, b) => a.name.localeCompare(b.name));

        setCountries(countriesData);
      } catch (error) {
        console.error("Error fetching countries:", error);
        setCountries([]);
      } finally {
        setLoading(prev => ({ ...prev, countries: false }));
      }
    };

    const fetchPrimaryNiches = async () => {
      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from("profile_categories")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) {
          console.error("Error fetching primary niches:", error);
          setPrimaryNiches([]);
          setLoading(prev => ({ ...prev, niches: false }));
          return;
        }

        const nichesData: PrimaryNiche[] = (data || []).map((row) => ({
          id: row.id,
          name: row.name,
        }));

        setPrimaryNiches(nichesData);
      } catch (error) {
        console.error("Error fetching primary niches:", error);
        setPrimaryNiches([]);
      } finally {
        setLoading(prev => ({ ...prev, niches: false }));
      }
    };

    fetchEmployees();
    fetchCountries();
    fetchPrimaryNiches();
  }, [user?.id]);

  const filterContent = (isMobile: boolean) => (
    <div className="space-y-6">
      {/* Agency Status Filter */}
      <div>
        <Select
          value={filters.agencyStatus || "all"}
          onValueChange={(value) => onFilterChange("agencyStatus", value === "all" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>Agency Status:</span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[120]"}>
            <SelectItem value="all">—</SelectItem>
            <SelectItem value="Signed">Signed</SelectItem>
            <SelectItem value="Unsigned">Unsigned</SelectItem>
            <SelectItem value="Unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contact Status Filter */}
      <div>
        <Select
          value={filters.contactStatus || "all"}
          onValueChange={(value) => onFilterChange("contactStatus", value === "all" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>Contact Status:</span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[120]"}>
            <SelectItem value="all">—</SelectItem>
            <SelectItem value="Contacted">Contacted</SelectItem>
            <SelectItem value="Not Contacted">Not Contacted</SelectItem>
            <SelectItem value="Deferred Contact">Deferred Contact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Primary Niche Filter */}
      <div>
        <Select
          value={filters.primaryNiche || "all"}
          onValueChange={(value) => onFilterChange("primaryNiche", value === "all" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>Niche:</span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[120]"}>
            <SelectItem value="all">—</SelectItem>
            {primaryNiches.map((niche) => (
              <SelectItem
                key={niche.id}
                value={niche.id}
              >
                {niche.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Country Filter */}
      <div>
        <Select
          value={filters.country || "all"}
          onValueChange={(value) => onFilterChange("country", value === "all" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>Country:</span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[120]"}>
            <SelectItem value="all">—</SelectItem>
            {countries.map((country) => (
              <SelectItem
                key={country.id}
                value={country.name}
              >
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scouted By Filter */}
      <div>
        <Select
          value={filters.createdBy || "default"}
          onValueChange={(value) => onFilterChange("createdBy", value === "default" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>Scouted By:</span>
              <SelectValue placeholder={loading.employees ? "Loading..." : "Select scout"} className={isMobile ? "text-lg" : undefined} />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[120]"}>
            <SelectItem value="default">Me</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {loading.employees ? (
              <SelectItem value="loading" disabled>Loading...</SelectItem>
            ) : employees.length === 0 ? (
              <SelectItem value="empty" disabled>No scouts found</SelectItem>
            ) : (
              employees.map((employee) => (
                <SelectItem
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.displayName}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Show Hidden Profiles Toggle */}
      <div
        className={cn(
          "flex items-center justify-between px-4 rounded-full border border-transparent transition-all duration-300",
          isMobile ? "h-16" : "h-10"
        )}
      >
        <span
          className={cn(
            "text-neutral-700 text-sm font-normal",
            isMobile && "text-lg"
          )}
        >
          Show Hidden Profiles
        </span>
        <SequenceSwitch
          checked={filters.showHidden === "true"}
          onCheckedChange={(checked) => onFilterChange("showHidden", checked ? "true" : "")}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {canManageBlocked && (
        <div
          className={cn(
            "flex items-center justify-between px-4 rounded-full border border-transparent transition-all duration-300",
            isMobile ? "h-16" : "h-10"
          )}
        >
          <span
            className={cn(
              "text-neutral-700 text-sm font-normal",
              isMobile && "text-lg"
            )}
          >
            Show Blocked Profiles
          </span>
          <SequenceSwitch
            checked={filters.showBlocked === "true"}
            onCheckedChange={(checked) => onFilterChange("showBlocked", checked ? "true" : "")}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Show Liked Profiles Toggle */}
      <div
        className={cn(
          "flex items-center justify-between px-4 rounded-full border border-transparent transition-all duration-300",
          isMobile ? "h-16" : "h-10"
        )}
      >
        <span
          className={cn(
            "text-neutral-700 text-sm font-normal",
            isMobile && "text-lg"
          )}
        >
          Show Liked Profiles
        </span>
        <SequenceSwitch
          checked={filters.showLiked === "true"}
          onCheckedChange={(checked) => onFilterChange("showLiked", checked ? "true" : "")}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Filter - Sidebar */}
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
            {filterContent(false)}
          </ScrollArea>

          <div className="p-6 border-t border-black/10">
            <button
              onClick={onResetFilters}
              className="w-full h-[50px] rounded-full border border-transparent hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 text-black font-medium"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Filter - Full Screen */}
      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9999] md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Full Screen Filter Content */}
            <div className="relative h-full w-full bg-white/80 backdrop-blur-xl flex flex-col">
              {/* Header */}
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

              {/* Filter Content */}
              <ScrollArea className="flex-1 px-6 py-4">
                {filterContent(true)}
              </ScrollArea>

              {/* Reset Button */}
              <div className="p-6 border-t border-black/10">
                <button
                  onClick={onResetFilters}
                  className="w-full h-16 rounded-full border border-transparent hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 text-black font-medium text-lg"
                >
                  <RotateCcw className="h-5 w-5" strokeWidth={1.5} />
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
