"use client";

import React, { useRef, useEffect, useState } from 'react';
import { CardCRM as Card, CardContentCRM as CardContent } from "@/components/agentCRM/agentPeople/custom-ui/card-crm";
import { ColumnWidths } from "../types";

interface PitchesTableHeaderProps {
  headerScrollRef: React.RefObject<HTMLDivElement>;
  columnWidths: ColumnWidths;
  setColumnWidths: React.Dispatch<React.SetStateAction<ColumnWidths>>;
}

export const PitchesTableHeader = ({
  headerScrollRef,
  columnWidths,
  setColumnWidths,
}: PitchesTableHeaderProps) => {
  const [isResizing, setIsResizing] = useState<keyof ColumnWidths | null>(null);
  const resizingRef = useRef<{
    column: keyof ColumnWidths;
    startX: number;
    startWidth: number;
  } | null>(null);

  const startResize = (e: React.MouseEvent, column: keyof ColumnWidths) => {
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
    const minWidth = column === 'company' ? 200 : 80;
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
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  const ResizeHandle = ({ column }: { column: keyof ColumnWidths }) => {
    const isCurrentlyResizing = isResizing === column;
    const isNameColumn = column === 'company';
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
    <Card className="w-full rounded-none rounded-tl-lg bg-kenoo-white border-b border-r border-l-0 border-t-0 border-neutral-300 sticky top-0 z-40 overflow-hidden">
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.company}px` }}
      ></div>
      <CardContent className="py-2 relative bg-kenoo-white">
        <div className="flex items-stretch">
          {/* Sticky Left Section - Company Header */}
          <div
            className="flex items-center gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 self-stretch overflow-visible bg-kenoo-white"
            style={{ width: `${columnWidths.company}px` }}
          >
            <div className="flex items-center gap-4 flex-1 -my-2 py-2 pl-6 bg-kenoo-white relative max-w-full">
              <div className="w-[40px]"></div>
              <div className="min-w-0">
                <h3 className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                  Company
                </h3>
              </div>
              <ResizeHandle column="company" />
            </div>
          </div>

          {/* Scrollable Header Section */}
          <div
            ref={headerScrollRef}
            className="flex-1 overflow-x-hidden pr-0"
          >
            <div className="flex items-center min-w-max pl-0" style={{ gap: '0.5rem' }}>
              <div className="flex items-center flex-shrink-0 pl-6 relative" style={{ width: `${columnWidths.pitchedTo}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Pitched To</span>
                <ResizeHandle column="pitchedTo" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.sentBy}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Sent By</span>
                <ResizeHandle column="sentBy" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.channel}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Channel</span>
                <ResizeHandle column="channel" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.creators}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Creators</span>
                <ResizeHandle column="creators" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.date}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Date Pitched</span>
                <ResizeHandle column="date" />
              </div>
              <div className="flex items-center flex-shrink-0 relative" style={{ width: `${columnWidths.created}px` }}>
                <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 truncate">Created</span>
                <ResizeHandle column="created" />
              </div>
              <div style={{ width: '24px' }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
