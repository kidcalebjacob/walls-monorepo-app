"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PartnerHubPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PartnerHubPagination({ currentPage, totalPages, onPageChange, className = "" }: PartnerHubPaginationProps) {
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
    const maxPagesToShow = 7;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      const startGap = (currentPage - 2) - 1;

      if (startGap > 1) {
        pages.push('start-ellipsis');
      } else if (startGap === 1) {
        pages.push(2);
      }

      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      const endGap = totalPages - (currentPage + 2);

      if (endGap > 1) {
        pages.push('end-ellipsis');
      } else if (endGap === 1) {
        pages.push(totalPages - 1);
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const buttonBaseClass = "w-9 h-9 p-0 rounded-full bg-neutral-100 backdrop-blur-sm hover:bg-neutral-200/50 shadow-inner border border-neutral-200/50 transition-all duration-300 text-neutral-700 font-light text-xs";
  const arrowButtonClass = `${buttonBaseClass} disabled:opacity-50`;

  return (
    <div className={`sticky bottom-0 left-0 right-0 z-50 bg-neutral-100/95 backdrop-blur-md border-t border-neutral-200/50 shadow-lg py-1 px-8 ${className}`}>
      <div className="flex justify-center items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={arrowButtonClass}
        >
          <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
        </Button>

        {getPageNumbers().map((page) => (
          page === 'start-ellipsis' ? (
            <div key={`ellipsis-start`} className="relative flex items-center">
              {showStartInput ? (
                <Input
                  value={customPageStart}
                  onChange={(e) => {
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
                  className="w-20 h-8 text-center rounded-full bg-neutral-100 backdrop-blur-sm shadow-inner border border-neutral-200/50 font-light text-xs"
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
                  <Search className="h-4 w-4 text-gray-100" />
                </Button>
              )}
            </div>
          ) : page === 'end-ellipsis' ? (
            <div key={`ellipsis-end`} className="relative flex items-center">
              {showEndInput ? (
                <Input
                  value={customPageEnd}
                  onChange={(e) => {
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
                  className="w-20 h-8 text-center rounded-full bg-neutral-100 backdrop-blur-sm shadow-inner border border-neutral-200/50 font-light text-xs"
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
                  <Search className="h-4 w-4 text-gray-500/40" />
                </Button>
              )}
            </div>
          ) : (
            <Button
              key={`page-${page}`}
              variant={currentPage === page ? "default" : "outline"}
              onClick={() => onPageChange(page as number)}
              className={`${buttonBaseClass} ${
                currentPage === page ? "!bg-walls-yellow/50 text-neutral-700 hover:!bg-walls-yellow/40" : ""
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
          <ChevronRight className="h-4 w-4 stroke-[1.5]" />
        </Button>
      </div>
    </div>
  );
}
