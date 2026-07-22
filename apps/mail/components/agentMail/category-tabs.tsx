"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { Thread } from '@/types/email.types';
import { RefreshCw, Inbox, BadgeCheck, Tag, BellDot, Loader2, ChevronLeft, ChevronRight, MoreVertical, MailOpen, MailPlus } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { wallsToast } from "@/components/ui/walls-toast";

interface CategoryPreference {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

interface CategoryTabsProps {
  currentMailbox: 'inbox' | 'starred' | 'sent' | 'archive' | 'trash' | 'schedule' | 'deals';
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  emails: Thread[];
  preferences: CategoryPreference[];
  className?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  hasMoreEmails?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  page?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  selectAllChecked?: boolean;
  onSelectAllChange?: (checked: boolean) => void;
  userEmail?: string;
  onUnreadCountChange?: (count: number) => void;
}

interface CategoryTabProps {
  category: CategoryPreference;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}

const CategoryTab = ({
  category,
  isActive,
  unreadCount,
  onClick
}: CategoryTabProps) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleClick = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    onClick();
    // Reset transition state after a short delay
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const getCategoryIcon = (categoryId: string) => {
    const iconClass = cn(
      "w-4 h-4 mr-2 transition-colors duration-200",
      isActive ? "text-neutral-800" : "text-muted-foreground"
    );

    switch (categoryId) {
      case 'primary':
        return <Inbox className={iconClass} />;
      case 'social':
        return <BadgeCheck className={iconClass} />;
      case 'promotions':
        return <Tag className={iconClass} />;
      case 'updates':
        return <BellDot className={iconClass} />;
      default:
        return null;
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isTransitioning}
      className={cn(
        "px-6 py-2 text-sm relative flex items-center group hover:bg-transparent",
        isActive ? "text-neutral-800 font-medium" : "text-muted-foreground font-light",
        "transition-all duration-200",
        isTransitioning && "opacity-50 cursor-not-allowed"
      )}
    >
      {getCategoryIcon(category.id)}
      {category.name}
      {unreadCount > 0 && (
        <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-kenoo-yellow text-black font-medium transition-colors duration-200">
          {unreadCount}
        </span>
      )}
      <div className={cn(
        "absolute left-0 h-[2px] bg-kenoo-yellow transition-all duration-300 -bottom-[1.5px] rounded-full",
        isActive ? "w-4/5 mx-auto right-0" : "w-0 group-hover:w-4/5 group-hover:mx-auto group-hover:right-0 group-hover:opacity-50"
      )} />
    </button>
  );
};

export default function CategoryTabs({
  currentMailbox,
  activeCategory,
  onCategoryChange,
  emails,
  preferences,
  className,
  onRefresh,
  isRefreshing,
  hasMoreEmails = false,
  onLoadMore,
  isLoadingMore = false,
  page = 1,
  onPrevPage,
  onNextPage,
  selectAllChecked = false,
  onSelectAllChange,
  userEmail,
  onUnreadCountChange
}: CategoryTabsProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSelectAllChange = (checked: boolean) => {
    onSelectAllChange?.(checked);
  };

  const handleSyncEmails = async () => {
    if (!userEmail) {
      wallsToast.error("User email not found");
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/gmail/sync-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync emails');
      }

      wallsToast.success(data.message || `Successfully synced ${data.newEmailsCount} emails`);
      
      // Refresh the email list after syncing
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      wallsToast.error(error instanceof Error ? error.message : 'Failed to sync emails');
    } finally {
      setIsSyncing(false);
    }
  };

  const getUnreadCount = (categoryId: string) => {
    return emails.filter(email => {
      if (!email.unread) return false;

      if (categoryId === 'primary') {
        return !email.labelIds?.some(label =>
          ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES'].includes(label)
        );
      }
      return email.labelIds?.includes(`CATEGORY_${categoryId.toUpperCase()}`);
    }).length;
  };

  const primaryUnread = useMemo(() => {
    if (currentMailbox !== 'inbox') return 0;
    return emails.filter(email => {
      if (!email.unread) return false;
      return !email.labelIds?.some(label =>
        ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES'].includes(label)
      );
    }).length;
  }, [currentMailbox, emails]);

  useEffect(() => {
    if (currentMailbox === 'inbox' && onUnreadCountChange) {
      onUnreadCountChange(primaryUnread);
    }
  }, [currentMailbox, primaryUnread, onUnreadCountChange]);

  return (
    <div className={cn("flex flex-col bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/60 rounded-t-3xl pt-2", className)}>
      {/* Top row with checkbox, refresh, more options, and pagination */}
      <div className="flex items-center justify-between h-[40px] px-6">
        <div className="flex items-center gap-3">
          <Checkbox 
            checked={selectAllChecked}
            onCheckedChange={(checked) => onSelectAllChange?.(checked as boolean)}
            className={cn(
              "border-0 rounded-sm",
              "bg-neutral-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]",
              "data-[state=checked]:bg-kenoo-yellow data-[state=checked]:text-neutral-700 data-[state=checked]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]",
              "focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
          />
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className={cn(
                "h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 rounded-full",
                isRefreshing && "opacity-50 cursor-not-allowed"
              )}
              disabled={isRefreshing}
            >
              <RefreshCw 
                className={cn(
                  "w-4 h-4",
                  isRefreshing && "[animation:spin_2s_linear_infinite]"
                )} 
              />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 rounded-full"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>
                <MailOpen className="mr-2 h-4 w-4 text-blue-500" />
                <span className="font-light text-gray-600">Mark all as read</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleSyncEmails}
                disabled={isSyncing}
                className={cn(isSyncing && "opacity-50 cursor-not-allowed")}
              >
                <div className="flex items-center">
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 text-blue-500 animate-spin" />
                  ) : (
                    <MailPlus className="mr-2 h-4 w-4 text-blue-500" />
                  )}
                  <span className="font-light text-gray-600">
                    {isSyncing ? "Syncing emails..." : "Sync emails"}
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center">
          <div className="text-xs text-muted-foreground flex items-center">
            {emails.length > 0 && (
              <div className="flex items-center ml-2">
                <button 
                  onClick={onPrevPage}
                  disabled={page <= 1 || !onPrevPage || isLoadingMore}
                  className={cn(
                    "p-1 rounded-sm transition-colors",
                    page <= 1 || !onPrevPage || isLoadingMore 
                      ? "text-gray-300 cursor-not-allowed" 
                      : "text-muted-foreground hover:text-walls-blue hover:bg-gray-100"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <button 
                  onClick={onNextPage || onLoadMore}
                  disabled={!hasMoreEmails || isLoadingMore || (!onNextPage && !onLoadMore)}
                  className={cn(
                    "p-1 rounded-sm transition-colors",
                    !hasMoreEmails || isLoadingMore || (!onNextPage && !onLoadMore)
                      ? "text-gray-300 cursor-not-allowed" 
                      : "text-muted-foreground hover:text-walls-blue hover:bg-gray-100"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {isLoadingMore && (
              <Loader2 className="ml-2 h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Category tabs row - only show for inbox */}
      {currentMailbox === 'inbox' && (
        <div className="flex h-[45px] items-end pb-0">
          {preferences
            .filter(category => category.enabled || category.id === 'primary')
            .sort((a, b) => a.order - b.order)
            .map((category) => (
              <CategoryTab
                key={category.id}
                category={category}
                isActive={activeCategory === category.id}
                unreadCount={getUnreadCount(category.id)}
                onClick={() => onCategoryChange(category.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}