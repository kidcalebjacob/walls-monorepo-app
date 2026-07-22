"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ArrowRightToLine,
  Loader2,
  X,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { MailboxType, Draft } from '@/types/email.types';
import { formatDetailedDate } from '@/utils/format-utils';
import { SenderSearch } from "@/components/ui/searches/senderSearch/sender-search";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";

interface SidebarProps {
  currentMailbox: MailboxType;
  onMailboxChange: (mailbox: MailboxType) => void;
  sidebarCounts: Record<MailboxType, number> & { inboxUnread?: number };
  isExpanded: boolean;
  onToggle: () => void;
  onDraftSelect: (draft: Draft) => void;
  onComposeClick: () => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  currentAccount: string;
  onAccountChange: (account: string) => void;
  /** When true, Tasks view is active (main content shows task list). */
  showTasksView?: boolean;
  /** Called when user clicks the Tasks sidebar item. */
  onTasksClick?: () => void;
}

interface SidebarButtonProps {
  mailbox: MailboxType;
  label: string;
  isActive: boolean;
  count?: number;
  isExpanded: boolean;
  onClick: () => void;
  hasChevron?: boolean;
  isOpen?: boolean;
}

const INBOX_CATEGORIES = [
  { id: 'primary', label: 'Primary' },
  { id: 'social', label: 'Social' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'updates', label: 'Updates' },
];

const SidebarButton = ({
  label,
  isActive,
  count,
  isExpanded,
  onClick,
  hasChevron = false,
  isOpen = false,
}: SidebarButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 border transition-all duration-200 cursor-pointer w-full h-10 rounded-xl px-3 justify-start",
        isActive
          ? "bg-gray-50 border-[rgba(110,173,192,0.45)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)]"
          : "border-transparent hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border-neutral-200/50"
      )}
    >
      {isExpanded && (
        <span className={cn(
          "text-sm whitespace-nowrap flex-1 text-left",
          "text-neutral-500 font-light"
        )}>
          {label}
        </span>
      )}
      {isExpanded && count !== undefined && count > 0 && !hasChevron && (
        <span className={cn(
          "ml-auto text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
          "font-light text-neutral-500 bg-neutral-200/80"
        )}>
          {count}
        </span>
      )}
      {isExpanded && hasChevron && (
        isOpen ? (
          <Minus className="ml-auto h-3.5 w-3.5 text-neutral-400/70 transition-colors duration-200" />
        ) : (
          <Plus className="ml-auto h-3.5 w-3.5 text-neutral-400/70 transition-colors duration-200" />
        )
      )}
    </button>
  );
};

const DraftsList = ({
  drafts,
  onDraftSelect,
  onDraftDelete,
  isLoading,
  deletingDraftId
}: {
  drafts: Draft[];
  onDraftSelect: (draft: Draft) => void;
  onDraftDelete: (draftId: string) => Promise<void>;
  isLoading: boolean;
  deletingDraftId: string | null;
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center pt-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground pt-6">No drafts found</p>
    );
  }

  return (
    <div className="space-y-4 pt-6">
      {drafts.map((draft) => (
        <div
          key={draft.id}
          className="group relative p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
          onClick={() => onDraftSelect(draft)}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDraftDelete(draft.id);
                }}
                disabled={deletingDraftId === draft.id}
              >
                {deletingDraftId === draft.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-normal text-foreground truncate">{draft.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground truncate flex-shrink">
                      To: {draft.to}
                    </p>
                    <span className="text-muted-foreground flex-shrink-0">•</span>
                    <p className="text-sm text-muted-foreground flex-shrink-0">
                      {formatDetailedDate(draft.date)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {draft.message || draft.snippet}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function Sidebar({
  currentMailbox,
  onMailboxChange,
  sidebarCounts,
  isExpanded,
  onToggle,
  onDraftSelect,
  onComposeClick,
  activeCategory,
  onCategoryChange,
  currentAccount,
  onAccountChange,
  showTasksView = false,
  onTasksClick,
}: SidebarProps) {
  const { user } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const [senders, setSenders] = useState<Array<{ id: string; email: string; displayName: string; avatarUrl: string | null }>>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>("");

  // Fetch senders (email accounts) similar to sender-search.tsx
  useEffect(() => {
    const fetchSenders = async () => {
      try {
        const supabase = getSupabaseClient();
        
        // Fetch all team records to get user_ids
        const { data: teamData, error: teamError } = await supabase
          .from('team')
          .select('user_id')
          .not('user_id', 'is', null);
        
        if (teamError) {
          throw teamError;
        }
        
        if (!teamData || teamData.length === 0) {
          setSenders([]);
          return;
        }
        
        // Get all unique user_ids from team
        const uniqueUserIds = new Set(teamData
          .map(t => t.user_id)
          .filter(Boolean));
        const userIds = Array.from(uniqueUserIds) as string[];
        
        if (userIds.length === 0) {
          setSenders([]);
          return;
        }
        
        // Fetch Gmail connections for these users
        const { data: gmailConnections, error: connectionsError } = await supabase
          .from('user_connections')
          .select('user_id')
          .in('user_id', userIds)
          .eq('provider', 'google')
          .eq('service', 'gmail')
          .is('revoked_at', null);
        
        if (connectionsError) {
          console.error("Error fetching Gmail connections:", connectionsError);
        }
        
        // Get unique user IDs that have Gmail connections
        const usersWithGmail = new Set(
          (gmailConnections || []).map(c => c.user_id).filter(Boolean)
        );
        
        // Fetch all users data
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name, avatar_url, email')
          .in('id', userIds);
        
        if (usersError) {
          throw usersError;
        }
        
        // Map to sender format - only include users with Gmail
        const sendersData = (usersData || [])
          .filter(user => usersWithGmail.has(user.id))
          .map((user) => {
            const firstName = user.first_name || '';
            const lastName = user.last_name || '';
            const displayName = `${firstName} ${lastName}`.trim() || user.email || 'Unknown';
            
            return {
              id: user.id,
              displayName,
              email: user.email || "",
              avatarUrl: user.avatar_url,
            };
          });
        
        // Sort senders: current user first, then alphabetically
        const currentUserEmail = user?.email;
        sendersData.sort((a, b) => {
          if (a.email === currentUserEmail && b.email !== currentUserEmail) return -1;
          if (b.email === currentUserEmail && a.email !== currentUserEmail) return 1;
          return a.displayName.localeCompare(b.displayName);
        });
        
        setSenders(sendersData);
        
        // Set selected sender based on currentAccount
        const matchingSender = sendersData.find(s => s.email === currentAccount);
        if (matchingSender) {
          setSelectedSenderId(matchingSender.id);
        }
      } catch (error) {
        console.error("Error fetching senders:", error);
      }
    };

    fetchSenders();
  }, [currentAccount, user?.email]);

  // Update selected sender when currentAccount changes
  useEffect(() => {
    const matchingSender = senders.find(s => s.email === currentAccount);
    if (matchingSender) {
      setSelectedSenderId(matchingSender.id);
    }
  }, [currentAccount, senders]);

  const handleSenderChange = (senderId: string) => {
    const sender = senders.find(s => s.id === senderId);
    if (sender) {
      setSelectedSenderId(senderId);
      onAccountChange(sender.email);
    }
  };

  const fetchDrafts = async () => {
    try {
      setIsLoadingDrafts(true);
      const response = await fetch('/api/gmail/drafts');
      const data = await response.json();

      if (data.drafts) {
        setDrafts(data.drafts.map((draft: any) => ({
          id: draft.id,
          message: draft.message || draft.snippet,
          to: draft.to || 'No recipient',
          subject: draft.subject || '(No subject)',
          date: draft.date || new Date().toISOString(),
          threadId: draft.threadId,
          snippet: draft.snippet
        })));
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
      wallsToast.error("Error", "Failed to load drafts");
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const handleDraftDelete = async (draftId: string) => {
    try {
      setDeletingDraftId(draftId);
      const response = await fetch(`/api/gmail/drafts/${draftId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDrafts(prevDrafts => prevDrafts.filter(draft => draft.id !== draftId));
        wallsToast.negative("Success", "Draft deleted successfully");
      } else {
        throw new Error('Failed to delete draft');
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
      wallsToast.error("Error", "Failed to delete draft");
    } finally {
      setDeletingDraftId(null);
    }
  };

  return (
    <div className={cn(
      "h-screen top-0 touch-none transition-all duration-300 ease-in-out bg-gray-50",
      isExpanded ? "w-[240px]" : "w-16"
    )}>
      <nav className="flex flex-col h-full touch-none pt-3">
        {isExpanded && (
          <>
            <div className="flex-none flex items-center mb-8 px-2.5 overflow-visible gap-3">
              <div className="flex-1 min-w-0 mt-1.5">
                <SenderSearch
                  value={selectedSenderId}
                  onValueChange={handleSenderChange}
                  className="w-full"
                  showEmailInTrigger={false}
                />
              </div>
            </div>
          </>
        )}

        {isExpanded && (
          <>
            <div className="flex-none mb-4 px-2.5">
              <Button
                onClick={onComposeClick}
                variant="ghost"
                className="relative h-[52px] p-0 bg-transparent text-slate-600 hover:bg-transparent flex items-center justify-start shadow-none group rounded-xl w-[180px]"
              >
                <div
                  className={cn(
                    "relative z-10 h-full w-full flex items-center px-4 justify-start transition-all duration-300 ease-in-out",
                    "border-[0.5px] border-neutral-300/70 shadow-none",
                    "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-[0.98]",
                    "rounded-xl"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-kenoo-yellow shrink-0" />
                    <span className="text-sm font-light text-neutral-500 whitespace-nowrap">Compose</span>
                  </div>
                </div>
              </Button>
            </div>

            <div className="flex flex-col space-y-1 flex-1 min-h-0 px-2.5 py-3 overflow-y-auto">

              {/* New & To-Do - new main container */}
              <SidebarButton
                mailbox="inbox"
                label="New & To-Do"
                isActive={!showTasksView && currentMailbox === 'inbox' && activeCategory === 'unopened'}
                count={sidebarCounts?.inboxUnread ?? 0}
                isExpanded={isExpanded}
                onClick={() => {
                  onMailboxChange('inbox');
                  onCategoryChange('unopened');
                  setInboxExpanded(false);
                }}
              />

              {/* Inboxes: collapse/expand to show categories (no navigate on click when already in inbox) */}
              <SidebarButton
                mailbox="inbox"
                label="Inboxes"
                isActive={!showTasksView && ((currentMailbox === 'inbox' && activeCategory !== 'unopened') || currentMailbox === 'sent' || currentMailbox === 'schedule' || currentMailbox === 'trash')}
                isExpanded={isExpanded}
                onClick={() => {
                  const isInboxRelated = currentMailbox === 'inbox' || currentMailbox === 'sent' || currentMailbox === 'schedule' || currentMailbox === 'trash';
                  if (isInboxRelated) {
                    setInboxExpanded((prev) => !prev);
                  } else {
                    onMailboxChange('inbox');
                    setInboxExpanded(true);
                  }
                }}
                hasChevron={isExpanded}
                isOpen={inboxExpanded}
              />

              {/* Category sub-items — visible when Inbox row is expanded (filter via category tabs in main content) */}
              <AnimatePresence>
                {isExpanded && inboxExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="ml-5 overflow-hidden flex flex-col space-y-0.5 border-l border-neutral-200/70 pl-3 pr-1"
                  >
                    {INBOX_CATEGORIES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onMailboxChange('inbox');
                          onCategoryChange(id);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-sm transition-all duration-150 w-full text-left",
                          !showTasksView && currentMailbox === 'inbox' && activeCategory === id
                            ? "bg-gray-50 border border-[rgba(110,173,192,0.45)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)] text-neutral-500 font-light"
                            : "border border-transparent text-neutral-500 font-light hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border-neutral-200/50 hover:text-neutral-500"
                        )}
                      >
                        {label}
                      </button>
                    ))}

                    {/* All other items inside inbox dropdown */}
                    <button
                      type="button"
                      onClick={() => {
                        onMailboxChange('sent');
                        setInboxExpanded(true);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-sm transition-all duration-150 w-full text-left",
                        !showTasksView && currentMailbox === 'sent'
                          ? "bg-gray-50 border border-[rgba(110,173,192,0.45)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)] text-neutral-500 font-light"
                          : "border border-transparent text-neutral-500 font-light hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border-neutral-200/50 hover:text-neutral-500"
                      )}
                    >
                      Sent
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onMailboxChange('schedule');
                        setInboxExpanded(true);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-sm transition-all duration-150 w-full text-left",
                        !showTasksView && currentMailbox === 'schedule'
                          ? "bg-gray-50 border border-[rgba(110,173,192,0.45)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)] text-neutral-500 font-light"
                          : "border border-transparent text-neutral-500 font-light hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border-neutral-200/50 hover:text-neutral-500"
                      )}
                    >
                      Scheduled
                    </button>

                    {/* Drafts Sheet */}
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                      <SheetTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-sm transition-all duration-150 w-full text-left border border-transparent text-neutral-500 font-light hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border-neutral-200/50 hover:text-neutral-500"
                          onClick={() => {
                            fetchDrafts();
                            setIsSheetOpen(true);
                          }}
                        >
                          Drafts
                        </button>
                      </SheetTrigger>
                      <SheetContent
                        side="right"
                        className="w-[800px] sm:w-[800px] max-w-[90vw] sheet-override"
                        style={{ maxWidth: '800px' }}
                      >
                        <SheetHeader>
                          <SheetTitle className="text-2xl font-normal text-foreground">Drafts</SheetTitle>
                        </SheetHeader>
                        <DraftsList
                          drafts={drafts}
                          onDraftSelect={(draft) => {
                            onDraftSelect(draft);
                            setIsSheetOpen(false);
                          }}
                          onDraftDelete={handleDraftDelete}
                          isLoading={isLoadingDrafts}
                          deletingDraftId={deletingDraftId}
                        />
                      </SheetContent>
                    </Sheet>

                    <button
                      type="button"
                      onClick={() => {
                        onMailboxChange('trash');
                        setInboxExpanded(true);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-sm transition-all duration-150 w-full text-left",
                        !showTasksView && currentMailbox === 'trash'
                          ? "bg-gray-50 border border-[rgba(110,173,192,0.45)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(110,173,192,0.4),0_0_12px_rgba(110,173,192,0.4)] text-neutral-500 font-light"
                          : "border border-transparent text-neutral-500 font-light hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border-neutral-200/50 hover:text-neutral-500"
                      )}
                    >
                      Trash
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Deals - threads linked to deals */}
              <SidebarButton
                mailbox="deals"
                label="Deals"
                isActive={!showTasksView && currentMailbox === 'deals'}
                isExpanded={isExpanded}
                onClick={() => {
                  onMailboxChange('deals');
                }}
              />

              {/* Tasks - new main container */}
              <SidebarButton
                mailbox="inbox"
                label="Tasks"
                isActive={showTasksView === true}
                isExpanded={isExpanded}
                onClick={() => onTasksClick?.()}
              />

              {/* Starred - standalone menu item */}
              <SidebarButton
                mailbox="starred"
                label="Starred"
                isActive={!showTasksView && currentMailbox === 'starred'}
                isExpanded={isExpanded}
                onClick={() => {
                  onMailboxChange('starred');
                }}
              />

              {/* Archive - standalone menu item */}
              <SidebarButton
                mailbox="archive"
                label="Archive"
                isActive={!showTasksView && currentMailbox === 'archive'}
                isExpanded={isExpanded}
                onClick={() => {
                  onMailboxChange('archive');
                }}
              />
            </div>
          </>
        )}

        <div className="flex-none mt-auto py-3 px-2.5">
          <button
            type="button"
            onClick={onToggle}
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className="flex items-center gap-3 rounded-xl border border-transparent transition-all duration-200 cursor-pointer w-full h-10 px-3 justify-start text-sm font-light text-neutral-500 hover:bg-neutral-50 hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] hover:border-neutral-200/50 hover:text-neutral-500"
          >
            {!isExpanded && (
              <div className="w-full flex items-center justify-center">
                <ArrowRightToLine className="h-4 w-4 text-neutral-500" />
              </div>
            )}
            {isExpanded && (
              <span className="whitespace-nowrap flex-1 text-left">
                Collapse sidebar
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
