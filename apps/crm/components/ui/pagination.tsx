import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
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

  const buttonBaseClass = "min-w-[2.5rem] h-10 px-3 rounded-full bg-neutral-100 backdrop-blur-sm hover:bg-neutral-200/50 shadow-inner border border-neutral-200/50 transition-all duration-300 text-neutral-700";
  const arrowButtonClass = `${buttonBaseClass} w-10 p-0 disabled:opacity-50`;

  return (
    <div className="flex justify-center items-center gap-2">
      <Button 
        variant="ghost" 
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={arrowButtonClass}
      >
        <ChevronLeft className="h-5 w-5" />
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
                className="w-20 h-10 text-center rounded-full bg-neutral-100 backdrop-blur-sm shadow-inner border border-neutral-200/50"
                placeholder="Go to"
                autoFocus
              />
            ) : (
              <Button 
                variant="outline" 
                className={arrowButtonClass}
                onClick={() => setShowStartInput(true)}
                title="Go to specific page"
              >
                <Search className="h-5 w-5 text-gray-100" />
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
                className="w-20 h-10 text-center rounded-full bg-neutral-100 backdrop-blur-sm shadow-inner border border-neutral-200/50"
                placeholder="Go to"
                autoFocus
              />
            ) : (
              <Button 
                variant="outline" 
                className={arrowButtonClass}
                onClick={() => setShowEndInput(true)}
                title="Go to specific page"
              >
                <Search className="h-5 w-5 text-gray-500/40" />
              </Button>
            )}
          </div>
        ) : (
          <Button
            key={`page-${page}`}
            variant={currentPage === page ? "default" : "outline"}
            onClick={() => onPageChange(page as number)}
            className={`${buttonBaseClass} ${
              currentPage === page ? "!bg-kenoo-yellow/70 text-neutral-700 hover:!bg-kenoo-yellow/60" : ""
            }`}
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
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}