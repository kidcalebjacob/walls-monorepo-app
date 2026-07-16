"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Filter, Clock, ArrowUp, ArrowDown } from "lucide-react";

interface PitchesSorterProps {
  isFilterOpen: boolean;
  setIsFilterOpen: (isOpen: boolean) => void;
  hasActiveFilters: () => boolean;
  toggleSortDirection: () => void;
  sortDirection: 'asc' | 'desc';
  paginationInfo: string;
  loading: boolean;
}

export function PitchesSorter({
  isFilterOpen,
  setIsFilterOpen,
  hasActiveFilters,
  toggleSortDirection,
  sortDirection,
  paginationInfo,
  loading
}: PitchesSorterProps) {
  return (
    <div className="flex justify-between items-end mb-6">
      <div className="flex items-center gap-14">
        <Button 
          className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
        >
          <div className="relative group">
            <div className={`
              relative z-10 p-3 
              bg-neutral-100 backdrop-blur-md 
              rounded-lg shadow-inner border border-neutral-200/50
              transition-all duration-300 ease-in-out
              group-hover:bg-neutral-100
              group-hover:shadow-inner group-hover:border-neutral-200
              group-hover:scale-95
              group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]
              ${hasActiveFilters() ? 'bg-neutral-700 shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]' : ''}
            `}>
              <Filter className={`h-[18px] w-[18px] stroke-[1.5] ${hasActiveFilters() ? 'text-kenoo-yellow' : ''}`} />
            </div>
          </div>
        </Button>
        
        <div className="flex items-center gap-6">
          {/* Sort label */}
          <span className="text-xs text-muted-foreground font-medium">Sort by:</span>
          
          {/* Sort by recency indicator */}
          <div 
            className="flex items-center gap-1 cursor-pointer transition-colors text-foreground"
            onClick={toggleSortDirection}
            title={sortDirection === 'desc' ? "Newest first (click to reverse)" : "Oldest first (click to reverse)"}
          >
            <Clock className="w-4 h-4" />
            {sortDirection === 'desc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )}
          </div>
        </div>
      </div>
      
      <span className="text-xs text-muted-foreground">
        {loading ? "Loading..." : paginationInfo}
      </span>
    </div>
  );
} 