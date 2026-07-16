"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message, ApolloLead } from "../types";
import { MarkdownRenderer } from "./markdown-renderer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth, getSupabaseClient } from "@walls/auth";
import Image from "next/image";
import EmailComposer from "@/components/agentCRM/emailComposer/email-composer";
import { WallieEmailDraftCard } from "./wallie-email-draft-card";
import { emailDraftToComposerPrefill, extractEmailDraftIntro, type WallieEmailDraft } from "@/lib/wallie/email-draft";
import AddToSequencePopup from "@/components/agentCRM/ui/add-to-sequence-popup";
import { ShiningText } from "@/components/ui/shining-text";
import {
  WalliePeopleTable,
  type EnrichedPersonFromDb,
} from "./wallie-people-table";

interface DeepQueryChatProps {
  messages: Message[];
  isLoading: boolean;
  /** When set, shows "Searching the web...", "Finding contacts...", or "Thinking..." */
  loadingStatus?: 'searching' | 'people_search' | 'thinking' | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/** Placeholder in AI message content where the contacts table is rendered. Curly-brace format is unambiguous and easy for the model to output exactly; keep in sync with API prompt. */
const PEOPLE_CONTACT_TABLE_PLACEHOLDER = "{peopleContactTable}";

export function DeepQueryChat({ messages, isLoading, loadingStatus = null, setMessages }: DeepQueryChatProps) {
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  const lastUserScrollRef = useRef(0);
  const scrollThrottleMs = 150; // Only scroll every 150ms max
  const USER_SCROLL_COOLDOWN = 400; // ms cooldown after user scroll
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [enrichedIds, setEnrichedIds] = useState<Set<string>>(new Set());
  /** Apollo person IDs that already exist in public.people (show as enriched, like smart search) */
  const [alreadyEnrichedIds, setAlreadyEnrichedIds] = useState<Set<string>>(new Set());
  /** Full person records from DB keyed by apollo_person_id for enriched rows (name, photo, title, actions) */
  const [enrichedPeopleMap, setEnrichedPeopleMap] = useState<Record<string, EnrichedPersonFromDb>>({});
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(new Set());
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [emailComposerPersonId, setEmailComposerPersonId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [emailComposerPrefill, setEmailComposerPrefill] = useState<ReturnType<typeof emailDraftToComposerPrefill> | null>(null);
  const [isSequencePopupOpen, setIsSequencePopupOpen] = useState(false);
  const [sequencePopupPersonId, setSequencePopupPersonId] = useState<string | null>(null);
  const [sequencePopupPersonData, setSequencePopupPersonData] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
  } | null>(null);

  const handleEmailClick = (email: string, personId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedEmail(email);
    setEmailComposerPersonId(personId);
    setIsEmailComposerOpen(true);
  };

  const handleCloseEmailComposer = () => {
    setIsEmailComposerOpen(false);
    setSelectedEmail(null);
    setEmailComposerPersonId(null);
    setEmailComposerPrefill(null);
  };

  const handleEditWallieEmailDraft = (draft: WallieEmailDraft) => {
    const prefill = emailDraftToComposerPrefill(draft);
    const { to } = prefill;
    setEmailComposerPrefill(prefill);
    setSelectedEmail(to[0] ?? null);
    setEmailComposerPersonId(null);
    setIsEmailComposerOpen(true);
  };

  const handleAddToSequence = (
    personId: string,
    personData: { firstName?: string; lastName?: string; email?: string; company?: string },
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSequencePopupPersonId(personId);
    setSequencePopupPersonData(personData);
    setIsSequencePopupOpen(true);
  };

  const handleAddToSequenceSubmit = async (
    sequenceId: string,
    _personId: string,
    sequenceName?: string
  ) => {
    setIsSequencePopupOpen(false);
    setSequencePopupPersonId(null);
    setSequencePopupPersonData(null);
    wallsToast.success("Sequence activated", sequenceName);
  };

  const handleCloseSequencePopup = () => {
    setIsSequencePopupOpen(false);
    setSequencePopupPersonId(null);
    setSequencePopupPersonData(null);
  };

  const handleEnrichPerson = async (person: ApolloLead) => {
    if (!user?.id) {
      wallsToast.error("Enrichment failed", "You must be signed in to enrich.");
      return;
    }
    setEnrichingIds((prev) => new Set(prev).add(person.id));
    try {
      const res = await fetch("/api/apollo/custom/apollo-person-id-supabase-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        wallsToast.error("Enrichment failed", data.error || data.details || "Failed to sync person.");
        return;
      }
      if (data.success) {
        setEnrichedIds((prev) => new Set(prev).add(person.id));
        setAlreadyEnrichedIds((prev) => new Set(prev).add(person.id));
        try {
          const supabase = getSupabaseClient();
          const { data: row } = await supabase
            .from("people")
            .select(
              "id, apollo_person_id, first_name, last_name, title, photo_url, email, linkedin_url, company_name"
            )
            .eq("apollo_person_id", person.id)
            .maybeSingle();
          if (row?.apollo_person_id) {
            setEnrichedPeopleMap((prev) => ({
              ...prev,
              [row.apollo_person_id]: row as EnrichedPersonFromDb,
            }));
          }
        } catch (_) {}
        wallsToast.success(
          "Contact synced",
          data.message ||
            [person.firstName, person.lastName].filter(Boolean).join(" ") ||
            "Contact synced successfully"
        );
      } else {
        wallsToast.error("Enrichment failed", data.error || data.details || "Failed to sync person.");
      }
    } catch (e) {
      wallsToast.error("Enrichment failed", e instanceof Error ? e.message : "Network error");
    } finally {
      setEnrichingIds((prev) => {
        const s = new Set(prev);
        s.delete(person.id);
        return s;
      });
    }
  };

  // Fetch full person records from DB for Apollo IDs that appear in chat (so enriched rows use our data)
  useEffect(() => {
    const apolloIds = new Set<string>();
    for (const msg of messages) {
      if (msg.apolloPeople?.length) {
        for (const p of msg.apolloPeople) {
          if (p?.id) apolloIds.add(p.id);
        }
      }
    }
    if (apolloIds.size === 0) {
      // Only reset when there's actually something to clear. Allocating a fresh
      // Set/object on every `messages` change would re-render on every typing
      // tick and can trip React's "Maximum update depth exceeded" guard.
      setAlreadyEnrichedIds((prev) => (prev.size === 0 ? prev : new Set()));
      setEnrichedPeopleMap((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const check = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('people')
          .select('id, apollo_person_id, first_name, last_name, title, photo_url, email, linkedin_url, company_name')
          .in('apollo_person_id', Array.from(apolloIds));
        if (error) {
          console.warn('[Wallie] Failed to fetch existing people:', error);
          return;
        }
        const rows = (data ?? []) as EnrichedPersonFromDb[];
        const existing = new Set(rows.map((r) => r.apollo_person_id).filter(Boolean));
        const byApolloId: Record<string, EnrichedPersonFromDb> = {};
        for (const r of rows) {
          if (r.apollo_person_id) byApolloId[r.apollo_person_id] = r;
        }
        setAlreadyEnrichedIds(existing);
        setEnrichedPeopleMap(byApolloId);
      } catch (e) {
        console.warn('[Wallie] Error fetching existing people:', e);
      }
    };
    check();
  }, [messages]);

  // Fetch user avatar
  useEffect(() => {
    const fetchUserAvatar = async () => {
      if (user?.id) {
        try {
          const supabase = getSupabaseClient();
          const { data: userData, error } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
          
          if (!error && userData && userData.avatar_url) {
            setAvatarUrl(userData.avatar_url);
          }
        } catch (error) {
          console.error("Error fetching user avatar:", error);
        }
      }
    };

    fetchUserAvatar();
  }, [user?.id]);

  // Refs for typing animation (persists across renders)
  const typingIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;

  // Typing speed in characters per millisecond (~500 chars/sec). We advance by
  // elapsed time rather than one char per tick so the number of state updates is
  // bounded by the frame rate instead of the length of the text.
  const TYPING_CHARS_PER_MS = 0.5;
  // Interval between ticks (~one update per animation frame).
  const TYPING_TICK_MS = 16;

  // Start typing function (called once per new message)
  const startTyping = useCallback((messageId: string, fullText: string) => {
    let index = 0;
    let lastTick =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const typeNextChar = () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = now - lastTick;
      lastTick = now;

      // Reveal however many characters "should" have appeared since the last
      // tick (at least one), then batch them into a single state update.
      const advance = Math.max(1, Math.round(elapsed * TYPING_CHARS_PER_MS));
      index = Math.min(fullText.length, index + advance);

      const isDone = index >= fullText.length;

      setMessagesRef.current(prev =>
        prev.map(m =>
          m.id === messageId
            ? {
                ...m,
                renderedContent: fullText.slice(0, index),
                isTyping: !isDone,
              }
            : m
        )
      );

      if (!isDone) {
        typingTimeoutRef.current = setTimeout(typeNextChar, TYPING_TICK_MS);
      } else {
        typingIdRef.current = null;
      }
    };

    // Start typing
    typingTimeoutRef.current = setTimeout(typeNextChar, TYPING_TICK_MS);
  }, []);

  // Detect when a new message needs typing (only triggers on NEW typing messages)
  useEffect(() => {
    const typingMessage = messages.find(
      m => m.sender === "ai" && m.isTyping
    );

    // No message to type, or already typing this one
    if (!typingMessage || typingIdRef.current === typingMessage.id) {
      return;
    }

    // New message to type!
    if (typingMessage.emailDraft) {
      typingIdRef.current = typingMessage.id;
      const intro = extractEmailDraftIntro(
        typingMessage.content,
        typingMessage.emailDraft
      );
      if (!intro) {
        setMessagesRef.current((prev) =>
          prev.map((m) =>
            m.id === typingMessage.id ? { ...m, renderedContent: "", isTyping: false } : m
          )
        );
        return;
      }
      startTyping(typingMessage.id, intro);
      return;
    }

    typingIdRef.current = typingMessage.id;
    startTyping(typingMessage.id, typingMessage.content);
  }, [messages, startTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Track scroll direction to determine if we should auto-scroll (only for user-initiated scrolls)
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    );

    if (!viewport) return;

    let lastScrollTop = viewport.scrollTop;
    let scrollStoppedTimeout: NodeJS.Timeout | null = null;

    const onScroll = () => {
      // Ignore programmatic scrolls
      if (isProgrammaticScrollRef.current) return;

      // Mark this as a user scroll for cooldown
      lastUserScrollRef.current = Date.now();

      const currentScrollTop = viewport.scrollTop;
      const scrollingUp = currentScrollTop < lastScrollTop;

      const distanceFromBottom =
        viewport.scrollHeight - currentScrollTop - viewport.clientHeight;

      // If user scrolls up at all → disable auto-scroll immediately
      if (scrollingUp && distanceFromBottom > 20) {
        shouldAutoScrollRef.current = false;
      }

      // Clear any pending scroll-stopped check
      if (scrollStoppedTimeout) {
        clearTimeout(scrollStoppedTimeout);
      }

      // Wait for scroll to fully stop, then check if we're at bottom
      scrollStoppedTimeout = setTimeout(() => {
        const finalDistanceFromBottom =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        
        if (finalDistanceFromBottom < 10) {
          shouldAutoScrollRef.current = true;
        }
      }, 150); // Wait 150ms after last scroll event

      lastScrollTop = currentScrollTop;
    };

    viewport.addEventListener("scroll", onScroll);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (scrollStoppedTimeout) clearTimeout(scrollStoppedTimeout);
    };
  }, []);

  // Auto-scroll to bottom when messages change (throttled to reduce stutter)
  useLayoutEffect(() => {
    if (!shouldAutoScrollRef.current || !bottomRef.current) return;

    const now = Date.now();

    // Do not auto-scroll shortly after user scroll (prevents fighting)
    if (now - lastUserScrollRef.current < USER_SCROLL_COOLDOWN) return;

    // Throttle scroll frequency
    if (now - lastScrollTimeRef.current < scrollThrottleMs) return;
    lastScrollTimeRef.current = now;

    // Mark as programmatic scroll to ignore in scroll listener
    isProgrammaticScrollRef.current = true;

    bottomRef.current.scrollIntoView({
      behavior: "auto",
      block: "end",
    });

    // Reset after a frame to allow scroll listener to work for user scrolls
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, [messages]);

  return (
    <>
    <ScrollArea className="h-full w-full px-4" ref={scrollAreaRef}>
      <div className="space-y-8 max-w-4xl mx-auto pt-10 pb-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.sender === 'user' ? (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="bg-gray-50 backdrop-blur-md border border-neutral-200/50 rounded-[25px] px-4 py-3">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-900">
                    {message.content}
                  </p>
                </div>
                <Avatar className="h-8 w-8 flex-shrink-0 mt-2">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="User" />
                  ) : null}
                  <AvatarFallback className="bg-transparent p-0">
                    <Image
                      src={FALLBACK_ICON_URL}
                      alt="User"
                      width={32}
                      height={32}
                      className="rounded-full object-cover aspect-square"
                    />
                  </AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="w-full space-y-4">
                {((): ReactNode => {
                  const text = (message.isTyping ? message.renderedContent : message.content) ?? "";
                  const hasPlaceholder = text.includes(PEOPLE_CONTACT_TABLE_PLACEHOLDER);
                  const showEmailDraft = !!message.emailDraft && !message.isTyping;
                  const showTable = message.apolloPeople && message.apolloPeople.length > 0 && !message.isTyping;
                  const introMarkdown =
                    showEmailDraft && message.emailDraft
                      ? extractEmailDraftIntro(message.content, message.emailDraft)
                      : message.emailDraft && message.isTyping
                        ? (message.renderedContent ?? "")
                        : text;
                  const tableBlock = showTable ? (
                    <WalliePeopleTable
                      people={message.apolloPeople ?? []}
                      enrichedPeopleMap={enrichedPeopleMap}
                      enrichedIds={enrichedIds}
                      alreadyEnrichedIds={alreadyEnrichedIds}
                      enrichingIds={enrichingIds}
                      imageErrorIds={imageErrorIds}
                      onImageError={(personId) =>
                        setImageErrorIds((prev) => new Set(prev).add(personId))
                      }
                      onEnrich={handleEnrichPerson}
                      onEmailClick={handleEmailClick}
                      onAddToSequence={handleAddToSequence}
                    />
                  ) : null;
                  if (hasPlaceholder && showTable) {
                    const parts = introMarkdown.split(PEOPLE_CONTACT_TABLE_PLACEHOLDER);
                    const before = parts[0];
                    const after = parts.slice(1).join(PEOPLE_CONTACT_TABLE_PLACEHOLDER);
                    return (
                      <>
                        {before.trim() && (
                          <MarkdownRenderer content={before} className="text-sm leading-relaxed text-gray-900" />
                        )}
                        {tableBlock}
                        {after.trim() && (
                          <MarkdownRenderer content={after} className="text-sm leading-relaxed text-gray-900" />
                        )}
                        {showEmailDraft && message.emailDraft && (
                          <WallieEmailDraftCard
                            draft={message.emailDraft}
                            onEditSend={handleEditWallieEmailDraft}
                            className="mt-4"
                          />
                        )}
                      </>
                    );
                  }
                  if (showTable) {
                    return (
                      <>
                        {introMarkdown.trim() && (
                          <MarkdownRenderer content={introMarkdown} className="text-sm leading-relaxed text-gray-900" />
                        )}
                        {tableBlock}
                        {showEmailDraft && message.emailDraft && (
                          <WallieEmailDraftCard
                            draft={message.emailDraft}
                            onEditSend={handleEditWallieEmailDraft}
                            className="mt-4"
                          />
                        )}
                      </>
                    );
                  }
                  if (message.emailDraft && (showEmailDraft || message.isTyping)) {
                    return (
                      <>
                        {introMarkdown.trim() && (
                          <MarkdownRenderer
                            content={introMarkdown}
                            className="text-sm leading-relaxed text-gray-900"
                          />
                        )}
                        {showEmailDraft && (
                          <WallieEmailDraftCard
                            draft={message.emailDraft}
                            onEditSend={handleEditWallieEmailDraft}
                            className={introMarkdown.trim() ? "mt-4" : undefined}
                          />
                        )}
                      </>
                    );
                  }
                  return (
                    <MarkdownRenderer content={hasPlaceholder ? introMarkdown.replaceAll(PEOPLE_CONTACT_TABLE_PLACEHOLDER, "").trim() : introMarkdown} className="text-sm leading-relaxed text-gray-900" />
                  );
                })()}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-kenoo-yellow animate-pulse flex-shrink-0"
              aria-hidden
            />
            <ShiningText
              text={
                loadingStatus === "searching"
                  ? "Wallie is searching the web..."
                  : loadingStatus === "people_search"
                    ? "Wallie is finding contacts..."
                    : "Wallie is thinking..."
              }
              className="text-sm"
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>

    <EmailComposer
      isOpen={isEmailComposerOpen}
      onClose={handleCloseEmailComposer}
      personId={emailComposerPersonId ?? undefined}
      prefill={emailComposerPrefill ?? undefined}
      replyTo={
        emailComposerPrefill
          ? {
              to: emailComposerPrefill.to[0] ?? "",
              cc: emailComposerPrefill.cc[0],
              bcc: emailComposerPrefill.bcc[0],
              subject: emailComposerPrefill.subject,
              threadId: emailComposerPrefill.threadId ?? undefined,
              messageId: emailComposerPrefill.draftId,
              draftId: emailComposerPrefill.draftId,
            }
          : selectedEmail
            ? { to: selectedEmail }
            : undefined
      }
    />

    {sequencePopupPersonId && sequencePopupPersonData && (
      <AddToSequencePopup
        isOpen={isSequencePopupOpen}
        onClose={handleCloseSequencePopup}
        personId={sequencePopupPersonId}
        personData={sequencePopupPersonData}
        onAddToSequence={handleAddToSequenceSubmit}
      />
    )}
  </>
  );
}
