"use client";

import React, { useState } from "react";
import { Button } from '@walls/ui/button';
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from '@walls/ui/input';
import { cn } from '@walls/utils';

interface LedgerPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function LedgerPagination({
  currentPage,
  totalPages,
  onPageChange,
}: LedgerPaginationProps) {
  const [customPageStart, setCustomPageStart] = useState("");
  const [customPageEnd, setCustomPageEnd] = useState("");
  const [showStartInput, setShowStartInput] = useState(false);
  const [showEndInput, setShowEndInput] = useState(false);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const handleCustomPageSubmit = (value: string, position: "start" | "end") => {
    const pageNum = parseInt(value.replace(/,/g, ""), 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    }
    if (position === "start") {
      setCustomPageStart("");
      setShowStartInput(false);
    } else {
      setCustomPageEnd("");
      setShowEndInput(false);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "start-ellipsis" | "end-ellipsis")[] = [];
    const maxPagesToShow = 7;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const startGap = currentPage - 2 - 1;
      if (startGap > 1) pages.push("start-ellipsis");
      else if (startGap === 1) pages.push(2);

      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      for (let i = startPage; i <= endPage; i++) pages.push(i);

      const endGap = totalPages - (currentPage + 2);
      if (endGap > 1) pages.push("end-ellipsis");
      else if (endGap === 1) pages.push(totalPages - 1);
      pages.push(totalPages);
    }
    return pages;
  };

  const pageButtonClass =
    "min-w-[3.25rem] h-12 px-4 rounded-full text-base font-medium transition-all duration-200 border border-neutral-200/60 bg-transparent hover:bg-neutral-100 text-neutral-700";
  const arrowClass = "h-12 w-12 rounded-full p-0 " + pageButtonClass + " disabled:opacity-40";

  return (
    <div className="flex justify-center items-center gap-3 pt-2">
      <Button
        variant="ghost"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={arrowClass}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2} />
      </Button>

      {getPageNumbers().map((page, index) =>
        page === "start-ellipsis" ? (
          <div key="ellipsis-start" className="flex items-center">
            {showStartInput ? (
              <Input
                value={customPageStart}
                onChange={(e) =>
                  setCustomPageStart(e.target.value.replace(/[^\d,]/g, ""))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    handleCustomPageSubmit(customPageStart, "start");
                  if (e.key === "Escape") {
                    setShowStartInput(false);
                    setCustomPageStart("");
                  }
                }}
                onBlur={() => handleCustomPageSubmit(customPageStart, "start")}
                className="w-24 h-12 text-center text-base rounded-full border border-neutral-200/60 bg-transparent"
                placeholder="Go to"
                autoFocus
              />
            ) : (
              <Button
                variant="ghost"
                className={cn(pageButtonClass, "min-w-[3.25rem] h-12")}
                onClick={() => setShowStartInput(true)}
                title="Go to page"
              >
                <Search className="h-5 w-5 text-neutral-400" />
              </Button>
            )}
          </div>
        ) : page === "end-ellipsis" ? (
          <div key="ellipsis-end" className="flex items-center">
            {showEndInput ? (
              <Input
                value={customPageEnd}
                onChange={(e) =>
                  setCustomPageEnd(e.target.value.replace(/[^\d,]/g, ""))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    handleCustomPageSubmit(customPageEnd, "end");
                  if (e.key === "Escape") {
                    setShowEndInput(false);
                    setCustomPageEnd("");
                  }
                }}
                onBlur={() => handleCustomPageSubmit(customPageEnd, "end")}
                className="w-24 h-12 text-center text-base rounded-full border border-neutral-200/60 bg-transparent"
                placeholder="Go to"
                autoFocus
              />
            ) : (
              <Button
                variant="ghost"
                className={cn(pageButtonClass, "min-w-[3.25rem] h-12")}
                onClick={() => setShowEndInput(true)}
                title="Go to page"
              >
                <Search className="h-5 w-5 text-neutral-400" />
              </Button>
            )}
          </div>
        ) : (
          <Button
            key={`page-${page}`}
            variant="ghost"
            onClick={() => onPageChange(page)}
            className={cn(
              pageButtonClass,
              currentPage === page &&
                "bg-kenoo-yellow text-neutral-900 hover:bg-kenoo-yellow/90 border-kenoo-yellow"
            )}
          >
            {formatNumber(page)}
          </Button>
        )
      )}

      <Button
        variant="ghost"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={arrowClass}
        aria-label="Next page"
      >
        <ChevronRight className="h-6 w-6" strokeWidth={2} />
      </Button>
    </div>
  );
}
