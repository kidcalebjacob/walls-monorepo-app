"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { ListFilter, Plus, Search, Rows3, Kanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { Filters } from "../types";

export type DealsView = "table" | "kanban";

const VIEW_TOGGLE_TRACK =
  "flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-neutral-200/70 bg-neutral-50/50 p-0.5";

const VIEW_TOGGLE_INNER =
  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent transition-all duration-300 ease-in-out";

const VIEW_TOGGLE_ACTIVE =
  "border-neutral-200 bg-neutral-50 text-neutral-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

const VIEW_TOGGLE_INACTIVE =
  "text-neutral-400 group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-neutral-50 group-hover:text-neutral-700 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

interface DealsTableToolbarProps {
  filters: Filters;
  onFilterChange: (filterKey: string, value: string) => void;
  onFilterToggle: () => void;
  onCreateClick: () => void;
  view: DealsView;
  onViewChange: (view: DealsView) => void;
}

export const DealsTableToolbar = ({
  filters,
  onFilterChange,
  onFilterToggle,
  onCreateClick,
  view,
  onViewChange,
}: DealsTableToolbarProps) => {
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
              placeholder="Search deals by name or company…"
              value={filters.searchTerm}
              onChange={(e) => onFilterChange('searchTerm', e.target.value)}
              className={cn(
                "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                filters.searchTerm ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                "focus:border-b-[var(--kenoo-sky)]"
              )}
            />
          </div>

          {/* Table / Kanban view toggle */}
          <div className={VIEW_TOGGLE_TRACK} role="group" aria-label="Deals view">
            <button
              type="button"
              onClick={() => onViewChange("table")}
              title="Table view"
              aria-label="Table view"
              aria-pressed={view === "table"}
              className="group flex cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div
                className={cn(
                  VIEW_TOGGLE_INNER,
                  view === "table" ? VIEW_TOGGLE_ACTIVE : VIEW_TOGGLE_INACTIVE
                )}
              >
                <Rows3 className="h-4 w-4 stroke-[1.5]" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => onViewChange("kanban")}
              title="Kanban view"
              aria-label="Kanban view"
              aria-pressed={view === "kanban"}
              className="group flex cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div
                className={cn(
                  VIEW_TOGGLE_INNER,
                  view === "kanban" ? VIEW_TOGGLE_ACTIVE : VIEW_TOGGLE_INACTIVE
                )}
              >
                <Kanban className="h-4 w-4 stroke-[1.5]" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

