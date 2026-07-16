"use client";

import React from "react";
import { Button } from '@walls/ui/button';
import { Input } from '@walls/ui/input';
import { Filter, RefreshCw, Download } from "lucide-react";
import { LedgerFilters as Filters } from "../types";

interface LedgerTableToolbarProps {
  filters: Filters;
  onFilterChange: (filterKey: keyof Filters, value: string) => void;
  onFilterToggle: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

export function LedgerTableToolbar({
  filters,
  onFilterChange,
  onFilterToggle,
  onRefresh,
  onExport,
}: LedgerTableToolbarProps) {
  const hasActiveFilters = () => {
    return Object.values(filters).some((value) => value !== "");
  };

  return (
    <div className="flex-shrink-0 w-full mt-4 pl-8 pr-0">
      <div className="flex justify-between items-end mb-6 gap-4">
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <Button
            variant="ghost"
            className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
            onClick={onFilterToggle}
          >
            <div className="relative group">
              <div
                className={`
                relative z-10 p-3 
                bg-neutral-100 backdrop-blur-md 
                rounded-full shadow-inner border border-neutral-200/50
                transition-all duration-300 ease-in-out
                group-hover:bg-neutral-100
                group-hover:shadow-inner group-hover:border-neutral-200
                group-hover:scale-95
                group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]
                ${hasActiveFilters() ? "bg-neutral-700 shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]" : ""}
              `}
              >
                <Filter
                  className={`h-[18px] w-[18px] stroke-[1.5] ${hasActiveFilters() ? "text-kenoo-yellow" : ""}`}
                />
              </div>
            </div>
          </Button>

          {onRefresh && (
            <Button
              variant="ghost"
              className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
              onClick={onRefresh}
            >
              <div className="relative z-10 p-3 bg-neutral-100 backdrop-blur-md rounded-full shadow-inner border border-neutral-200/50 transition-all duration-300 ease-in-out group-hover:bg-neutral-100 group-hover:scale-95">
                <RefreshCw className="h-[18px] w-[18px] stroke-[1.5]" />
              </div>
            </Button>
          )}

          {onExport && (
            <Button
              variant="ghost"
              className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
              onClick={onExport}
            >
              <div className="relative z-10 p-3 bg-neutral-100 backdrop-blur-md rounded-full shadow-inner border border-neutral-200/50 transition-all duration-300 ease-in-out group-hover:bg-neutral-100 group-hover:scale-95">
                <Download className="h-[18px] w-[18px] stroke-[1.5]" />
              </div>
            </Button>
          )}

          <div className="relative flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Search payments, payouts, recipients..."
              value={filters.searchTerm}
              onChange={(e) => onFilterChange("searchTerm", e.target.value)}
              className="w-full rounded-full pl-14 h-12 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-neutral-200/50"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <div className="absolute left-11 top-1/2 transform -translate-y-1/2 h-4 w-px bg-neutral-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
