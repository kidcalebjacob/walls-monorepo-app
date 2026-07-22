"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef } from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, MailOpen, Loader2, Star, Archive, ArchiveRestore, Trash, CircleDollarSign, CircleCheckBig } from 'lucide-react';
import { Thread, MailboxType } from '@/types/email.types';
import { cn } from "@/lib/utils";
import {
  formatPreviewDate,
  cleanSubject,
  getThreadParticipants
} from '@/utils/format-utils';
import { decodeHtmlEntities } from '@/utils/email-utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DealSearch } from "@/components/ui/deal-search";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { fetchThreadDetailFromSupabase } from "@/lib/agentMail/supabase-email";
import { CreateTasksPopup } from "@/components/agentsProjects/create-tasks-popup";
import type { Project } from "@/components/agentsProjects/types";
import { FallbackEmailAvatar } from "./ui/fallback-email-avatar";

interface EmailListProps {
  userEmail: string;
  userId?: string;
  mailbox: MailboxType;
  category: string;
  onThreadSelect: (threadId: string) => void;
  onThreadRemoved?: (threadId: string) => void;
  selectedThreadId?: string;
  onThreadDataReceived: (thread: Thread) => void;
  threads: Thread[];
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  forceRefresh: boolean;
  isLoading?: boolean;
  isTransitioning?: boolean;
  searchQuery?: string;
  selectAllChecked?: boolean;
  hasNextPage?: boolean;
  totalEmailCount?: number;
  isLoadingMore?: boolean;
}

interface EmailListItemProps {
  thread: Thread;
  isSelected: boolean;
  onSelect: (threadId: string) => void;
  onThreadRemoved?: (threadId: string) => void;
  currentUserEmail: string;
  userId?: string;
  onThreadDataReceived: (thread: Thread) => void;
  onStarThread: (threadId: string, starred: boolean) => void;
  onAddTask?: (thread: Thread) => void;
  index: number;
  isChecked: boolean;
  onCheckboxChange: (index: number, checked: boolean, shiftKey: boolean) => void;
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  currentMailbox: MailboxType;
}

// Date group helpers
type DateGroup = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'older';
const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_week: 'Last Week',
  older: 'Older',
};

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'today';
  if (diffDays < 2) return 'yesterday';
  if (diffDays < 7) return 'this_week';
  if (diffDays < 14) return 'last_week';
  return 'older';
}

function groupThreadsByDate(threads: Thread[]): [DateGroup, Thread[]][] {
  const order: DateGroup[] = ['today', 'yesterday', 'this_week', 'last_week', 'older'];
  const map: Record<DateGroup, Thread[]> = { today: [], yesterday: [], this_week: [], last_week: [], older: [] };
  for (const t of threads) {
    map[getDateGroup(t.lastMessageDate)].push(t);
  }
  return order.filter(g => map[g].length > 0).map(g => [g, map[g]]);
}

const EmailListItem = ({
  thread,
  isSelected,
  onSelect,
  onThreadRemoved,
  currentUserEmail,
  userId,
  onThreadDataReceived,
  onStarThread,
  onAddTask,
  index,
  isChecked,
  onCheckboxChange,
  setThreads,
  currentMailbox,
}: EmailListItemProps) => {
  const dealButtonRef = useRef<HTMLButtonElement>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [localUnread, setLocalUnread] = useState(thread.unread);
  const participants = getThreadParticipants(thread, currentUserEmail);
  const otherParticipant = thread.fromName ?? participants[0] ?? 'Unknown';
  const [localStarred, setLocalStarred] = useState(thread.labelIds?.includes('STARRED'));
  const [showDealSearch, setShowDealSearch] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const actionButtonClass =
    "p-2 rounded-full flex items-center justify-center text-neutral-400 border border-neutral-300/30 bg-white/60 backdrop-blur-sm backdrop-saturate-150 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_22px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out hover:border-white/55 hover:bg-gray-50/70 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99]";

  const showAvatarImg = !!thread.fromAvatarUrl && !avatarImgError;
  const isLinkedToDeals = Boolean(thread.dealId);

  useEffect(() => {
    setLocalStarred(thread.labelIds?.includes('STARRED'));
  }, [thread.labelIds]);

  useEffect(() => {
    setLocalUnread(thread.unread);
  }, [thread.unread]);

  useEffect(() => {
    if (isSelected && !isPreloaded) {
      prefetchThread();
    }
  }, [isSelected]);

  const handleStarClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStarredState = !localStarred;
    setLocalStarred(newStarredState);
    setThreads(prev =>
      prev.map(t =>
        t.id === thread.id
          ? { ...t, labelIds: newStarredState ? [...(t.labelIds || []), 'STARRED'] : (t.labelIds || []).filter(id => id !== 'STARRED') }
          : t
      )
    );
    try {
      const res = await fetch('/api/gmail/thread/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail, threadId: thread.threadId, starred: newStarredState }),
      });
      if (!res.ok) {
        setLocalStarred(!newStarredState);
        setThreads(prev =>
          prev.map(t =>
            t.id === thread.id
              ? { ...t, labelIds: !newStarredState ? [...(t.labelIds || []), 'STARRED'] : (t.labelIds || []).filter(id => id !== 'STARRED') }
              : t
          )
        );
      }
    } catch {
      setLocalStarred(!newStarredState);
      setThreads(prev =>
        prev.map(t =>
          t.id === thread.id
            ? { ...t, labelIds: !newStarredState ? [...(t.labelIds || []), 'STARRED'] : (t.labelIds || []).filter(id => id !== 'STARRED') }
            : t
        )
      );
    }
  };

  const prefetchThread = async () => {
    if (isPreloaded || !userId) return;
    try {
      const supabase = getSupabaseClient();
      const threadData = await fetchThreadDetailFromSupabase(supabase, userId, thread.threadId);
      if (threadData) {
        onThreadDataReceived(threadData);
        setIsPreloaded(true);
      }
    } catch (e) {
      console.error("Error prefetching thread:", e);
    }
  };

  const toggleReadStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMarking) return;
    setIsMarking(true);
    const newUnread = !localUnread;
    const updatedLabels = newUnread
      ? Array.from(new Set([...(thread.labelIds || []), "UNREAD"]))
      : (thread.labelIds || []).filter(id => id !== "UNREAD");
    setLocalUnread(newUnread);
    setThreads(prev =>
      prev.map(t => t.id === thread.id ? { ...t, unread: newUnread, labelIds: updatedLabels } : t)
    );
    const endpoint = localUnread ? "/api/gmail/thread/mark-as-read" : "/api/gmail/thread/mark-as-unread";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.threadId, userEmail: currentUserEmail }),
    })
      .then(res => { if (!res.ok) throw new Error(`Failed to update read status: ${res.statusText}`); })
      .catch(() => {
        setLocalUnread(thread.unread);
        setThreads(prev =>
          prev.map(t => t.id === thread.id ? { ...t, unread: thread.unread, labelIds: thread.labelIds || [] } : t)
        );
      })
      .finally(() => setIsMarking(false));
  };

  const handleClick = () => {
    onSelect(thread.threadId);
    if (localUnread) {
      const updatedLabels = (thread.labelIds || []).filter(id => id !== "UNREAD");
      setLocalUnread(false);
      setThreads(prev =>
        prev.map(t => t.id === thread.id ? { ...t, unread: false, labelIds: updatedLabels } : t)
      );
      fetch("/api/gmail/thread/mark-as-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.threadId, userEmail: currentUserEmail }),
      }).catch(e => {
        console.error("Error marking thread as read:", e);
        setLocalUnread(true);
        setThreads(prev =>
          prev.map(t => t.id === thread.id ? { ...t, unread: true, labelIds: thread.labelIds || [] } : t)
        );
      });
    }
  };

  const handleTrashThread = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const removed = thread;
    setThreads(prev => prev.filter(t => t.id !== thread.id));
    onThreadRemoved?.(thread.threadId);
    wallsToast.success("Moved to trash");
    try {
      const res = await fetch("/api/gmail/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.threadId, userEmail: currentUserEmail }),
      });
      if (!res.ok) {
        setThreads(prev => [...prev, removed].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
      }
    } catch {
      setThreads(prev => [...prev, removed].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
    }
  };

  const handleArchiveThread = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const removed = thread;
    setThreads(prev => prev.filter(t => t.id !== thread.id));
    onThreadRemoved?.(thread.threadId);
    wallsToast.negative("Archived");
    try {
      const res = await fetch("/api/gmail/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.threadId, userEmail: currentUserEmail }),
      });
      if (!res.ok) {
        setThreads(prev => [...prev, removed].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
      }
    } catch {
      setThreads(prev => [...prev, removed].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
    }
  };

  const handleUnarchiveThread = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const removed = thread;
    setThreads(prev => prev.filter(t => t.id !== thread.id));
    onThreadRemoved?.(thread.threadId);
    wallsToast.success("Moved to inbox");
    try {
      const res = await fetch("/api/gmail/unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.threadId, userEmail: currentUserEmail }),
      });
      if (!res.ok) {
        setThreads(prev => [...prev, removed].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
      }
    } catch {
      setThreads(prev => [...prev, removed].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-2xl p-3.5 cursor-pointer",
        "border transition-all duration-150",
        // glass look: read = nearly transparent, unread = more visible
        !isSelected && "border border-white/30 shadow-lg hover:border-white/50",
        localUnread && "bg-white/80",
        !localUnread && "bg-white/5",
        isSelected && "border-[rgba(110,173,192,0.45)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]",
        isLinkedToDeals && !isSelected && "border-l-[6px] border-l-kenoo-sky/40 hover:border-l-kenoo-sky/40",
      )}
      onClick={handleClick}
      onMouseEnter={() => { prefetchThread(); setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar — reveals checkbox on hover/check */}
      <div className="relative shrink-0 mt-0.5 w-10 h-10">
        <div className={cn(
          "w-10 h-10 rounded-full transition-opacity duration-150 select-none overflow-hidden",
          (isHovered || isChecked) && "opacity-0 pointer-events-none"
        )}>
          {showAvatarImg ? (
            <Image
              src={thread.fromAvatarUrl!}
              alt={otherParticipant}
              width={40}
              height={40}
              className="w-full h-full object-cover"
              onError={() => setAvatarImgError(true)}
            />
          ) : (
            <FallbackEmailAvatar name={otherParticipant} />
          )}
        </div>
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
          (isHovered || isChecked) ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <Checkbox
            checked={isChecked}
            className={cn(
              "h-5 w-5 rounded-full border-neutral-300",
              "data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-kenoo-yellow",
              "focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
            onClick={e => e.stopPropagation()}
            onCheckedChange={checked => {
              onCheckboxChange(index, checked as boolean, (window.event as MouseEvent).shiftKey);
            }}
          />
        </div>
      </div>

      {/* Card content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Sender name + thread count | Star */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {localUnread && (
              <span className="w-2 h-2 rounded-full bg-walls-lime shrink-0 shadow-[0_0_5px_rgba(206,255,0,0.7)]" />
            )}
            <span className={cn(
              "text-sm truncate",
              localUnread ? "font-light text-neutral-900" : "font-light text-neutral-500"
            )}>
              {otherParticipant}
            </span>
            {thread.messagesCount > 1 && (
              <span className="text-xs text-neutral-400 shrink-0 font-normal">
                {thread.messagesCount}
              </span>
            )}
          </div>
          {/* Star — always visible when starred, else only on hover */}
          <button
            onClick={handleStarClick}
            className={cn(
              "shrink-0 w-9 h-9 flex items-center justify-center focus:outline-none transition-opacity duration-150 group/icon",
              localStarred ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <span className="flex items-center justify-center p-1.5 rounded-full border border-transparent bg-transparent transition-all duration-300 ease-in-out group-hover/icon:bg-gray-50 group-hover/icon:border-neutral-200 group-hover/icon:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover/icon:scale-95">
              <Star className={cn(
                "w-5 h-5 stroke-[1.5]",
                localStarred ? "fill-yellow-300 text-yellow-300" : "text-neutral-300"
              )} />
            </span>
          </button>
        </div>

        {/* Row 2: Subject */}
        <div className="mt-0.5 truncate">
          <span className={cn(
            "text-[13px] leading-snug font-normal text-neutral-600"
          )}>
            {cleanSubject(thread.subject)}
          </span>
        </div>

        {/* Row 3: Snippet | Date + actions (fixed-size slot so hover doesn't change height) */}
        <div className="flex items-center justify-between gap-2 mt-1 min-h-[36px]">
          <span className="text-xs text-neutral-400 truncate leading-relaxed min-h-[20px] flex-1 min-w-0">
            {decodeHtmlEntities(thread.snippet)}
          </span>

          {/* Fixed-width slot: date and actions overlay so layout never shifts */}
          <motion.div
            className="shrink-0 min-h-[36px] flex items-center justify-end relative"
            animate={{ width: isHovered ? 232 : 180 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {/* Date — visible when not hovered */}
            <span
              className={cn(
                "text-xs font-light text-neutral-400 whitespace-nowrap absolute right-0 top-1/2 -translate-y-1/2 transition-opacity duration-150",
                isHovered && "opacity-0 pointer-events-none"
              )}
            >
              {formatPreviewDate(thread.lastMessageDate)}
            </span>
            {/* Actions — visible on hover, same slot */}
            <div
              className={cn(
                "absolute right-0 -top-1 flex items-center gap-1.5 transition-opacity duration-100",
                isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <Popover open={showDealSearch} onOpenChange={setShowDealSearch}>
                <PopoverTrigger asChild>
                  <button
                    ref={dealButtonRef}
                    onClick={e => e.stopPropagation()}
                    className={cn(
                      actionButtonClass,
                      "group/icon",
                      isLinkedToDeals && "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)] border-[rgba(110,173,192,0.45)]"
                    )}
                    title="Link to deal"
                  >
                    <CircleDollarSign className="h-5 w-5 stroke-[1.4]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-[350px] min-w-[350px] max-h-[500px] overflow-hidden flex flex-col rounded-lg border border-neutral-200/60"
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  onOpenAutoFocus={e => e.preventDefault()}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  {userId ? (
                    <DealSearch
                      threadId={thread.threadId}
                      userId={userId}
                      linkedDealId={thread.dealId}
                      onDealLinked={dealId => {
                        setThreads(prev =>
                          prev.map(t => t.id === thread.id ? { ...t, dealId: dealId ?? undefined } : t)
                        );
                      }}
                      onClose={() => setShowDealSearch(false)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 px-4">Sign in to link emails to deals.</p>
                  )}
                </PopoverContent>
              </Popover>

              {onAddTask && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onAddTask(thread);
                  }}
                  className={cn(actionButtonClass, "group/icon")}
                  title="Create task from email"
                >
                  <CircleCheckBig className="h-5 w-5 stroke-[1.4]" />
                </button>
              )}

              <button
                onClick={toggleReadStatus}
                className={cn(actionButtonClass, "group/icon")}
                title={localUnread ? "Mark as read" : "Mark as unread"}
              >
                {localUnread ? <MailOpen className="h-5 w-5 stroke-[1.4]" /> : <Mail className="h-5 w-5 stroke-[1.4]" />}
              </button>

              {currentMailbox === 'archive' ? (
                <button
                  onClick={handleUnarchiveThread}
                  className={cn(actionButtonClass, "group/icon")}
                  title="Move to inbox"
                >
                  <ArchiveRestore className="h-5 w-5 stroke-[1.4]" />
                </button>
              ) : (
                <button
                  onClick={handleArchiveThread}
                  className={cn(actionButtonClass, "group/icon")}
                  title="Archive"
                >
                  <Archive className="h-5 w-5 stroke-[1.4]" />
                </button>
              )}

              <button
                onClick={handleTrashThread}
                className={cn(actionButtonClass, "group/icon")}
                title="Delete"
              >
                <Trash className="h-5 w-5 stroke-[1.4]" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const EmailListSentinel = ({
  hasNextPage,
  isLoadingMore,
  displayedEmailCount,
  totalEmailCount
}: {
  hasNextPage: boolean;
  isLoadingMore: boolean;
  displayedEmailCount: number;
  totalEmailCount: number;
}) => {
  if (isLoadingMore) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-walls-light" />
      </div>
    );
  }
  if (!hasNextPage && displayedEmailCount > 0) {
    return (
      <div className="py-6 flex justify-center">
        <span className="text-xs text-neutral-400">You're all caught up</span>
      </div>
    );
  }
  return null;
};

const EMAIL_TASK_PROJECT_SLUG = "email-tasks";

/** Get or create the "Email tasks" project for the current user (slug email-tasks, owner_id). */
async function getOrCreateEmailTaskProject(
  supabase: ReturnType<typeof getSupabaseClient>,
  ownerId: string
): Promise<Project> {
  const { data: existing } = await supabase
    .from("projects")
    .select("id, name, slug, description, status, start_date, due_date, completed_at, owner_id, priority, color, metadata, created_at, updated_at")
    .eq("slug", EMAIL_TASK_PROJECT_SLUG)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (existing) return existing as Project;
  const { data: created, error } = await supabase
    .from("projects")
    .insert({
      name: "Email tasks",
      slug: EMAIL_TASK_PROJECT_SLUG,
      description: "Tasks related to email conversations",
      status: "active",
      color: "#ceff00",
      priority: 3,
      owner_id: ownerId,
    })
    .select()
    .single();
  if (error) throw error;
  return created as Project;
}

const filterThreadsBySearch = (threads: Thread[], searchQuery: string): Thread[] => {
  if (!searchQuery) return threads;
  const query = searchQuery.toLowerCase();
  return threads.filter(thread => {
    if (thread.subject?.toLowerCase().includes(query)) return true;
    if (thread.snippet?.toLowerCase().includes(query)) return true;
    if (thread.textContent?.toLowerCase().includes(query)) return true;
    if (thread.from?.toLowerCase().includes(query)) return true;
    if (typeof thread.to === 'string' && thread.to.toLowerCase().includes(query)) return true;
    if (thread.threadEmails?.some(email =>
      email.subject?.toLowerCase().includes(query) ||
      email.snippet?.toLowerCase().includes(query) ||
      email.from?.toLowerCase().includes(query) ||
      (typeof email.to === 'string' && email.to.toLowerCase().includes(query)) ||
      email.textContent?.toLowerCase().includes(query)
    )) return true;
    return false;
  });
};

export default function EmailList({
  userEmail,
  userId,
  mailbox,
  category,
  onThreadSelect,
  onThreadRemoved,
  selectedThreadId,
  onThreadDataReceived,
  threads,
  setThreads,
  forceRefresh,
  isLoading = false,
  isTransitioning = false,
  searchQuery = "",
  selectAllChecked = false,
  hasNextPage: hasNextPageProp,
  totalEmailCount: totalEmailCountProp,
  isLoadingMore: isLoadingMoreProp,
}: EmailListProps) {
  const [checkedEmails, setCheckedEmails] = useState<Set<number>>(new Set());
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [taskPopupOpen, setTaskPopupOpen] = useState(false);
  const [taskPopupEmailThreadId, setTaskPopupEmailThreadId] = useState<string | null>(null);
  const [taskPopupProject, setTaskPopupProject] = useState<Project | null>(null);
  const [taskPopupResolving, setTaskPopupResolving] = useState(false);
  const hasNextPage = hasNextPageProp ?? false;
  const totalEmailCount = totalEmailCountProp ?? 0;
  const isLoadingMore = isLoadingMoreProp ?? false;

  useEffect(() => {
    if (forceRefresh) {
      setCheckedEmails(new Set());
      setLastCheckedIndex(null);
    }
  }, [forceRefresh]);

  const handleStarThread = async (threadId: string, starred: boolean) => {
    try {
      const response = await fetch(`/api/gmail/thread/star`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, threadId, starred }),
      });
      if (response.ok) {
        setThreads(prev =>
          prev.map(t =>
            t.id === threadId
              ? { ...t, labelIds: starred ? [...(t.labelIds || []), "STARRED"] : (t.labelIds || []).filter(id => id !== "STARRED") }
              : t
          )
        );
      }
    } catch (e) {
      console.error("Error updating star status:", e);
    }
  };

  const handleAddTaskFromEmail = async (thread: Thread) => {
    if (!userId) {
      wallsToast.error("Sign in to create tasks from emails.");
      return;
    }
    setTaskPopupResolving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: threadRow } = await supabase
        .from("email_threads")
        .select("id")
        .eq("provider_thread_id", thread.threadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!threadRow?.id) {
        wallsToast.error("Could not find this email thread.");
        return;
      }
      const project = await getOrCreateEmailTaskProject(supabase, userId);
      setTaskPopupEmailThreadId(threadRow.id);
      setTaskPopupProject(project);
      setTaskPopupOpen(true);
    } catch (e) {
      console.error("Error opening task popup:", e);
      wallsToast.error("Could not open task form.");
    } finally {
      setTaskPopupResolving(false);
    }
  };

  const handleCheckboxChange = (index: number, checked: boolean, shiftKey: boolean) => {
    const newCheckedEmails = new Set(checkedEmails);
    if (shiftKey && lastCheckedIndex !== null) {
      const start = Math.min(lastCheckedIndex, index);
      const end = Math.max(lastCheckedIndex, index);
      for (let i = start; i <= end; i++) {
        checked ? newCheckedEmails.add(i) : newCheckedEmails.delete(i);
      }
    } else {
      checked ? newCheckedEmails.add(index) : newCheckedEmails.delete(index);
    }
    setLastCheckedIndex(index);
    setCheckedEmails(newCheckedEmails);
  };

  // Get selected thread IDs from checked indices
  const getSelectedThreadIds = (): string[] => {
    return filteredThreads
      .filter((_, idx) => checkedEmails.has(idx))
      .map(thread => thread.threadId);
  };

  // Bulk action handlers
  const handleBulkDelete = async () => {
    const selectedThreadIds = getSelectedThreadIds();
    if (selectedThreadIds.length === 0) return;

    const removedThreads = filteredThreads.filter((_, idx) => checkedEmails.has(idx));
    
    // Optimistically remove from UI
    setThreads(prev => prev.filter(t => !selectedThreadIds.includes(t.threadId)));
    setCheckedEmails(new Set());
    setLastCheckedIndex(null);

    wallsToast.success("Moved to trash");

    // Perform bulk delete
    const promises = selectedThreadIds.map(threadId =>
      fetch("/api/gmail/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, userEmail }),
      })
    );

    try {
      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
      if (failed.length > 0) {
        // Restore failed threads
        setThreads(prev => [...prev, ...removedThreads].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
        wallsToast.error(`Failed to delete ${failed.length} email(s)`);
      }
    } catch (e) {
      setThreads(prev => [...prev, ...removedThreads].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
      wallsToast.error("Failed to delete emails");
    }
  };

  const handleBulkArchive = async () => {
    const selectedThreadIds = getSelectedThreadIds();
    if (selectedThreadIds.length === 0) return;

    const removedThreads = filteredThreads.filter((_, idx) => checkedEmails.has(idx));

    // Optimistically remove from UI
    setThreads(prev => prev.filter(t => !selectedThreadIds.includes(t.threadId)));
    setCheckedEmails(new Set());
    setLastCheckedIndex(null);

    wallsToast.negative("Archived");

    // Perform bulk archive
    const promises = selectedThreadIds.map(threadId =>
      fetch("/api/gmail/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, userEmail }),
      })
    );

    try {
      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
      if (failed.length > 0) {
        // Restore failed threads
        setThreads(prev => [...prev, ...removedThreads].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
        wallsToast.error(`Failed to archive ${failed.length} email(s)`);
      }
    } catch (e) {
      setThreads(prev => [...prev, ...removedThreads].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
      wallsToast.error("Failed to archive emails");
    }
  };

  const handleBulkUnarchive = async () => {
    const selectedThreadIds = getSelectedThreadIds();
    if (selectedThreadIds.length === 0) return;

    const removedThreads = filteredThreads.filter((_, idx) => checkedEmails.has(idx));

    // Optimistically remove from UI
    setThreads(prev => prev.filter(t => !selectedThreadIds.includes(t.threadId)));
    setCheckedEmails(new Set());
    setLastCheckedIndex(null);

    wallsToast.success("Moved to inbox");

    // Perform bulk unarchive
    const promises = selectedThreadIds.map(threadId =>
      fetch("/api/gmail/unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, userEmail }),
      })
    );

    try {
      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
      if (failed.length > 0) {
        setThreads(prev => [...prev, ...removedThreads].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
        wallsToast.error(`Failed to unarchive ${failed.length} email(s)`);
      }
    } catch (e) {
      setThreads(prev => [...prev, ...removedThreads].sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()));
      wallsToast.error("Failed to unarchive emails");
    }
  };

  const handleBulkMarkAsRead = async () => {
    const selectedThreadIds = getSelectedThreadIds();
    if (selectedThreadIds.length === 0) return;

    // Optimistically update UI
    setThreads(prev =>
      prev.map(t =>
        selectedThreadIds.includes(t.threadId)
          ? { ...t, unread: false, labelIds: (t.labelIds || []).filter(id => id !== "UNREAD") }
          : t
      )
    );
    setCheckedEmails(new Set());
    setLastCheckedIndex(null);

    // Perform bulk mark as read
    const promises = selectedThreadIds.map(threadId =>
      fetch("/api/gmail/thread/mark-as-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, userEmail }),
      })
    );

    try {
      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));

      if (failed.length > 0) {
        wallsToast.error(`Failed to mark ${failed.length} email(s) as read`);
        // Revert optimistic update for failed threads
        const failedThreadIds = selectedThreadIds.filter((_, idx) => {
          const result = Array.from(results)[idx];
          return result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok);
        });
        setThreads(prev =>
          prev.map(t =>
            failedThreadIds.includes(t.threadId)
              ? { ...t, unread: true, labelIds: Array.from(new Set([...(t.labelIds || []), "UNREAD"])) }
              : t
          )
        );
      } else {
        const count = selectedThreadIds.length;
        wallsToast.success(`${count} ${count === 1 ? 'email' : 'emails'} marked as read`);
      }
    } catch (e) {
      wallsToast.error("Failed to mark emails as read");
      // Revert optimistic update
      setThreads(prev =>
        prev.map(t =>
          selectedThreadIds.includes(t.threadId)
            ? { ...t, unread: true, labelIds: Array.from(new Set([...(t.labelIds || []), "UNREAD"])) }
            : t
        )
      );
    }
  };

  const handleBulkMarkAsUnread = async () => {
    const selectedThreadIds = getSelectedThreadIds();
    if (selectedThreadIds.length === 0) return;

    // Optimistically update UI
    setThreads(prev =>
      prev.map(t =>
        selectedThreadIds.includes(t.threadId)
          ? { ...t, unread: true, labelIds: Array.from(new Set([...(t.labelIds || []), "UNREAD"])) }
          : t
      )
    );
    setCheckedEmails(new Set());
    setLastCheckedIndex(null);

    // Perform bulk mark as unread
    const promises = selectedThreadIds.map(threadId =>
      fetch("/api/gmail/thread/mark-as-unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, userEmail }),
      })
    );

    try {
      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));

      if (failed.length > 0) {
        wallsToast.error(`Failed to mark ${failed.length} email(s) as unread`);
        // Revert optimistic update for failed threads
        const failedThreadIds = selectedThreadIds.filter((_, idx) => {
          const result = Array.from(results)[idx];
          return result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok);
        });
        setThreads(prev =>
          prev.map(t =>
            failedThreadIds.includes(t.threadId)
              ? { ...t, unread: false, labelIds: (t.labelIds || []).filter(id => id !== "UNREAD") }
              : t
          )
        );
      } else {
        const count = selectedThreadIds.length;
        wallsToast.success(`${count} ${count === 1 ? 'email' : 'emails'} marked as unread`);
      }
    } catch (e) {
      wallsToast.error("Failed to mark emails as unread");
      // Revert optimistic update
      setThreads(prev =>
        prev.map(t =>
          selectedThreadIds.includes(t.threadId)
            ? { ...t, unread: false, labelIds: (t.labelIds || []).filter(id => id !== "UNREAD") }
            : t
        )
      );
    }
  };

  const filteredThreads = React.useMemo(() =>
    filterThreadsBySearch(threads, searchQuery),
    [threads, searchQuery]
  );

  useEffect(() => {
    const newCheckedEmails = new Set<number>();
    if (selectAllChecked) {
      filteredThreads.forEach((_, index) => newCheckedEmails.add(index));
    }
    setCheckedEmails(newCheckedEmails);
  }, [selectAllChecked, filteredThreads]);

  const grouped = React.useMemo(() => groupThreadsByDate(filteredThreads), [filteredThreads]);

  if (isLoading && filteredThreads.length === 0) {
    return (
      <div className="h-full flex flex-col bg-neutral-100 rounded-tl-2xl overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <div className="flex flex-col items-center justify-center gap-0 pt-16">
            <Image
              src={FALLBACK_ICON_URL}
              alt="Loading"
              width={180}
              height={180}
              className="rounded-full object-cover aspect-square"
            />
            <div className="w-48 h-1 bg-neutral-100 rounded-full overflow-hidden -mt-9">
              <motion.div
                className="h-full bg-[#e2f85c] rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: 1.5,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!filteredThreads || filteredThreads.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full",
        "bg-neutral-100 rounded-t-2xl rounded-bl-2xl"
      )}>
        {searchQuery ? (
          <div className="text-sm text-neutral-400">No matching emails found</div>
        ) : (
          <>
            <div className="py-6 flex justify-center">
              <span className="text-xs text-neutral-400">You&apos;re all caught up</span>
            </div>
            <div className="flex flex-col items-center py-2 space-y-0.5">
              <a
                href="/privacy-policy"
                className="text-xs text-neutral-400 hover:text-walls-light transition-colors"
              >
                Privacy Policy
              </a>
              <span className="text-xs text-neutral-300">Powered by WALLS</span>
            </div>
          </>
        )}
      </div>
    );
  }

  // Build a flat global index map for checkbox logic
  let globalIndex = 0;

  const selectedCount = checkedEmails.size;
  const allSelected = filteredThreads.length > 0 && checkedEmails.size === filteredThreads.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all emails
      const allIndices = new Set<number>();
      filteredThreads.forEach((_, index) => allIndices.add(index));
      setCheckedEmails(allIndices);
      setLastCheckedIndex(null);
    } else {
      // Deselect all emails
      setCheckedEmails(new Set());
      setLastCheckedIndex(null);
    }
  };

  return (
    <div
      className={cn(
        "h-full flex flex-col overflow-hidden",
        "bg-neutral-100 rounded-tl-2xl",
        "transition-all duration-300 ease-in-out",
        isTransitioning && "opacity-50 pointer-events-none"
      )}
    >
      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-none overflow-hidden bg-neutral-50"
          >
            <div className="py-3 flex items-center justify-between gap-3 pl-[32px] pr-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className={cn(
                    "h-5 w-5 rounded-full border-neutral-300",
                    "data-[state=checked]:bg-black data-[state=checked]:border-black data-[state=checked]:text-kenoo-yellow",
                    "focus-visible:ring-0 focus-visible:ring-offset-0"
                  )}
                />
                <span className="text-sm font-normal text-neutral-700">
                  {selectedCount} {selectedCount === 1 ? 'email' : 'emails'} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkMarkAsRead}
                  className="h-8 px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <MailOpen className="h-4 w-4 mr-1.5" />
                  Mark as Read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkMarkAsUnread}
                  className="h-8 px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  Mark as Unread
                </Button>
                {mailbox === 'archive' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkUnarchive}
                    className="h-8 px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                  >
                    <ArchiveRestore className="h-4 w-4 mr-1.5" />
                    Move to Inbox
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkArchive}
                    className="h-8 px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                  >
                    <Archive className="h-4 w-4 mr-1.5" />
                    Archive
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="h-8 px-3 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          "scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent"
        )}
        data-scrollable="true"
      >
        <div className="px-2.5 py-2.5 space-y-4">
        {grouped.map(([group, groupThreads]) => {
          const groupStart = globalIndex;
          globalIndex += groupThreads.length;
          return (
            <div key={group}>
              {/* Date group label */}
              <div className="px-1.5 pb-1.5 pt-0.5">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
                  {DATE_GROUP_LABELS[group]}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-1.5">
                {groupThreads.map((thread, localIdx) => {
                  const idx = groupStart + localIdx;
                  return (
                    <EmailListItem
                      key={thread.id}
                      thread={thread}
                      isSelected={selectedThreadId === thread.threadId}
                      onSelect={onThreadSelect}
                      onThreadRemoved={onThreadRemoved}
                      currentUserEmail={userEmail}
                      userId={userId}
                      onThreadDataReceived={onThreadDataReceived}
                      onStarThread={handleStarThread}
                      onAddTask={userId ? handleAddTaskFromEmail : undefined}
                      index={idx}
                      isChecked={checkedEmails.has(idx)}
                      onCheckboxChange={handleCheckboxChange}
                      setThreads={setThreads}
                      currentMailbox={mailbox}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <EmailListSentinel
          hasNextPage={hasNextPage}
          isLoadingMore={isLoadingMore}
          displayedEmailCount={filteredThreads.length}
          totalEmailCount={totalEmailCount}
        />

        <div className="flex flex-col items-center py-2 space-y-0.5">
          <a
            href="/privacy-policy"
            className="text-xs text-neutral-400 hover:text-walls-light transition-colors"
          >
            Privacy Policy
          </a>
          <span className="text-xs text-neutral-300">Powered by WALLS</span>
        </div>
        </div>
      </div>

      {/* Create task from email popup — links task to thread_id */}
      <CreateTasksPopup
        open={taskPopupOpen && !!taskPopupProject && !!taskPopupEmailThreadId}
        onClose={() => {
          setTaskPopupOpen(false);
          setTaskPopupEmailThreadId(null);
          setTaskPopupProject(null);
        }}
        onSaved={() => {
          setTaskPopupOpen(false);
          setTaskPopupEmailThreadId(null);
          setTaskPopupProject(null);
          wallsToast.success("Task created and linked to this email.");
        }}
        projects={taskPopupProject ? [taskPopupProject] : []}
        defaultProjectId={taskPopupProject?.id ?? undefined}
        threadId={taskPopupEmailThreadId ?? undefined}
      />
    </div>
  );
}
