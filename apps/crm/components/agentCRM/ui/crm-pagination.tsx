"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CRMPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  buttonVariant?: "default" | "scouter";
}

const scouterPaginationButtonClass =
  "flex items-center justify-center h-9 min-w-9 px-2 p-0 rounded-full bg-gray-50 shadow-none transition-all duration-300 ease-in-out hover:bg-gray-50 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)] hover:scale-[0.98] text-neutral-700 font-light text-xs";

const scouterPaginationActiveClass =
  "!bg-neutral-100/40 text-neutral-700 font-light shadow-[inset_0_3px_7px_rgba(0,0,0,0.11)] scale-[0.98] hover:!bg-neutral-100/40 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)]";

export function CRMPagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
  buttonVariant = "default",
}: CRMPaginationProps) {
  const [customPageStart, setCustomPageStart] = useState<string>('');
  const [customPageEnd, setCustomPageEnd] = useState<string>('');
  const [showStartInput, setShowStartInput] = useState<boolean>(false);
  const [showEndInput, setShowEndInput] = useState<boolean>(false);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleCustomPageSubmit = (value: string, position: 'start' | 'end') => {
    const pageNum = parseInt(value.replace(/,/g, ''), 10);
    if (!isNaN(pageNum) && pageNum > 1 && pageNum < totalPages) {
      onPageChange(pageNum);
    }
    
    if (position === 'start') {
      setCustomPageStart('');
      setShowStartInput(false);
    } else {
      setCustomPageEnd('');
      setShowEndInput(false);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxPagesToShow) {
      // If we have a small number of pages, show all of them
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate the gap between page 1 and the pages around current page
      const startGap = (currentPage - 2) - 1;
      
      // Only show search/jump button if gap is more than 1 page
      if (startGap > 1) {
        pages.push('start-ellipsis');
      } else if (startGap === 1) {
        // If gap is just 1 page, show that page number instead
        pages.push(2);
      }
      
      // Show pages around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Calculate the gap between the pages around current page and the last page
      const endGap = totalPages - (currentPage + 2);
      
      // Only show search/jump button if gap is more than 1 page
      if (endGap > 1) {
        pages.push('end-ellipsis');
      } else if (endGap === 1) {
        // If gap is just 1 page, show that page number instead
        pages.push(totalPages - 1);
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  const buttonBaseClass =
    buttonVariant === "scouter"
      ? scouterPaginationButtonClass
      : "w-9 h-9 p-0 rounded-full bg-neutral-100 backdrop-blur-sm hover:bg-neutral-200/50 shadow-inner border border-neutral-200/50 transition-all duration-300 text-neutral-700 font-light text-xs";
  const arrowButtonClass = cn(
    buttonBaseClass,
    buttonVariant === "scouter"
      ? "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
      : "disabled:opacity-50"
  );
  const jumpInputClass =
    buttonVariant === "scouter"
      ? "w-20 h-9 text-center rounded-full bg-gray-50 shadow-none border-0 font-light text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
      : "w-20 h-8 text-center rounded-full bg-neutral-100 backdrop-blur-sm shadow-inner border border-neutral-200/50 font-light text-xs";
  const searchIconClass = buttonVariant === "scouter" ? "h-4 w-4 text-neutral-300" : undefined;

  return (
    <div className={cn("sticky bottom-0 left-0 right-0 z-50 bg-neutral-100/95 backdrop-blur-md border-t border-neutral-200/50 shadow-lg py-1 px-8", className)}>
      <div className="flex justify-center items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={arrowButtonClass}
        >
          <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
        </Button>
        
        {getPageNumbers().map((page, index) => (
          page === 'start-ellipsis' ? (
            <div key={`ellipsis-start`} className="relative flex items-center">
              {showStartInput ? (
                <Input
                  value={customPageStart}
                  onChange={(e) => {
                    // Allow only numbers and commas
                    const value = e.target.value.replace(/[^\d,]/g, '');
                    setCustomPageStart(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomPageSubmit(customPageStart, 'start');
                    } else if (e.key === 'Escape') {
                      setShowStartInput(false);
                      setCustomPageStart('');
                    }
                  }}
                  onBlur={() => handleCustomPageSubmit(customPageStart, 'start')}
                  className={jumpInputClass}
                  placeholder="Go to"
                  autoFocus
                />
              ) : (
                <Button
                  variant={buttonVariant === "scouter" ? "ghost" : "outline"}
                  className={arrowButtonClass}
                  onClick={() => setShowStartInput(true)}
                  title="Go to specific page"
                >
                  <Search className={searchIconClass ?? "h-4 w-4 text-gray-100"} />
                </Button>
              )}
            </div>
          ) : page === 'end-ellipsis' ? (
            <div key={`ellipsis-end`} className="relative flex items-center">
              {showEndInput ? (
                <Input
                  value={customPageEnd}
                  onChange={(e) => {
                    // Allow only numbers and commas
                    const value = e.target.value.replace(/[^\d,]/g, '');
                    setCustomPageEnd(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomPageSubmit(customPageEnd, 'end');
                    } else if (e.key === 'Escape') {
                      setShowEndInput(false);
                      setCustomPageEnd('');
                    }
                  }}
                  onBlur={() => handleCustomPageSubmit(customPageEnd, 'end')}
                  className={jumpInputClass}
                  placeholder="Go to"
                  autoFocus
                />
              ) : (
                <Button
                  variant={buttonVariant === "scouter" ? "ghost" : "outline"}
                  className={arrowButtonClass}
                  onClick={() => setShowEndInput(true)}
                  title="Go to specific page"
                >
                  <Search className={searchIconClass ?? "h-4 w-4 text-gray-500/40"} />
                </Button>
              )}
            </div>
          ) : (
            <Button
              key={`page-${page}`}
              variant={buttonVariant === "scouter" ? "ghost" : currentPage === page ? "default" : "outline"}
              onClick={() => onPageChange(page as number)}
              className={cn(
                buttonBaseClass,
                currentPage === page &&
                  (buttonVariant === "scouter"
                    ? scouterPaginationActiveClass
                    : "!bg-kenoo-yellow/50 text-neutral-700 hover:!bg-kenoo-yellow/40")
              )}
            >
              {formatNumber(page as number)}
            </Button>
          )
        ))}
        
        <Button
          variant="ghost"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={arrowButtonClass}
        >
          <ChevronRight className="h-4 w-4 stroke-[1.5]" />
        </Button>
      </div>
    </div>
  );
}
