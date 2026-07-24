"use client";

import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from "lucide-react";
import { CardPartnerHub as Card, CardContentPartnerHub as CardContent } from "@/components/ui/card-partnerhub";
import {
  PartnershipSortDirection,
  PartnershipSortField,
} from "../types";

type ColumnWidths = {
  name: number;
  talentHq: number;
  talentCategory: number;
  company: number;
  platform: number;
  postedAt: number;
  createdAt: number;
  hashtags: number;
  partnershipUrl: number;
};

interface PartnershipsTableHeaderProps {
  headerScrollRef: React.RefObject<HTMLDivElement>;
  columnWidths: ColumnWidths;
  setColumnWidths: React.Dispatch<React.SetStateAction<ColumnWidths>>;
  sortBy: PartnershipSortField;
  sortDirection: PartnershipSortDirection;
  onSortChange: (field: PartnershipSortField) => void;
}

const SortIndicator = ({
  active,
  direction,
}: {
  active: boolean;
  direction: PartnershipSortDirection;
}) => {
  if (!active) return null;
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;
  return <Icon className="h-3 w-3 flex-shrink-0 text-neutral-600" aria-hidden />;
};

export const PartnershipsTableHeader = ({
  headerScrollRef,
  columnWidths,
  setColumnWidths,
  sortBy,
  sortDirection,
  onSortChange,
}: PartnershipsTableHeaderProps) => {
  const [isResizing, setIsResizing] = useState<keyof ColumnWidths | null>(null);
  const resizingRef = useRef<{
    column: keyof ColumnWidths;
    startX: number;
    startWidth: number;
  } | null>(null);

  const startResize = (
    e: React.MouseEvent,
    column: keyof ColumnWidths
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(column);
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;

    const { column, startX, startWidth } = resizingRef.current;
    const delta = e.clientX - startX;
    
    // Set minimum width based on column type
    const minWidth = column === 'name' ? 200 : 80;

    setColumnWidths((prev) => ({
      ...prev,
      [column]: Math.max(minWidth, startWidth + delta),
    }));
  };

  const stopResize = () => {
    setIsResizing(null);
    resizingRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stopResize);
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  const ResizeHandle = ({ column }: { column: keyof ColumnWidths }) => {
    const isCurrentlyResizing = isResizing === column;
    const isNameColumn = column === 'name';
    return (
      <div
        className="absolute top-0 h-full w-3 cursor-col-resize group z-20"
        style={{ right: '0px' }}
        onMouseDown={(e) => startResize(e, column)}
      >
        {!isNameColumn && (
          <div
            className={`absolute top-0 bottom-0 w-px transition-colors ${
              isCurrentlyResizing ? 'bg-neutral-400' : 'bg-neutral-300'
            }`}
            style={{ right: '0px' }}
          />
        )}
      </div>
    );
  };

  return (
    <Card className="w-full rounded-none rounded-tl-lg bg-gray-50 border-b border-r border-l-0 border-t-0 border-neutral-300 sticky top-0 z-40 overflow-hidden">
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.name}px` }}
      ></div>
      <CardContent className="py-2 relative bg-gray-50">
        <div className="flex items-stretch">
          {/* Sticky Left Section - Talent Name Header */}
          <div
            className="flex items-center gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 self-stretch overflow-visible bg-gray-50"
            style={{ width: `${columnWidths.name}px` }}
          >
            <div className="flex items-center gap-4 flex-1 -my-2 py-2 pl-6 bg-gray-50 relative max-w-full">
              <div className="w-[40px]"></div>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSortChange("talentName")}
                  className={`flex items-center gap-1 text-left text-[11px] font-normal uppercase tracking-[0.16em] transition-colors hover:text-neutral-700 ${
                    sortBy === "talentName" ? "text-neutral-700" : "text-neutral-500"
                  }`}
                >
                  <span>Talent</span>
                  <SortIndicator active={sortBy === "talentName"} direction={sortDirection} />
                </button>
              </div>
              <ResizeHandle column="name" />
            </div>
          </div>

          {/* Scrollable Header Section */}
          <div 
            ref={headerScrollRef}
            className="flex-1 overflow-x-hidden pr-0"
          >
            <div className="flex items-center min-w-max pl-0" style={{ gap: '0.5rem' }}>
              <div className="flex items-center flex-shrink-0 pl-6 relative" style={{ width: `${columnWidths.company}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate pl-3">Company</span>
                <ResizeHandle column="company" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.platform}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Platforms</span>
                <ResizeHandle column="platform" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.talentHq}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Talent HQ</span>
                <ResizeHandle column="talentHq" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.partnershipUrl}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Partnership URL</span>
                <ResizeHandle column="partnershipUrl" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.talentCategory}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Category</span>
                <ResizeHandle column="talentCategory" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.hashtags}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Hashtags</span>
                <ResizeHandle column="hashtags" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.createdAt}px` }}>
                <button
                  type="button"
                  onClick={() => onSortChange("createdAt")}
                  className={`flex items-center gap-1 truncate text-left text-[11px] font-normal uppercase tracking-[0.16em] transition-colors hover:text-neutral-700 ${
                    sortBy === "createdAt" ? "text-neutral-700" : "text-neutral-500"
                  }`}
                >
                  <span className="truncate">Created At</span>
                  <SortIndicator active={sortBy === "createdAt"} direction={sortDirection} />
                </button>
                <ResizeHandle column="createdAt" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.postedAt}px` }}>
                <button
                  type="button"
                  onClick={() => onSortChange("lastPost")}
                  className={`flex items-center gap-1 truncate text-left text-[11px] font-normal uppercase tracking-[0.16em] transition-colors hover:text-neutral-700 ${
                    sortBy === "lastPost" ? "text-neutral-700" : "text-neutral-500"
                  }`}
                >
                  <span className="truncate">Last Post</span>
                  <SortIndicator active={sortBy === "lastPost"} direction={sortDirection} />
                </button>
                <ResizeHandle column="postedAt" />
              </div>
              {/* Spacer for proper scroll boundary */}
              <div style={{ width: '24px' }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

