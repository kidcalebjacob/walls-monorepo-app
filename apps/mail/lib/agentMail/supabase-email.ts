/**
 * Supabase-backed email fetches for agentMail.
 * Replaces Firestore emails collection with email_threads, email_messages,
 * email_message_labels, email_message_recipients.
 */

import type { Thread, FullEmail, EmailAttachment } from "@/types/email.types";
import type { MailboxType } from "@/types/email.types";
import { extractNameFromEmail } from "@/utils/format-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 50;
const MAX_THREADS = 1000;
/** PostgREST/Supabase IN (...) parameter limit; chunk queries to stay under it (safe < 800). */
const IN_CHUNK_SIZE = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface FetchThreadsResult {
  threads: Thread[];
  totalCount: number;
  hasMore: boolean;
}

function threadMatchesMailbox(
  labelIds: string[],
  mailbox: MailboxType,
  category: string,
  threadCategory?: string | null
): boolean {
  // Deals view: only threads linked to a deal (filter applied server-side)
  if (mailbox === "deals") return true;

  const normThreadCategory = threadCategory?.toLowerCase() ?? null;
  const normCategory = category.toLowerCase();

  // Prefer routing based on email_threads.category when present
  if (normThreadCategory) {
    if (mailbox === "inbox") {
      // Only show inbox-style categories in inbox
      const inboxCats = ["primary", "social", "socials", "promotions", "updates"];
      if (!inboxCats.includes(normThreadCategory)) return false;

      // Filter within inbox by active category tab (unopened = primary only, unread)
      if (normCategory === "unopened") return normThreadCategory === "primary";
      if (normCategory === "primary") return normThreadCategory === "primary";
      if (normCategory === "social" || normCategory === "socials") {
        return normThreadCategory === "social" || normThreadCategory === "socials";
      }
      if (normCategory === "promotions") return normThreadCategory === "promotions";
      if (normCategory === "updates") return normThreadCategory === "updates";

      // Fallback: if an unknown category tab is passed, still allow inbox categories
      return inboxCats.includes(normThreadCategory);
    }

    if (mailbox === "sent") return normThreadCategory === "sent";
    if (mailbox === "trash") return normThreadCategory === "trash";
    if (mailbox === "archive") {
      return normThreadCategory === "archived" || normThreadCategory === "archive";
    }

    // Starred/schedule fall back to label-based logic below
  }

  // Fallback: legacy Gmail-style label based routing
  if (mailbox === "inbox") {
    if (!labelIds.includes("INBOX") || labelIds.includes("TRASH")) return false;
    if (normCategory === "primary") {
      const hasOther = labelIds.some((l) =>
        ["CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES"].includes(l)
      );
      if (hasOther) return false;
    } else if (normCategory === "social" && !labelIds.includes("CATEGORY_SOCIAL")) return false;
    else if (normCategory === "promotions" && !labelIds.includes("CATEGORY_PROMOTIONS")) return false;
    else if (normCategory === "updates" && !labelIds.includes("CATEGORY_UPDATES")) return false;
  } else if (mailbox === "sent" && !labelIds.includes("SENT")) return false;
  else if (mailbox === "starred" && !labelIds.includes("STARRED")) return false;
  else if (mailbox === "trash" && !labelIds.includes("TRASH")) return false;
  else if (mailbox === "archive") {
    if (labelIds.includes("INBOX") || labelIds.includes("TRASH")) return false;
    const hasCat = labelIds.some((l) =>
      ["CATEGORY_PERSONAL", "CATEGORY_UPDATES", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"].includes(l)
    );
    if (!hasCat) return false;
  } else if (mailbox === "schedule" && !labelIds.includes("SCHEDULED")) return false;
  return true;
}

function threadMatchesMailboxForCount(labelIds: string[], mailbox: MailboxType): boolean {
  if (mailbox === "inbox") return labelIds.includes("INBOX") && !labelIds.includes("TRASH");
  if (mailbox === "sent") return labelIds.includes("SENT");
  if (mailbox === "starred") return labelIds.includes("STARRED");
  if (mailbox === "trash") return labelIds.includes("TRASH");
  if (mailbox === "archive") {
    return (
      (labelIds.includes("CATEGORY_PERSONAL") ||
        labelIds.includes("CATEGORY_UPDATES") ||
        labelIds.includes("CATEGORY_PROMOTIONS") ||
        labelIds.includes("CATEGORY_SOCIAL")) &&
      !labelIds.includes("INBOX") &&
      !labelIds.includes("TRASH")
    );
  }
  if (mailbox === "schedule") return labelIds.includes("SCHEDULED");
  return false;
}

type ThreadRow = {
  id: string;
  provider_thread_id: string | null;
  subject: string | null;
  last_message_at: string | null;
  user_id: string;
  deal_id: string | null;
  is_read: boolean | null;
  is_starred: boolean | null;
  latest_snippet: string | null;
  category: string | null;
};

const THREAD_SELECT =
  "id, provider_thread_id, subject, last_message_at, user_id, deal_id, is_read, is_starred, latest_snippet, category";

/** Apply server-side mailbox/category filter so we only fetch threads for the current view. */
function applyThreadMailboxFilter(
  query: any,
  mailbox: MailboxType,
  category: string
): any {
  const cat = category.toLowerCase();
  if (mailbox === "deals") return query.not("deal_id", "is", null);
  if (mailbox === "sent") return query.eq("category", "sent");
  if (mailbox === "trash") return query.eq("category", "trash");
  if (mailbox === "archive") return query.in("category", ["archived", "archive"]);
  if (mailbox === "schedule") return query.in("category", ["schedule", "scheduled"]);
  if (mailbox === "starred") return query.eq("is_starred", true);
  if (mailbox === "inbox") {
    if (cat === "unopened") {
      return query.eq("category", "primary").eq("is_read", false);
    }
    if (cat === "primary") return query.eq("category", "primary");
    if (cat === "social" || cat === "socials") return query.in("category", ["social", "socials"]);
    if (cat === "promotions") return query.eq("category", "promotions");
    if (cat === "updates") return query.eq("category", "updates");
    return query.in("category", ["primary", "social", "socials", "promotions", "updates"]);
  }
  return query;
}

export async function fetchThreadsFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  mailbox: MailboxType,
  category: string,
  page = 1,
  searchQuery?: string
): Promise<FetchThreadsResult> {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("email_threads")
    .select(THREAD_SELECT, { count: "exact" })
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  query = applyThreadMailboxFilter(query, mailbox, category);

  if (searchQuery?.trim()) {
    const term = searchQuery.trim();
    query = query.or(`subject.ilike.%${term}%,latest_snippet.ilike.%${term}%`);
  }

  const { data: threadsData, error: threadsError, count } = await query.range(from, to);

  if (threadsError) {
    console.warn("[emails fetch] fetchThreadsFromSupabase error:", threadsError.message, threadsError.code);
    return { threads: [], totalCount: 0, hasMore: false };
  }
  if (!threadsData?.length) {
    console.log("[emails fetch] fetchThreadsFromSupabase: no email_threads for user_id", userId);
    return { threads: [], totalCount: 0, hasMore: false };
  }

  const threadIds = threadsData.map((t) => t.id);

  const messageRows: Array<{
    id: string;
    thread_id: string | null;
    from: string | null;
    from_name: string | null;
    from_avatar_url: string | null;
    subject: string | null;
    snippet: string | null;
    created_at: string | null;
    received_at: string | null;
    provider_message_id: string | null;
    rfc_message_id: string | null;
    html: string | null;
    text: string | null;
  }> = [];
  for (const chunkIds of chunk(threadIds, IN_CHUNK_SIZE)) {
    const { data, error: messagesError } = await supabase
      .from("email_messages")
      .select("id, thread_id, from, from_name, from_avatar_url, subject, snippet, created_at, received_at, provider_message_id, rfc_message_id, html, text")
      .in("thread_id", chunkIds)
      .order("received_at", { ascending: false, nullsFirst: false });
    if (messagesError) {
      return { threads: [], totalCount: 0, hasMore: false };
    }
    if (data) messageRows.push(...data);
  }

  type MsgRow = (typeof messageRows)[0];
  const latestByThread = new Map<string, MsgRow>();
  const messagesByThread = new Map<string, MsgRow[]>();
  const countByThread = new Map<string, number>();
  const msgTime = (x: MsgRow) => new Date(x.received_at ?? x.created_at ?? 0).getTime();
  for (const m of messageRows) {
    if (!m.thread_id) continue;
    countByThread.set(m.thread_id, (countByThread.get(m.thread_id) ?? 0) + 1);
    const existing = latestByThread.get(m.thread_id);
    if (!existing || msgTime(m) > msgTime(existing)) latestByThread.set(m.thread_id, m);
    const arr = messagesByThread.get(m.thread_id) || [];
    arr.push(m);
    messagesByThread.set(m.thread_id, arr);
  }

  const msgIds = Array.from(latestByThread.values()).map((m) => m.id);
  const labelsByMessage = new Map<string, string[]>();
  for (const chunkIds of chunk(msgIds, IN_CHUNK_SIZE)) {
    const { data: labelsData } = await supabase
      .from("email_message_labels")
      .select("message_id, label")
      .in("message_id", chunkIds);
    for (const r of labelsData || []) {
      const arr = labelsByMessage.get(r.message_id) || [];
      arr.push(r.label);
      labelsByMessage.set(r.message_id, arr);
    }
  }

  const toByMessage = new Map<string, string>();
  for (const chunkIds of chunk(msgIds, IN_CHUNK_SIZE)) {
    const { data: recipientsData } = await supabase
      .from("email_message_recipients")
      .select("message_id, recipient_type, email, name")
      .in("message_id", chunkIds)
      .eq("recipient_type", "to");
    for (const r of recipientsData || []) {
      const part = r.name ? `${r.name} <${r.email}>` : r.email;
      const existing = toByMessage.get(r.message_id);
      toByMessage.set(r.message_id, existing ? `${existing}, ${part}` : part);
    }
  }

  const threads: Thread[] = [];
  for (const row of threadsData as ThreadRow[]) {
    const msg = latestByThread.get(row.id);
    if (!msg) continue;
    let labelIds = labelsByMessage.get(msg.id) || [];
    // Ensure STARRED is in labelIds when thread is starred in DB (persists across refresh)
    if (row.is_starred === true && !labelIds.includes("STARRED")) {
      labelIds = [...labelIds, "STARRED"];
    }
    if (!threadMatchesMailbox(labelIds, mailbox, category, row.category)) continue;

    // Use thread-level is_read for read state (softer query; no need to derive from messages)
    const threadUnread = row.is_read !== true;

    const threadId = row.provider_thread_id || row.id;
    const to = toByMessage.get(msg.id) || "";
    const from = msg.from || "";
    const fromName = msg.from_name?.trim() || extractNameFromEmail(from);

    threads.push({
      id: threadId,
      threadId,
      dealId: row.deal_id ?? undefined,
      subject: msg.subject || row.subject || "No Subject",
      snippet: row.latest_snippet ?? msg.snippet ?? "",
      lastMessageDate: (row.last_message_at ?? msg.received_at ?? msg.created_at)?.toString() || new Date().toISOString(),
      labelIds,
      unread: threadUnread,
      messagesCount: countByThread.get(row.id) ?? 1,
      participants: [
        fromName,
        ...to.split(",").map((s) => extractNameFromEmail(s.trim())),
      ],
      fromName: msg.from_name?.trim() || null,
      fromAvatarUrl: msg.from_avatar_url || null,
      from,
      to,
    });
  }

  threads.sort(
    (a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
  );

  const totalCount = count ?? threads.length;
  return {
    threads,
    totalCount,
    hasMore: totalCount > to + 1,
  };
}

export const THREADS_PAGE_SIZE = PAGE_SIZE;

/** Email row from `emails` table (sync-emails target). */
type EmailRow = {
  id: string;
  message_id: string;
  thread_id: string;
  label_ids: string[] | null;
  user_email: string;
  snippet: string | null;
  subject: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  date: string | null;
  timestamp: string | null;
  html_content: string | null;
  text_content: string | null;
  unread: boolean | null;
};

/**
 * Fetch thread list from `emails` table (sync-emails).
 * Use this when email_threads/email_messages are not populated.
 */
export async function fetchThreadsFromEmailsTable(
  supabase: SupabaseClient,
  userEmail: string,
  mailbox: MailboxType,
  category: string
): Promise<FetchThreadsResult> {
  // Deals view is only supported via email_threads (deal_id); emails table has no deal link
  if (mailbox === "deals") {
    return { threads: [], totalCount: 0, hasMore: false };
  }
  const { data: rows, error } = await supabase
    .from("emails")
    .select("id, message_id, thread_id, label_ids, user_email, snippet, subject, from, to, date, timestamp, unread")
    .eq("user_email", userEmail)
    .order("timestamp", { ascending: false })
    .limit(5000);

  if (error) {
    console.warn("[emails fetch] fetchThreadsFromEmailsTable error:", error.message, error.code);
    return { threads: [], totalCount: 0, hasMore: false };
  }
  if (!rows?.length) {
    console.log("[emails fetch] fetchThreadsFromEmailsTable: no rows for user_email", userEmail);
    return { threads: [], totalCount: 0, hasMore: false };
  }

  const latestByThread = new Map<string, EmailRow>();
  const countByThread = new Map<string, number>();
  for (const r of rows as EmailRow[]) {
    const tid = r.thread_id || r.id;
    countByThread.set(tid, (countByThread.get(tid) ?? 0) + 1);
    if (!latestByThread.has(tid)) latestByThread.set(tid, r);
  }

  const threads: Thread[] = [];
  Array.from(latestByThread.entries()).forEach(([threadId, row]) => {
    const labelIds = Array.isArray(row.label_ids) ? row.label_ids : [];
    if (!threadMatchesMailbox(labelIds, mailbox, category)) return;
    const from = row.from || "";
    const to = row.to || "";
    const lastDate = row.timestamp || row.date || new Date().toISOString();
    threads.push({
      id: threadId,
      threadId,
      subject: row.subject || "No Subject",
      snippet: row.snippet || "",
      lastMessageDate: lastDate,
      labelIds,
      unread: !!row.unread,
      messagesCount: countByThread.get(threadId) ?? 1,
      participants: [
        extractNameFromEmail(from),
        ...to.split(",").map((s) => extractNameFromEmail(s.trim())),
      ],
      from,
      to,
    });
  });

  threads.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
  if (rows.length > 0 && threads.length === 0) {
    console.log("[emails fetch] fetchThreadsFromEmailsTable: had rows but none matched mailbox/category", {
      userEmail,
      mailbox,
      category,
      rowCount: rows.length,
      uniqueThreads: latestByThread.size,
    });
  }
  return {
    threads,
    totalCount: threads.length,
    hasMore: threads.length > PAGE_SIZE,
  };
}

/**
 * Sidebar mailbox counts from `emails` table.
 */
export async function fetchSidebarCountsFromEmailsTable(
  supabase: SupabaseClient,
  userEmail: string
): Promise<Record<MailboxType, number>> {
  const { data: rows, error } = await supabase
    .from("emails")
    .select("thread_id, label_ids")
    .eq("user_email", userEmail)
    .order("timestamp", { ascending: false })
    .limit(5000);

  if (error || !rows?.length) {
    return { inbox: 0, starred: 0, sent: 0, archive: 0, trash: 0, schedule: 0, deals: 0 };
  }

  const latestByThread = new Map<string, string[]>();
  for (const r of rows as { thread_id: string; label_ids: string[] | null }[]) {
    const tid = r.thread_id || "";
    if (tid && !latestByThread.has(tid))
      latestByThread.set(tid, Array.isArray(r.label_ids) ? r.label_ids : []);
  }

  const counts: Record<MailboxType, number> = {
    inbox: 0,
    starred: 0,
    sent: 0,
    archive: 0,
    trash: 0,
    schedule: 0,
    deals: 0,
  };
  const mailboxes: MailboxType[] = ["inbox", "starred", "sent", "archive", "trash", "schedule"];
  Array.from(latestByThread.values()).forEach((labelIds) => {
    mailboxes.forEach((mb) => {
      if (threadMatchesMailboxForCount(labelIds, mb)) counts[mb]++;
    });
  });
  return counts;
}

/**
 * Thread detail (messages in thread) from `emails` table.
 */
export async function fetchThreadDetailFromEmailsTable(
  supabase: SupabaseClient,
  userEmail: string,
  threadId: string
): Promise<Thread | null> {
  const { data: rows, error } = await supabase
    .from("emails")
    .select("id, message_id, thread_id, label_ids, snippet, subject, from, to, cc, date, timestamp, html_content, text_content, unread")
    .eq("user_email", userEmail)
    .eq("thread_id", threadId)
    .order("timestamp", { ascending: true });

  if (error || !rows?.length) return null;

  const threadEmails: FullEmail[] = (rows as EmailRow[]).map((r) => {
    const toVal = r.to || "";
    const ccVal = r.cc || undefined;
    return {
      id: r.id || r.message_id,
      threadId: r.thread_id || r.id || r.message_id,
      messageId: r.message_id || r.id,
      subject: r.subject || "No Subject",
      snippet: r.snippet || "",
      date: r.timestamp || r.date || "",
      from: r.from || "",
      to: toVal,
      cc: ccVal,
      htmlContent: r.html_content || "",
      textContent: r.text_content || "",
      labelIds: Array.isArray(r.label_ids) ? r.label_ids : [],
      unread: !!r.unread,
    };
  });

  const last = threadEmails[threadEmails.length - 1];
  const toStr = typeof last.to === "string" ? last.to : (Array.isArray(last.to) ? last.to.join(", ") : "");
  const toParts = typeof last.to === "string" ? last.to.split(",").map((s) => s.trim()) : Array.isArray(last.to) ? last.to : [];
  const participantNames = toParts.map((e) => extractNameFromEmail(e));
  return {
    id: threadId,
    threadId,
    subject: last.subject,
    snippet: last.snippet,
    lastMessageDate: last.date,
    labelIds: last.labelIds,
    unread: !!last.unread,
    messagesCount: threadEmails.length,
    participants: [extractNameFromEmail(last.from), ...participantNames],
    from: last.from,
    to: toStr,
    htmlContent: last.htmlContent,
    textContent: last.textContent,
    threadEmails,
  };
}

export type SidebarCounts = Record<MailboxType, number> & { inboxUnread?: number };

export async function fetchSidebarCountsFromSupabase(
  supabase: SupabaseClient,
  userId: string
): Promise<SidebarCounts> {
  const { data: threadsData, error: threadsError } = await supabase
    .from("email_threads")
    .select("id, category, is_starred, is_read, deal_id")
    .eq("user_id", userId)
    .limit(MAX_THREADS);

  if (threadsError || !threadsData?.length) {
    return { inbox: 0, starred: 0, sent: 0, archive: 0, trash: 0, schedule: 0, deals: 0, inboxUnread: 0 };
  }

  const counts: SidebarCounts = {
    inbox: 0,
    starred: 0,
    sent: 0,
    archive: 0,
    trash: 0,
    schedule: 0,
    deals: 0,
    inboxUnread: 0,
  };

  const inboxCategories = ["primary", "social", "socials", "promotions", "updates"];

  for (const t of threadsData as { category: string | null; is_starred: boolean | null; is_read: boolean | null; deal_id: string | null }[]) {
    const cat = t.category?.toLowerCase() ?? "";

    if (inboxCategories.includes(cat)) {
      counts.inbox++;
      if (cat === "primary" && t.is_read !== true) counts.inboxUnread!++;
    }
    if (cat === "sent") counts.sent++;
    if (cat === "trash") counts.trash++;
    if (cat === "archived" || cat === "archive") counts.archive++;
    if (cat === "schedule" || cat === "scheduled") counts.schedule++;
    if (t.is_starred) counts.starred++;
    if (t.deal_id != null) counts.deals++;
  }

  return counts;
}

export async function fetchThreadDetailFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  threadIdOrProviderId: string
): Promise<Thread | null> {
  // Look up by provider_thread_id first (e.g. Gmail thread id from email list)
  let { data: threadRow, error: threadErr } = await supabase
    .from("email_threads")
    .select("id, provider_thread_id, subject, last_message_at, deal_id")
    .eq("user_id", userId)
    .eq("provider_thread_id", threadIdOrProviderId)
    .maybeSingle();

  // If not found, try by email_threads.id (e.g. task.thread_id from project_tasks)
  if ((threadErr || !threadRow) && threadIdOrProviderId) {
    const byId = await supabase
      .from("email_threads")
      .select("id, provider_thread_id, subject, last_message_at, deal_id")
      .eq("user_id", userId)
      .eq("id", threadIdOrProviderId)
      .maybeSingle();
    threadRow = byId.data;
    threadErr = byId.error;
  }

  if (threadErr || !threadRow) return null;

  const { data: messagesData, error: messagesError } = await supabase
    .from("email_messages")
    .select("id, from, from_name, from_avatar_url, subject, snippet, created_at, received_at, is_read, html, text, provider_message_id, rfc_message_id")
    .eq("thread_id", threadRow.id)
    .order("received_at", { ascending: true, nullsFirst: true });

  if (messagesError || !messagesData?.length) return null;

  const msgIds = messagesData.map((m) => m.id);
  const labelsByMessage = new Map<string, string[]>();
  for (const chunkIds of chunk(msgIds, IN_CHUNK_SIZE)) {
    const { data: labelsData } = await supabase
      .from("email_message_labels")
      .select("message_id, label")
      .in("message_id", chunkIds);
    for (const r of labelsData || []) {
      const arr = labelsByMessage.get(r.message_id) || [];
      arr.push(r.label);
      labelsByMessage.set(r.message_id, arr);
    }
  }

  const toByMessage = new Map<string, string[]>();
  const ccByMessage = new Map<string, string[]>();
  const bccByMessage = new Map<string, string[]>();
  for (const chunkIds of chunk(msgIds, IN_CHUNK_SIZE)) {
    const { data: recipientsData } = await supabase
      .from("email_message_recipients")
      .select("message_id, recipient_type, email, name")
      .in("message_id", chunkIds);
    for (const r of recipientsData || []) {
      const part = r.name ? `${r.name} <${r.email}>` : r.email;
      if (r.recipient_type === "to") {
        const arr = toByMessage.get(r.message_id) || [];
        arr.push(part);
        toByMessage.set(r.message_id, arr);
      } else if (r.recipient_type === "cc") {
        const arr = ccByMessage.get(r.message_id) || [];
        arr.push(part);
        ccByMessage.set(r.message_id, arr);
      } else if (r.recipient_type === "bcc") {
        const arr = bccByMessage.get(r.message_id) || [];
        arr.push(part);
        bccByMessage.set(r.message_id, arr);
      }
    }
  }

  // Fetch attachments for all messages in this thread
  const attachmentsByMessage = new Map<string, EmailAttachment[]>();
  for (const chunkIds of chunk(msgIds, IN_CHUNK_SIZE)) {
    const { data: attachmentsData } = await supabase
      .from("email_message_attachments")
      .select("id, message_id, provider_attachment_id, filename, mime_type, size_bytes, is_inline")
      .in("message_id", chunkIds)
      .eq("is_inline", false);
    for (const a of attachmentsData || []) {
      const att: EmailAttachment = {
        id: a.id,
        filename: a.filename,
        mimeType: a.mime_type,
        sizeBytes: a.size_bytes,
        isInline: a.is_inline ?? false,
        providerAttachmentId: a.provider_attachment_id,
      };
      const arr = attachmentsByMessage.get(a.message_id) || [];
      arr.push(att);
      attachmentsByMessage.set(a.message_id, arr);
    }
  }

  const threadEmails: FullEmail[] = messagesData.map((m) => {
    const toArr = toByMessage.get(m.id) || [];
    const ccArr = ccByMessage.get(m.id) || [];
    const bccArr = bccByMessage.get(m.id) || [];
    const to = toArr.length <= 1 ? toArr[0] || "" : toArr;
    const cc = ccArr.length === 0 ? undefined : ccArr.length === 1 ? ccArr[0] : ccArr;
    const bcc = bccArr.length === 0 ? undefined : bccArr.length === 1 ? bccArr[0] : bccArr;
    const messageId = m.rfc_message_id || m.provider_message_id || m.id;
    return {
      id: m.id,
      threadId: threadRow.provider_thread_id || threadRow.id,
      messageId,
      subject: m.subject || "No Subject",
      snippet: m.snippet || "",
      date: m.received_at ?? m.created_at ?? "",
      from: m.from || "",
      fromName: (m as { from_name?: string | null }).from_name?.trim() || null,
      fromAvatarUrl: (m as { from_avatar_url?: string | null }).from_avatar_url || null,
      to,
      cc: ccArr.length ? cc : undefined,
      bcc: bccArr.length ? bcc : undefined,
      htmlContent: m.html || "",
      textContent: m.text || "",
      labelIds: labelsByMessage.get(m.id) || [],
      unread: !m.is_read,
      attachments: attachmentsByMessage.get(m.id) || [],
    };
  });

  const last = threadEmails[threadEmails.length - 1];
  const lastMsg = messagesData[messagesData.length - 1];
  const lastFromName = (lastMsg as { from_name?: string | null }).from_name?.trim() || extractNameFromEmail(last.from);
  const threadId = threadRow.provider_thread_id || threadRow.id;
  const toStr = Array.isArray(last.to) ? last.to.join(", ") : last.to;

  const unreadMsgs = messagesData.filter((m) => !m.is_read);
  const threadUnread = unreadMsgs.length > 0;
  const oldestUnread = threadUnread
    ? unreadMsgs.reduce((a, b) => {
        const aTime = new Date(a.received_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.received_at ?? b.created_at ?? 0).getTime();
        return aTime < bTime ? a : b;
      })
    : null;
  const snippet = threadUnread && oldestUnread ? (oldestUnread.snippet || "") : (last.snippet || "");

  return {
    id: threadId,
    threadId,
    dealId: threadRow.deal_id ?? undefined,
    subject: last.subject,
    snippet,
    lastMessageDate: last.date,
    labelIds: last.labelIds,
    unread: threadUnread,
    messagesCount: threadEmails.length,
    participants: [
      lastFromName,
      ...(typeof last.to === "string" ? [extractNameFromEmail(last.to)] : (last.to || []).map((e) => extractNameFromEmail(e))),
    ],
    fromName: (lastMsg as { from_name?: string | null }).from_name?.trim() || null,
    fromAvatarUrl: (lastMsg as { from_avatar_url?: string | null }).from_avatar_url || null,
    from: last.from,
    to: toStr,
    htmlContent: last.htmlContent,
    textContent: last.textContent,
    threadEmails,
  };
}
