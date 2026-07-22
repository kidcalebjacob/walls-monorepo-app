"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import EmailList from "./email-list";
import EmailPreview from "./email-preview";
import TaskList from "./task-list";
import Sidebar from "./sidebar";
import TopBar from "./top-bar";
import { cn } from "@/lib/utils";
import { MailboxType, Draft, Thread, FullEmail } from "@/types/email.types";
import { useEmailReply } from "@/hooks/useEmailReply";
import EmailComposer from "@/components/agentCRM/emailComposer/email-composer";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import {
  fetchThreadsFromSupabase,
  fetchThreadDetailFromSupabase,
  fetchSidebarCountsFromSupabase,
  THREADS_PAGE_SIZE,
  type SidebarCounts,
} from "@/lib/agentMail/supabase-email";
import { wallsToast } from "@/components/ui/walls-toast";

interface ReplyData {
  content: string;
  threadId?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  to: string;
  cc?: string;
  subject: string;
}

/** Resolved user for email fetch: email (required) and optional users.id. */
type EffectiveUser = { email: string; id?: string };

export default function AgentEmail() {
  const { user: authUser } = useAuth();
  const [effectiveUser, setEffectiveUser] = useState<EffectiveUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [currentMailbox, setCurrentMailbox] = useState<MailboxType>("inbox");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [activeCategory, setActiveCategory] = useState("unopened");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentAccount, setCurrentAccount] = useState("");
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [sidebarCounts, setSidebarCounts] = useState<SidebarCounts>({
    inbox: 0,
    starred: 0,
    sent: 0,
    archive: 0,
    trash: 0,
    schedule: 0,
    deals: 0,
    inboxUnread: 0,
  });
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [threadCache, setThreadCache] = useState<Record<string, Thread>>({});
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allFilteredThreads, setAllFilteredThreads] = useState<Thread[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [totalEmailCount, setTotalEmailCount] = useState(0);
  const [hasMoreEmails, setHasMoreEmails] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showTasksView, setShowTasksView] = useState(false);
  /** Optimistic replies: show sent message in thread before refetch (keyed by threadId, inserted after afterMessageId). */
  const [optimisticReplies, setOptimisticReplies] = useState<Array<{ threadId: string; afterMessageId: string; message: FullEmail }>>([]);

  const threads = useMemo(() => allFilteredThreads, [allFilteredThreads]);

  const setThreads = useCallback(
    (updater: React.SetStateAction<Thread[]>) => {
      setAllFilteredThreads((prev) =>
        typeof updater === "function" ? (updater as (p: Thread[]) => Thread[])(prev) : updater
      );
    },
    []
  );

  const userEmail = effectiveUser?.email ?? "";
  const {
    replyTo,
    showReplyComposer,
    minimizedThreads,
    handleReply,
    handleForward,
    handleNewEmail,
    handleDraftReply,
    handleMinimize,
    handleSendReply,
    closeComposer,
    clearReply
  } = useEmailReply(userEmail);

  const [showEmailComposer, setShowEmailComposer] = useState(false);

  useEffect(() => {
    const resolveUser = async () => {
      if (!authUser?.id) {
        setEffectiveUser(null);
        setIsLoadingUser(false);
        return;
      }
      setIsLoadingUser(true);
      try {
        const supabase = getSupabaseClient();
        const tryById = await supabase
          .from("users")
          .select("id, email")
          .eq("id", authUser.id)
          .maybeSingle();
        if (!tryById.error && tryById.data?.email) {
          console.log("[emails] resolved user via users.id (= auth id)", tryById.data.email);
          setEffectiveUser({ email: tryById.data.email, id: tryById.data.id });
          setCurrentAccount(tryById.data.email);
          return;
        }
        if (authUser.email) {
          console.log("[emails] resolved user via auth fallback", authUser.email);
          setEffectiveUser({ email: authUser.email, id: authUser.id });
          setCurrentAccount(authUser.email);
          return;
        }
        console.warn("[emails] could not resolve user (no users row, no auth email)");
        setEffectiveUser(null);
      } catch (e) {
        console.error("[emails] resolve user:", e);
        if (authUser?.email) {
          setEffectiveUser({ email: authUser.email, id: authUser.id });
          setCurrentAccount(authUser.email);
        } else {
          setEffectiveUser(null);
        }
      } finally {
        setIsLoadingUser(false);
      }
    };
    resolveUser();
  }, [authUser?.id, authUser?.email]);

  const fetchEmails = useCallback(
    async (mailbox: MailboxType, category: string, page = 1, search = "") => {
      const userId = effectiveUser?.id;
      const supabase = getSupabaseClient();
      if (!userId) {
        console.warn("[emails fetch] agent-email: no userId (users.id), skipping fetch");
        return;
      }
      console.log("[emails fetch] agent-email: fetching from email_threads", { userId, mailbox, category, page, search });
      setIsLoadingEmails(true);
      try {
        const [result, counts] = await Promise.all([
          fetchThreadsFromSupabase(supabase, userId, mailbox, category, page, search || undefined),
          fetchSidebarCountsFromSupabase(supabase, userId),
        ]);
        console.log("[emails fetch] agent-email: result", {
          threads: result.threads.length,
          totalCount: result.totalCount,
          hasMore: result.hasMore,
          sidebarCounts: counts,
        });
        setAllFilteredThreads(result.threads);
        setTotalEmailCount(result.totalCount);
        setHasMoreEmails(result.hasMore);
        setCurrentPage(page);
        setSidebarCounts(counts);
      } catch (e) {
        console.error("[emails fetch] agent-email: error", e);
        setAllFilteredThreads([]);
        setTotalEmailCount(0);
        setHasMoreEmails(false);
      } finally {
        setIsLoadingEmails(false);
      }
    },
    [effectiveUser?.id]
  );

  useEffect(() => {
    if (isLoadingUser || !effectiveUser?.id) {
      if (!isLoadingUser) setIsLoadingEmails(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setIsTransitioning(true);
      setAllFilteredThreads([]);
      setTotalEmailCount(0);
      setCurrentPage(1);
      setHasMoreEmails(false);
      await fetchEmails(currentMailbox, activeCategory, 1);
      if (!cancelled) setTimeout(() => setIsTransitioning(false), 300);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [currentMailbox, activeCategory, fetchEmails, isLoadingUser, effectiveUser?.id]);

  // Update page title when unread count changes
  useEffect(() => {
    document.title = unreadCount > 0 ? `WALLS - Email (${unreadCount})` : "WALLS - Email";
  }, [unreadCount]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      setAllFilteredThreads([]);
      setCurrentPage(1);
      setTotalEmailCount(0);
      setHasMoreEmails(false);
      setThreadCache({});
      setSelectedThread(null);
      setSelectAllChecked(false);
      await new Promise((r) => setTimeout(r, 100));
      await fetchEmails(currentMailbox, activeCategory, 1, searchQuery);
    } catch (e) {
      console.error("Error refreshing emails:", e);
      wallsToast.error("Failed to refresh emails");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleNextPage = () => {
    if (isLoadingEmails || !hasMoreEmails) return;
    const nextPage = currentPage + 1;
    fetchEmails(currentMailbox, activeCategory, nextPage, searchQuery);
  };

  const handlePrevPage = () => {
    if (isLoadingEmails || currentPage <= 1) return;
    const prevPage = currentPage - 1;
    fetchEmails(currentMailbox, activeCategory, prevPage, searchQuery);
  };

  const handleMailboxChange = (mailbox: MailboxType) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchQuery("");
    setShowTasksView(false);
    setCurrentMailbox(mailbox);
    setActiveCategory("primary");
    setSelectedThread(null);
    setSelectAllChecked(false);
  };

  const handleCategoryChange = (category: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchQuery("");
    setActiveCategory(category);
    setSelectedThread(null);
    setSelectAllChecked(false);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      setAllFilteredThreads([]);
      setTotalEmailCount(0);
      setHasMoreEmails(false);
      fetchEmails(currentMailbox, activeCategory, 1, query);
    }, 400);
  };

  const handleComposeClick = () => {
    setShowEmailComposer(true);
  };

  const handleEmailSelect = useCallback(
    async (threadId: string) => {
      // Always show loading first so the preview layout (iframe height) is correct.
      // Skip the cache shortcut and fetch every time.
      setSelectedThread(null);
      setIsLoadingThread(true);
      try {
        const userId = effectiveUser?.id;
        if (!userId) {
          return;
        }
        const supabase = getSupabaseClient();
        const thread = await fetchThreadDetailFromSupabase(supabase, userId, threadId);
        if (thread) {
          setSelectedThread(thread);
          setThreadCache((c) => ({ ...c, [threadId]: thread }));
          setOptimisticReplies((prev) => prev.filter((r) => r.threadId !== threadId));
          setThreads((prev) =>
            prev.map((t) =>
              t.threadId === threadId && t.messagesCount !== thread.threadEmails?.length
                ? { ...t, messagesCount: thread.threadEmails?.length ?? t.messagesCount }
                : t
            )
          );
        } else {
          setSelectedThread(null);
        }
      } catch (e) {
        console.error("Error fetching thread:", e);
        setSelectedThread(null);
      } finally {
        setIsLoadingThread(false);
      }
    },
    [effectiveUser?.id]
  );

  // Handler for closing the preview
  const handleClosePreview = () => {
    setSelectedThread(null);
  };

  const handleThreadRemoved = useCallback((threadId: string) => {
    if (selectedThread?.threadId === threadId) {
      setSelectedThread(null);
    }
  }, [selectedThread?.threadId]);

  // Handle reply for a specific message in the thread (or fall back to the last message)
  const handleEmailReply = (threadId: string, replyAll?: boolean, message?: import('@/types/email.types').FullEmail) => {
    if (selectedThread && selectedThread.threadId === threadId) {
      handleReply(selectedThread, replyAll, message);
    }
  };

  // Add this new handler
  const handleThreadDataReceived = (thread: Thread) => {
    console.log('Thread data received:', thread);
    setThreadCache(prev => ({
      ...prev,
      [thread.id]: thread
    }));
  };

  // Optimistic reply: show sent message in thread immediately; clear when thread is refetched or on send error
  const handleSendReplyWithOptimistic = useCallback(
    async (data: ReplyData) => {
      const threadId = replyTo?.threadId;
      const afterMessageId = replyTo?.targetMessageId;
      const optimisticId = `optimistic-${Date.now()}`;
      if (threadId && afterMessageId) {
        const optimisticMessage: FullEmail = {
          id: optimisticId,
          threadId,
          from: userEmail,
          to: data.to,
          cc: data.cc ? [data.cc] : undefined,
          subject: data.subject,
          date: new Date().toISOString(),
          htmlContent: data.content,
          textContent: data.content.replace(/<[^>]*>/g, " ").trim(),
          snippet: data.content.replace(/<[^>]*>/g, " ").trim().slice(0, 120),
        };
        setOptimisticReplies((prev) => [
          ...prev,
          { threadId, afterMessageId, message: optimisticMessage },
        ]);
      }
      try {
        await handleSendReply(data);
      } catch (err) {
        setOptimisticReplies((prev) =>
          prev.filter((r) => r.message.id !== optimisticId)
        );
        throw err;
      }
    },
    [replyTo?.threadId, replyTo?.targetMessageId, handleSendReply, userEmail]
  );

  const handleEmailForward = (threadId: string, messageId: string) => {
    if (selectedThread && selectedThread.threadId === threadId) {
      const message = selectedThread.threadEmails?.find(e => e.id === messageId);
      handleForward(selectedThread, message);
    }
  };

  // Add handler for select all
  const handleSelectAllChange = (checked: boolean) => {
    setSelectAllChecked(checked);
  };

  return (
    <div className="h-screen fixed inset-x-0 flex overflow-hidden bg-transparent">
      <Sidebar
        currentMailbox={currentMailbox}
        onMailboxChange={handleMailboxChange}
        sidebarCounts={sidebarCounts}
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        onDraftSelect={handleDraftReply}
        onComposeClick={handleComposeClick}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        currentAccount={currentAccount}
        showTasksView={showTasksView}
        onTasksClick={() => setShowTasksView(true)}
        onAccountChange={async (email) => {
          setCurrentAccount(email);
          // Update effectiveUser when account changes
          const supabase = getSupabaseClient();
          const { data: userData } = await supabase
            .from("users")
            .select("id, email")
            .eq("email", email)
            .maybeSingle();
          if (userData) {
            setEffectiveUser({ email: userData.email, id: userData.id });
            // Reset state when switching accounts
            setShowTasksView(false);
            setSelectedThread(null);
            setSelectAllChecked(false);
            setThreadCache({});
            setAllFilteredThreads([]);
            setCurrentPage(1);
            setTotalEmailCount(0);
            setHasMoreEmails(false);
          }
        }}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userEmail={userEmail}
          delegates={[]}
          currentAccount={currentAccount}
          onAccountChange={setCurrentAccount}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          currentPage={currentPage}
          hasNextPage={hasMoreEmails}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          className="flex-none"
        />
        
        <div className="flex flex-col flex-1 min-w-0 h-full bg-neutral-50">
          <div className="flex-1 flex overflow-hidden min-h-0 rounded-tl-2xl rounded-bl-2xl">
            {/* Email list or Task list panel - shrinks when a thread is open (emails only) */}
            <div className={cn(
              "flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
              (selectedThread || isLoadingThread) ? "w-[380px]" : "w-full"
            )}>
              {showTasksView ? (
                <TaskList
                  userId={effectiveUser?.id}
                  onRefresh={() => {}}
                  onOpenThread={handleEmailSelect}
                />
              ) : (
                <EmailList
                  userEmail={userEmail}
                  userId={effectiveUser?.id}
                  mailbox={currentMailbox}
                  category={activeCategory}
                  onThreadSelect={handleEmailSelect}
                  onThreadRemoved={handleThreadRemoved}
                  selectedThreadId={selectedThread?.threadId}
                  onThreadDataReceived={handleThreadDataReceived}
                  threads={threads}
                  setThreads={setThreads}
                  forceRefresh={isRefreshing}
                  isLoading={isLoadingEmails}
                  isTransitioning={isTransitioning}
                  searchQuery={searchQuery}
                  selectAllChecked={selectAllChecked}
                  hasNextPage={hasMoreEmails}
                  totalEmailCount={totalEmailCount}
                  isLoadingMore={isLoadingMore}
                />
              )}
            </div>

            {/* Email preview panel - appears to the right when a thread is selected */}
            {(selectedThread || isLoadingThread) && (
              <div className="flex-1 overflow-hidden bg-[#eeeeee]">
                <EmailPreview
                  thread={selectedThread}
                  onClose={handleClosePreview}
                  onReply={handleEmailReply}
                  onForward={handleEmailForward}
                  currentUserEmail={userEmail}
                  isLoading={isLoadingThread}
                  replyTo={replyTo}
                  onSendReply={handleSendReplyWithOptimistic}
                  onClearReply={clearReply}
                  userId={effectiveUser?.id}
                  optimisticReplies={optimisticReplies}
                />
              </div>
            )}
          </div>
        </div>

        <EmailComposer 
          isOpen={showEmailComposer}
          onClose={() => setShowEmailComposer(false)}
        />
      </div>
    </div>
  );
}
