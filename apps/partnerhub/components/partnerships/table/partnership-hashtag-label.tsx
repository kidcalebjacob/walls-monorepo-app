"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { wallsToast } from "@/components/ui/walls-toast";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  HashtagSearchPlatform,
  partnershipHashtagHasPlatform,
} from "@/lib/partnerhub-hashtag-search";
import { cn } from "@/lib/utils";

const formatHashtagLabel = (tag: string): string =>
  tag.startsWith("#") ? tag : `#${tag}`;

const HOVER_CLOSE_DELAY_MS = 120;

const PLATFORM_SEARCH_OPTIONS: {
  platform: HashtagSearchPlatform;
  label: string;
  icon: React.ReactNode;
  contentLabel: string;
}[] = [
  {
    platform: "tiktok",
    label: "TikTok",
    icon: <FaTiktok className="h-3.5 w-3.5 shrink-0 text-black" />,
    contentLabel: "TikTok posts",
  },
  {
    platform: "youtube",
    label: "YouTube",
    icon: <FaYoutube className="h-3.5 w-3.5 shrink-0 text-red-500" />,
    contentLabel: "YouTube videos",
  },
  {
    platform: "instagram",
    label: "Instagram",
    icon: <FaInstagram className="h-3.5 w-3.5 shrink-0 text-pink-500" />,
    contentLabel: "Instagram reels",
  },
];

interface PartnershipHashtagLabelProps {
  tag: string;
  companyId?: string;
  platforms: string[];
  postedAts: string[];
  showComma?: boolean;
}

export function PartnershipHashtagLabel({
  tag,
  companyId,
  platforms,
  postedAts,
  showComma = false,
}: PartnershipHashtagLabelProps) {
  const label = formatHashtagLabel(tag);
  const [open, setOpen] = useState(false);
  const [searchingPlatform, setSearchingPlatform] =
    useState<HashtagSearchPlatform | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  const handleSearchPosts = async (searchPlatform: HashtagSearchPlatform) => {
    if (!companyId) {
      wallsToast.error("Missing company", "This partnership has no linked company.");
      return;
    }

    setSearchingPlatform(searchPlatform);
    try {
      const response = await fetch("/api/partnerhub/hashtag-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          hashtag: tag,
          postedAts,
          searchPlatform,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to search hashtag"
        );
      }

      const option = PLATFORM_SEARCH_OPTIONS.find((o) => o.platform === searchPlatform);
      wallsToast.success(
        "Search queued",
        `Looking for more ${option?.contentLabel ?? "posts"} with ${label}.`
      );

      setOpen(false);
    } catch (error) {
      wallsToast.error(
        "Search failed",
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSearchingPlatform(null);
    }
  };

  return (
    <span className="inline-flex items-baseline">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <motion.span
            className="relative inline-block cursor-pointer group/hashtag"
            initial="initial"
            whileHover="hover"
            variants={{ initial: {}, hover: {} }}
            onMouseEnter={() => {
              clearCloseTimeout();
              setOpen(true);
            }}
            onMouseLeave={scheduleClose}
          >
            <span
              className={cn(
                "text-sm font-light transition-colors duration-300",
                open ? "text-walls-sky" : "text-foreground group-hover/hashtag:text-walls-sky"
              )}
            >
              {label}
            </span>
            <motion.div
              className="absolute bottom-0 left-0 h-px w-full origin-left bg-walls-sky"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: open ? 1 : undefined }}
              variants={{
                initial: { scaleX: 0 },
                hover: { scaleX: 1 },
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          </motion.span>
        </PopoverAnchor>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-auto min-w-[12.5rem] rounded-md border border-neutral-200 bg-white p-2 shadow-md"
          onMouseEnter={clearCloseTimeout}
          onMouseLeave={scheduleClose}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="px-2.5 pb-1.5 text-[10px] font-light uppercase tracking-[0.12em] text-neutral-500">
            Search on
          </p>
          <div className="flex flex-col gap-0.5">
            {PLATFORM_SEARCH_OPTIONS.map(({ platform, label: platformLabel, icon }) => {
              const isSearching = searchingPlatform === platform;
              const isBusy = searchingPlatform !== null;
              const isEnabled = platform === "instagram";
              const hasPlatformPost = partnershipHashtagHasPlatform(platforms, platform);

              return (
                <button
                  key={platform}
                  type="button"
                  disabled={isBusy || !isEnabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isEnabled) return;
                    void handleSearchPosts(platform);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-light transition-colors",
                    isEnabled
                      ? "text-neutral-700 hover:bg-neutral-100 hover:text-walls-sky"
                      : "text-neutral-400 cursor-not-allowed",
                    "disabled:opacity-60",
                    isEnabled && "disabled:cursor-wait"
                  )}
                >
                  {icon}
                  <span className="min-w-0 flex-1 truncate">{platformLabel}</span>
                  {isSearching ? (
                    <span className="shrink-0 text-[10px] text-neutral-500">Searching…</span>
                  ) : (
                    <span className="shrink-0">
                      {isEnabled ? (
                        <Search className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      ) : (
                        <span className="text-[10px] text-neutral-400">Soon</span>
                      )}
                    </span>
                  )}
                  {!hasPlatformPost && (
                    <span className="sr-only">
                      Tag not on a {platformLabel} post in this partnership
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {showComma && (
        <span className="text-sm font-light text-foreground">,</span>
      )}
    </span>
  );
}
