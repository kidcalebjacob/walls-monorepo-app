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
import { Portal } from "@radix-ui/react-portal";

interface PartnerHubFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    platform: string;
    searchTerm: string;
    talentHq: string;
    talentCategory: string;
  };
  onFilterChange: (filterKey: string, value: string) => void;
  availableHqs: string[];
  availableCategories: string[];
}

const triggerClassName =
  "border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300";

const mobileTriggerClassName =
  "border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 h-16 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300";

export function PartnerHubFilter({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  availableHqs,
  availableCategories,
}: PartnerHubFilterProps) {
  const handleResetFilters = () => {
    onFilterChange("platform", "");
    onFilterChange("talentHq", "");
    onFilterChange("talentCategory", "");
  };

  const filterContent = (isMobile: boolean) => (
    <div className="space-y-6">
      <div>
        <Select
          value={filters.platform || "all"}
          onValueChange={(value) => onFilterChange("platform", value === "all" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>
                Platform:
              </span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[70]"}>
            <SelectItem value="all">—</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Select
          value={filters.talentHq || "all"}
          onValueChange={(value) => onFilterChange("talentHq", value === "all" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>
                Talent HQ:
              </span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[70]"}>
            <SelectItem value="all">—</SelectItem>
            {availableHqs.map((hq) => (
              <SelectItem key={hq} value={hq}>
                {hq}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Select
          value={filters.talentCategory || "all"}
          onValueChange={(value) => onFilterChange("talentCategory", value === "all" ? "" : value)}
        >
          <SelectTrigger className={isMobile ? mobileTriggerClassName : triggerClassName}>
            <div className="flex items-center gap-2">
              <span className={cn("text-neutral-700", isMobile && "text-lg font-normal")}>
                Category:
              </span>
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className={isMobile ? "z-[10000]" : "z-[70]"}>
            <SelectItem value="all">—</SelectItem>
            {availableCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          "z-50 hidden md:block"
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
              onClick={handleResetFilters}
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
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            <div className="relative h-full w-full bg-white/80 backdrop-blur-xl flex flex-col">
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
                {filterContent(true)}
              </ScrollArea>

              <div className="p-6 border-t border-black/10">
                <button
                  onClick={handleResetFilters}
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
