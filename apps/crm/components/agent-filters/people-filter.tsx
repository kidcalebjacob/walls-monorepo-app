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
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { CompanySearch } from "@/components/ui/searches/companySearch/company-search";

interface UserData {
  id: string;
  displayName: string;
  userType: string;
}

interface LeadSource {
  id: string;
  name: string;
}

interface LeadsFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    status: string;
    source: string;
    createdBy: string;
    searchTerm: string;
    country: string;
    companyId: string;
    verified: string;
  };
  onFilterChange: (filterKey: string, value: string) => void;
}

export function LeadsFilter({
  isOpen,
  onClose,
  filters,
  onFilterChange,
}: LeadsFilterProps) {
  const [employees, setEmployees] = useState<UserData[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>("");
  const [loading, setLoading] = useState({
    employees: true,
    sources: true,
    countries: true
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const db = getFirestore();
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("userType", "in", ["Super Admin", "Admin", "Agent"])
        );
        
        const querySnapshot = await getDocs(q);
        const employeesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().displayName || doc.data().name || "Unknown User",
          userType: doc.data().userType
        }));
        
        employeesList.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        setEmployees(employeesList);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setLoading(prev => ({ ...prev, employees: false }));
      }
    };

    const fetchLeadSources = async () => {
      try {
        const db = getFirestore();
        const sourcesCollection = collection(db, "typesLeadsLeadSource");
        const snapshot = await getDocs(sourcesCollection);
        
        const sourcesData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || "",
        }));
        
        // Sort sources alphabetically by name
        sourcesData.sort((a, b) => a.name.localeCompare(b.name));
        
        setLeadSources(sourcesData);
      } catch (error) {
        console.error("Error fetching lead sources:", error);
      } finally {
        setLoading(prev => ({ ...prev, sources: false }));
      }
    };

    const fetchCountries = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('people')
          .select('country')
          .eq('person_type', 'contact')
          .not('country', 'is', null);
        
        if (error) {
          console.error("Error fetching countries:", error);
          setCountries([]);
          return;
        }

        // Extract unique countries and sort them
        const uniqueCountries = Array.from(new Set(
          data.map((person: any) => person.country).filter(Boolean)
        )) as string[];
        
        uniqueCountries.sort();
        setCountries(uniqueCountries);
      } catch (error) {
        console.error("Error fetching countries:", error);
        setCountries([]);
      } finally {
        setLoading(prev => ({ ...prev, countries: false }));
      }
    };

    fetchEmployees();
    fetchLeadSources();
    fetchCountries();
  }, []);

  // Resolve the company name for a companyId that arrived via the URL on mount (e.g. shared link
  // or page reload), since CompanySearch displays by name but the filter/URL state only carries the id.
  // Runs once — later selections already set selectedCompanyName synchronously via onSelectCompany.
  useEffect(() => {
    const initialCompanyId = filters.companyId;
    if (!initialCompanyId) return;
    let cancelled = false;
    const resolveCompanyName = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('companies')
          .select('name')
          .eq('id', initialCompanyId)
          .maybeSingle();
        if (!cancelled && !error && data?.name) {
          setSelectedCompanyName(data.name);
        }
      } catch (error) {
        console.error("Error resolving company name:", error);
      }
    };
    resolveCompanyName();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {/* Country Filter */}
            <div>
              <Select
                value={filters.country || "all"}
                onValueChange={(value) => onFilterChange("country", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Country:</span>
                    <SelectValue placeholder={loading.countries ? "Loading countries..." : ""} />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  {countries.map((country) => (
                    <SelectItem 
                      key={country} 
                      value={country}
                    >
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Companies Filter */}
            <div>
              <div className="border border-transparent rounded-full px-4 hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                <div className="flex items-center gap-2 h-10">
                  <span className="text-neutral-700 text-sm">Company:</span>
                  <CompanySearch
                    value={selectedCompanyName}
                    placeholder="All companies"
                    onChange={(companyName) => {
                      if (!companyName) {
                        setSelectedCompanyName("");
                        onFilterChange("companyId", "");
                      } else {
                        setSelectedCompanyName(companyName);
                      }
                    }}
                    onSelectCompany={(company) => {
                      setSelectedCompanyName(company.name);
                      onFilterChange("companyId", company.id);
                    }}
                    className="flex-1"
                    hideChevron={true}
                  />
                </div>
              </div>
            </div>

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
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Proposal">Proposal</SelectItem>
                  <SelectItem value="Negotiation">Negotiation</SelectItem>
                  <SelectItem value="Closed Won">Closed Won</SelectItem>
                  <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Verified Filter */}
            <div>
              <Select
                value={filters.verified || "all"}
                onValueChange={(value) => onFilterChange("verified", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Verified:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="true">Verified</SelectItem>
                  <SelectItem value="false">Not Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lead Source Filter */}
            <div>
              <Select
                value={filters.source || "all"}
                onValueChange={(value) => onFilterChange("source", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Source:</span>
                    <SelectValue placeholder={loading.sources ? "Loading sources..." : ""} />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  {leadSources.map((source) => (
                    <SelectItem 
                      key={source.id} 
                      value={source.name}
                    >
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Created By Filter */}
            <div>
              <Select
                value={filters.createdBy || "all"}
                onValueChange={(value) => onFilterChange("createdBy", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Created By:</span>
                    <SelectValue placeholder={loading.employees ? "Loading users..." : ""} />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem 
                      key={employee.id} 
                      value={employee.id}
                    >
                      {employee.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-black/10">
          <button
            onClick={() => {
              onFilterChange("status", "");
              onFilterChange("source", "");
              onFilterChange("createdBy", "");
              onFilterChange("searchTerm", "");
              onFilterChange("country", "");
              onFilterChange("companyId", "");
              onFilterChange("verified", "");
              setSelectedCompanyName("");
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
