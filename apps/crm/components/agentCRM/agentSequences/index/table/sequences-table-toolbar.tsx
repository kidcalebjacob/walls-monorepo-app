"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { ListFilter, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Filters } from "../types";

interface SequencesTableToolbarProps {
  filters: Filters;
  onFilterChange: (filterKey: string, value: string) => void;
  onFilterToggle: () => void;
  onCreateClick: () => void;
}

export const SequencesTableToolbar = ({
  filters,
  onFilterChange,
  onFilterToggle,
  onCreateClick,
}: SequencesTableToolbarProps) => {
  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== "");
  };

  return (
    <div className="flex-shrink-0 w-full mt-4 pl-8 pr-0">
      <div className="flex justify-between items-end mb-6 gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Filter Button */}
          <Button
            variant="ghost"
            className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
            onClick={onFilterToggle}
          >
            <div className="relative">
              <div
                className={cn(
                  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
                  "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:scale-95",
                  hasActiveFilters()
                    ? [
                        "border-[rgba(110,173,192,0.45)] shadow-[0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]",
                        "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]",
                      ]
                    : "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]"
                )}
              >
                <ListFilter
                  className={cn(
                    "h-[18px] w-[18px] stroke-[1.5] transition-colors",
                    "text-neutral-500"
                  )}
                />
              </div>
            </div>
          </Button>

          {/* Create Button */}
          <Button
            variant="ghost"
            className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
            onClick={onCreateClick}
          >
            <div className="relative">
              <div
                className={cn(
                  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
                  "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
                )}
              >
                <Plus className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
              </div>
            </div>
          </Button>
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search sequences by name…"
              value={filters.searchTerm}
              onChange={(e) => onFilterChange('searchTerm', e.target.value)}
              className={cn(
                "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                filters.searchTerm ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                "focus:border-b-[var(--kenoo-sky)]"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

