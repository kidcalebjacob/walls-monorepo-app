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

interface CompanyFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    industry: string;
    status: string;
    employeeCount: string;
    revenueRange: string;
    country: string;
  };
  onFilterChange: (filterKey: string, value: string) => void;
}

export function CompanyFilter({
  isOpen,
  onClose,
  filters,
  onFilterChange,
}: CompanyFilterProps) {
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
            {/* Industry Filter */}
            <div>
              <Select
                value={filters.industry || "all"}
                onValueChange={(value) => onFilterChange("industry", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Industry:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Entertainment">Entertainment</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Employee Count Filter */}
            <div>
              <Select
                value={filters.employeeCount || "all"}
                onValueChange={(value) => onFilterChange("employeeCount", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Employee Count:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="1-10">1-10</SelectItem>
                  <SelectItem value="11-50">11-50</SelectItem>
                  <SelectItem value="51-200">51-200</SelectItem>
                  <SelectItem value="201-500">201-500</SelectItem>
                  <SelectItem value="501-1000">501-1000</SelectItem>
                  <SelectItem value="1000+">1000+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Revenue Range Filter */}
            <div>
              <Select
                value={filters.revenueRange || "all"}
                onValueChange={(value) => onFilterChange("revenueRange", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Revenue:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="0-1M">$0 - $1M</SelectItem>
                  <SelectItem value="1M-10M">$1M - $10M</SelectItem>
                  <SelectItem value="10M-50M">$10M - $50M</SelectItem>
                  <SelectItem value="50M-100M">$50M - $100M</SelectItem>
                  <SelectItem value="100M+">$100M+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Country Filter */}
            <div>
              <Select
                value={filters.country || "all"}
                onValueChange={(value) => onFilterChange("country", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Country:</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">—</SelectItem>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="UK">UK</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="Australia">Australia</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-black/10">
          <button
            onClick={() => {
              onFilterChange("industry", "");
              onFilterChange("status", "");
              onFilterChange("employeeCount", "");
              onFilterChange("revenueRange", "");
              onFilterChange("country", "");
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
