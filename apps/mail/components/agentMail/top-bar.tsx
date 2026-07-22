"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import UserProfileButton from "@/components/user-profile-button";

interface TopBarProps {
  userEmail: string;
  delegates: Array<{ delegateEmail: string }>;
  currentAccount: string;
  onAccountChange: (account: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPage: number;
  hasNextPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export default function TopBar({
  userEmail,
  delegates,
  currentAccount,
  onAccountChange,
  searchQuery,
  onSearchChange,
  currentPage,
  hasNextPage,
  onNextPage,
  onPrevPage,
  onRefresh,
  isRefreshing = false,
  className,
}: TopBarProps) {
  const { user } = useAuth();
  const [initials, setInitials] = useState<string | undefined>();
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [isHoveringPagination, setIsHoveringPagination] = useState(false);

  // Fetch user data from public.users table (users.id = Supabase auth user id)
  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.id) {
        const logPrefix = "[users fetch] top-bar";
        try {
          const supabase = getSupabaseClient();
          console.log(logPrefix, "request", { table: "users", select: "first_name, last_name", id: user.id });
          const { data: userData, error } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

          if (error) {
            console.warn(logPrefix, "supabase error message:", error.message);
            console.warn(logPrefix, "supabase error code:", error.code, "details:", error.details, "hint:", error.hint);
          }

          if (!error && userData) {
            const firstName = userData.first_name || '';
            const lastName = userData.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || user?.email || '';
            setUserDisplayName(fullName);

            // Calculate initials from full name
            if (fullName) {
              const nameParts = fullName.split(" ");
              const length = nameParts.length;
              if (length > 0) {
                const firstInitial = nameParts[0].charAt(0).toUpperCase();
                const secondInitial = length > 1 ? nameParts[length - 1].charAt(0).toUpperCase() : firstInitial;
                setInitials(firstInitial.concat(secondInitial));
              }
            } else if (user?.email) {
              // Fallback to email if no name available
              const emailParts = user.email.split("@")[0].split(".");
              if (emailParts.length > 0) {
                const firstInitial = emailParts[0].charAt(0).toUpperCase();
                const secondInitial = emailParts.length > 1 ? emailParts[1].charAt(0).toUpperCase() : firstInitial;
                setInitials(firstInitial.concat(secondInitial));
              }
            }
          }
        } catch (error) {
          console.error("[users fetch] top-bar catch", {
            err: error,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    fetchUserData();
  }, [user]);

  return (
    <div className={cn(
      "h-[70px] pl-2 pr-4 flex items-center justify-between bg-neutral-50",
      className
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search mail"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
              searchQuery ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
              "focus:border-b-[var(--kenoo-sky)]"
            )}
          />
        </div>
      </div>

      {/* Right Section - Pagination + User Profile Area */}
      <div className="flex items-center gap-4">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              "h-9 w-9 flex items-center justify-center text-xs group",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            aria-label="Refresh emails"
          >
            <div className={cn(
              "relative z-10 p-2.5 rounded-full",
              "transition-all duration-300 ease-in-out",
              "text-neutral-500",
              "group-hover:bg-neutral-50 group-hover:border group-hover:border-neutral-200/50",
              "group-hover:scale-95 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
              "group-hover:text-neutral-800"
            )}>
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </div>
          </button>
        )}

        <motion.div
          className="flex items-center"
          onHoverStart={() => setIsHoveringPagination(true)}
          onHoverEnd={() => setIsHoveringPagination(false)}
          animate={{ columnGap: isHoveringPagination ? 12 : 8 }}
          style={{ columnGap: isHoveringPagination ? 12 : 8 }}
        >
          <button
            type="button"
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className={cn(
              "h-9 w-9 flex items-center justify-center text-xs group",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            aria-label="Previous page"
          >
            <div className={cn(
              "relative z-10 p-2.5 rounded-full",
              "transition-all duration-300 ease-in-out",
              "text-neutral-500",
              "group-hover:bg-neutral-50 group-hover:border group-hover:border-neutral-200/50",
              "group-hover:scale-95 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
              "group-hover:text-neutral-800"
            )}>
              <ChevronLeft className="h-4 w-4" />
            </div>
          </button>
          <motion.span
            initial={false}
            animate={isHoveringPagination ? { opacity: 1, width: "auto" } : { opacity: 0, width: 0 }}
            className="text-xs text-neutral-500 text-center overflow-hidden whitespace-nowrap"
          >
            Page {currentPage}
          </motion.span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNextPage}
            className={cn(
              "h-9 w-9 flex items-center justify-center text-xs group",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            aria-label="Next page"
          >
            <div className={cn(
              "relative z-10 p-2.5 rounded-full",
              "transition-all duration-300 ease-in-out",
              "text-neutral-500",
              "group-hover:bg-neutral-50 group-hover:border group-hover:border-neutral-200/50",
              "group-hover:scale-95 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
              "group-hover:text-neutral-800"
            )}>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </motion.div>

        <UserProfileButton />
      </div>
    </div>
  );
}