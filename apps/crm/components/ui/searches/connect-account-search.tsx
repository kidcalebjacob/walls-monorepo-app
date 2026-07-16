"use client";

import { useEffect, useState, useRef } from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChevronDown, CheckCircle } from "lucide-react";

const FALLBACK_AVATAR = FALLBACK_ICON_URL;

const platformLabels: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
};

export interface ConnectAccountItem {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_pic_url: string | null;
  platform: string;
}

interface ConnectAccountSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  accounts: ConnectAccountItem[];
  className?: string;
  placeholder?: string;
}

function getDisplayName(account: ConnectAccountItem): string {
  return account.full_name?.trim() || account.username || account.platform || "Unknown";
}

function getPlatformLabel(platform: string): string {
  return platformLabels[platform.toLowerCase()] ?? platform;
}

export function ConnectAccountSearch({
  value,
  onValueChange,
  accounts,
  className,
  placeholder = "Select account...",
}: ConnectAccountSearchProps) {
  const [filteredAccounts, setFilteredAccounts] = useState<ConnectAccountItem[]>(accounts);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFilteredAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredAccounts(accounts);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = accounts.filter(
      (account) =>
        getDisplayName(account).toLowerCase().includes(query) ||
        (account.username ?? "").toLowerCase().includes(query) ||
        account.platform.toLowerCase().includes(query)
    );
    setFilteredAccounts(filtered);
  }, [searchQuery, accounts]);

  const selectedAccount = accounts.find((a) => a.id === value);

  return (
    <div className="w-full">
      <Select
        value={value || ""}
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setSearchQuery("");
          } else {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        onValueChange={(v) => {
          onValueChange(v);
          setIsOpen(false);
        }}
      >
        <SelectTrigger
          className={cn(
            "relative group px-3 py-2 h-10 w-full flex items-center justify-between border-0 shadow-none bg-transparent focus:ring-0 focus:ring-offset-0 [&>:last-child]:hidden",
            className
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedAccount?.profile_pic_url ? (
              <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                <Image
                  src={selectedAccount.profile_pic_url}
                  alt={getDisplayName(selectedAccount)}
                  fill
                  className="object-cover"
                  sizes="24px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = FALLBACK_AVATAR;
                  }}
                />
              </div>
            ) : (
              <div className="w-6 h-6 flex-shrink-0 rounded-full bg-neutral-200 flex items-center justify-center">
                <span className="text-xs text-neutral-600 font-medium">
                  {selectedAccount ? getDisplayName(selectedAccount).charAt(0).toUpperCase() : "?"}
                </span>
              </div>
            )}
            <span className="font-normal truncate">
              {selectedAccount
                ? `${getDisplayName(selectedAccount)}${selectedAccount.username ? ` (@${selectedAccount.username})` : ""} · ${getPlatformLabel(selectedAccount.platform)}`
                : placeholder}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          align="start"
          sideOffset={8}
          className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-full min-w-[350px] max-h-[500px] overflow-hidden flex flex-col [&>div]:!p-0 rounded-lg"
        >
          <div className="p-2 border-b border-gray-900/10 flex-shrink-0 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
            <div className="rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  e.stopPropagation();
                  setSearchQuery(e.target.value);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") setSearchQuery("");
                }}
                placeholder="Search accounts..."
                className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full text-sm focus:outline-none placeholder:text-neutral-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 bg-neutral-300/20 backdrop-blur-xl">
            {filteredAccounts.length === 0 ? (
              <div className="py-2 px-4 text-sm text-gray-500">No accounts found</div>
            ) : (
              filteredAccounts.map((account) => {
                const isSelected = value === account.id;
                return (
                  <div
                    key={account.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onValueChange(account.id);
                      setIsOpen(false);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className={cn(
                      "flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 relative",
                      isSelected && "bg-kenoo-yellow/40"
                    )}
                  >
                    <div className="flex items-center space-x-3 w-full">
                      <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                        {account.profile_pic_url ? (
                          <Image
                            src={account.profile_pic_url}
                            alt={getDisplayName(account)}
                            fill
                            className="object-cover"
                            sizes="24px"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = FALLBACK_AVATAR;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                            <span className="text-xs text-neutral-600 font-medium">
                              {getDisplayName(account).charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-normal text-sm">
                          {getDisplayName(account)}
                          {account.username && (
                            <span className="text-gray-500"> @{account.username}</span>
                          )}
                          <span className="text-gray-500"> · {getPlatformLabel(account.platform)}</span>
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-black ml-auto flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
