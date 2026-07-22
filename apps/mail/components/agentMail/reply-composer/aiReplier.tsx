"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, X, Pencil } from 'lucide-react';
import type { EditorRef } from '@/components/agentCRM/emailComposer/components/editor/editor';
import { Input } from '@/components/ui/borderless-input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSupabaseClient } from '@/app/auth/supabaseClient';
import { useAuth } from '@/app/auth/AuthContext';
import type { ReplyTo } from '@/types/email.types';
import {
  computeDiff,
  buildFinalHtml,
  buildTrackedChangesDisplayHtml,
  type DiffBlock,
  type Decision,
} from '@/components/ui/tracked-changes-modal';

const REPLY_GEN_MODELS = [
  { value: 'gpt-4o', provider: 'OpenAI', model: 'GPT-4o' },
  { value: 'gpt-4o-mini', provider: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'claude-sonnet-4-6', provider: 'Anthropic', model: 'Claude Sonnet' },
  { value: 'claude-opus-4-6', provider: 'Anthropic', model: 'Claude Opus' },
  { value: 'sonar-pro', provider: 'Perplexity', model: 'Sonar Pro' },
];

const THREAD_MESSAGE_LIMIT = 20;

interface AIReplierProps {
  editorRef: React.RefObject<EditorRef | null>;
  onChange: (content: string) => void;
  replyTo?: ReplyTo | null;
  /** Optional: pass when parent already has it (e.g. agent-email). If not set, we resolve from auth. */
  userId?: string | null;
}

/** Strip HTML to plain text for context (rough). */
function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ThreadContextResult {
  context: string;
  /** Internal UUID from email_threads — used by the API to look up talent info. */
  threadId: string;
}

/**
 * Fetch thread by provider_thread_id (Gmail thread id) and user_id, then last N messages
 * in chronological order for the prompt. All Supabase logic lives here.
 */
async function fetchThreadContextForReply(
  providerThreadId: string,
  userId: string
): Promise<ThreadContextResult | null> {
  const supabase = getSupabaseClient();

  const { data: threadRow, error: threadErr } = await supabase
    .from('email_threads')
    .select('id, subject')
    .eq('user_id', userId)
    .eq('provider_thread_id', providerThreadId)
    .maybeSingle();

  if (threadErr || !threadRow) return null;

  const { data: messages, error: msgErr } = await supabase
    .from('email_messages')
    .select('id, from, from_name, subject, snippet, received_at, created_at, html, text')
    .eq('thread_id', threadRow.id)
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(THREAD_MESSAGE_LIMIT);

  if (msgErr || !messages?.length) return null;

  const msgIds = messages.map((m) => m.id);
  const toByMessage = new Map<string, string[]>();
  const ccByMessage = new Map<string, string[]>();
  for (let i = 0; i < msgIds.length; i += 100) {
    const chunk = msgIds.slice(i, i + 100);
    const { data: recips } = await supabase
      .from('email_message_recipients')
      .select('message_id, recipient_type, email, name')
      .in('message_id', chunk);
    for (const r of recips ?? []) {
      const part = r.name ? `${r.name} <${r.email}>` : r.email;
      if (r.recipient_type === 'to') {
        const arr = toByMessage.get(r.message_id) ?? [];
        arr.push(part);
        toByMessage.set(r.message_id, arr);
      } else if (r.recipient_type === 'cc') {
        const arr = ccByMessage.get(r.message_id) ?? [];
        arr.push(part);
        ccByMessage.set(r.message_id, arr);
      }
    }
  }

  const subject = threadRow.subject ?? '';

  const chronological = [...messages].reverse();
  const lines: string[] = [`Subject: ${subject}`, ''];

  for (const m of chronological) {
    const from = m.from ?? '';
    const fromName = (m as { from_name?: string | null }).from_name?.trim();
    const fromDisplay = fromName ? `${fromName} <${from}>` : from;
    const toArr = toByMessage.get(m.id) ?? [];
    const ccArr = ccByMessage.get(m.id) ?? [];
    const toStr = toArr.length ? toArr.join(', ') : '';
    const ccStr = ccArr.length ? `Cc: ${ccArr.join(', ')}` : '';
    const date = m.received_at ?? m.created_at ?? '';
    const body = stripHtml(m.html ?? m.text ?? m.snippet ?? '').slice(0, 2000);
    lines.push(`From: ${fromDisplay}`);
    lines.push(`To: ${toStr}`);
    if (ccStr) lines.push(ccStr);
    lines.push(`Date: ${date}`);
    lines.push('');
    lines.push(body);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return { context: lines.join('\n').trim(), threadId: threadRow.id };
}

const popupIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";

const popupIconInnerClass =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";

function ReplyPopupContent({
  selectedModel,
  onModelChange,
  onClose,
  onSubmit,
  isGenerating,
  isEditMode,
}: {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClose: () => void;
  onSubmit: (angle: string) => void;
  isGenerating: boolean;
  isEditMode: boolean;
}) {
  const [angle, setAngle] = useState('');
  const current = REPLY_GEN_MODELS.find((m) => m.value === selectedModel) ?? REPLY_GEN_MODELS[0];

  const canSubmit = isEditMode ? angle.trim().length > 0 : true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(angle);
    setAngle('');
  };

  const placeholder = isEditMode
    ? "How would you like to edit this reply?"
    : "Optional: add an angle or focus for this reply";

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-4">
      <div>
        <div className="rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
          <Input
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full placeholder:text-neutral-300"
            disabled={isGenerating}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (canSubmit) {
                  onSubmit(angle);
                  setAngle('');
                }
              }
            }}
            autoFocus
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 pl-2">
        <Select value={selectedModel} onValueChange={onModelChange} disabled={isGenerating}>
          <SelectTrigger
            className="w-auto max-w-[160px] min-w-0 h-auto py-0 pl-0 pr-6 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors justify-start text-left [&>span:first-child]:min-w-0 [&>span:first-child]:text-left [&>span:first-child]:truncate [&>span:first-child]:block"
          >
            <SelectValue>{current.model}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl z-[250]" sideOffset={4}>
            {REPLY_GEN_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-sm">
                {m.model} <span className="text-neutral-600">({m.provider})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setAngle(''); onClose(); }}
            className={popupIconButtonClass}
            aria-label="Cancel"
          >
            <div className={popupIconInnerClass}>
              <X className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500 transition-colors" />
            </div>
          </button>
          <button
            type="submit"
            disabled={isGenerating || !canSubmit}
            className={popupIconButtonClass}
            aria-label={isEditMode ? 'Edit' : 'Generate'}
          >
            <div className={popupIconInnerClass}>
              {isEditMode
                ? <Pencil className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500 transition-colors" />
                : <Sparkles className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500 transition-colors" />}
            </div>
          </button>
        </div>
      </div>
    </form>
  );
}

export function AIReplier({
  editorRef,
  onChange,
  replyTo,
  userId: userIdProp,
}: AIReplierProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6');
  const [isEditMode, setIsEditMode] = useState(false);
  // Tracked-changes review state
  const [diffBlocks, setDiffBlocks] = useState<DiffBlock[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const reviewableBlocks = diffBlocks?.filter((b) => b.type !== 'unchanged') ?? [];
  const hasPendingReview = reviewableBlocks.some((b) => {
    const decision = decisions[b.id];
    return !decision || decision === 'pending';
  });
  const { user } = useAuth();
  const requestInProgress = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorHasContent = (): boolean =>
    (editorRef.current?.getEditor()?.getText()?.trim() ?? '').length > 0;

  // ── Tracked-changes helpers ──────────────────────────────────────────────

  const decisionsRef = useRef<Record<string, Decision>>(decisions);
  useEffect(() => { decisionsRef.current = decisions; }, [decisions]);
  const diffBlocksRef = useRef<DiffBlock[] | null>(diffBlocks);
  useEffect(() => { diffBlocksRef.current = diffBlocks; }, [diffBlocks]);

  // Event delegation for inline ✓/✗ buttons injected into the editor DOM
  useEffect(() => {
    if (!diffBlocks) return;
    const dom = editorRef.current?.getEditor()?.view.dom as HTMLElement | undefined;
    if (!dom) return;
    const handleClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-change-id]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-change-id');
      const action = btn.getAttribute('data-action');
      if (!id || !action) return;
      const blocks = diffBlocksRef.current;
      if (!blocks) return;
      const next: Record<string, Decision> = {
        ...decisionsRef.current,
        [id]: action === 'accept' ? 'accepted' : 'declined',
      };
      setDecisions(next);
      const editorDom = editorRef.current?.getEditor()?.view.dom as HTMLElement | undefined;
      if (editorDom) editorDom.innerHTML = buildTrackedChangesDisplayHtml(blocks, next);
    };
    dom.addEventListener('click', handleClick);
    return () => dom.removeEventListener('click', handleClick);
  }, [diffBlocks]); // eslint-disable-line react-hooks/exhaustive-deps

  // When all inline decisions are resolved, finalize and unlock editing automatically.
  useEffect(() => {
    if (!diffBlocks) return;
    if (reviewableBlocks.length === 0) return;
    if (hasPendingReview) return;

    const finalHtml = buildFinalHtml(diffBlocks, decisions);
    const editor = editorRef.current?.getEditor();
    if (editor) {
      editor.setEditable(true);
      editor.commands.setContent(finalHtml);
      onChange(finalHtml);
    }
    setDiffBlocks(null);
    setDecisions({});
    setShowPopover(false);
  }, [diffBlocks, reviewableBlocks.length, hasPendingReview, decisions, editorRef, onChange]);

  const getDelay = useCallback((prevChar: string) => {
    let delay = 0;
    if (['.', '!', '?'].includes(prevChar)) delay += 0.8 + Math.random() * 0.5;
    else if ([',', ':', ';'].includes(prevChar)) delay += 0.4 + Math.random() * 0.3;
    else if (prevChar === '\n') delay += 0.4 + Math.random() * 0.3;
    return delay;
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const typeContent = useCallback((content: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    onChange('');
    editorRef.current?.getEditor()?.commands.setContent('<p></p>');
    let index = 0;
    const typeChar = () => {
      const prev = index > 0 ? content[index - 1] : '';
      index += 1;
      const partial = content.slice(0, index);
      onChange(partial);
      editorRef.current?.getEditor()?.commands.setContent(partial);
      if (index <= content.length) {
        typingTimeoutRef.current = setTimeout(typeChar, index === 1 ? 2 : getDelay(prev));
      }
    };
    typingTimeoutRef.current = setTimeout(typeChar, 2);
  }, [editorRef, onChange, getDelay]);

  const resolveUserId = async (): Promise<string | null> => {
    if (userIdProp) return userIdProp;
    if (!user?.email) return null;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    return data?.id ?? null;
  };

  // ── AI edit (tracked changes) ────────────────────────────────────────────

  const editReplyWithAI = async (editInstructions: string) => {
    const currentHtml = editorRef.current?.getEditor()?.getHTML() ?? '';
    if (!currentHtml.trim()) return;

    try {
      setIsGenerating(true);
      requestInProgress.current = true;

      const response = await fetch('/api/walli/email-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentContent: currentHtml,
          editInstructions: editInstructions.trim(),
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data.content) throw new Error('Invalid response format from API');

      const blocks = computeDiff(currentHtml, data.content);
      const editableBlocks = blocks.filter((b) => b.type !== 'unchanged');

      if (editableBlocks.length === 0) {
        wallsToast.success("No Changes Detected", "The AI found nothing to change for those instructions.");
        return;
      }

      const initialDecisions: Record<string, Decision> = {};
      editableBlocks.forEach((b) => { initialDecisions[b.id] = 'pending'; });

      const editor = editorRef.current?.getEditor();
      if (editor) {
        editor.setEditable(false);
        (editor.view.dom as HTMLElement).innerHTML = buildTrackedChangesDisplayHtml(blocks, initialDecisions);
      }

      setDiffBlocks(blocks);
      setDecisions(initialDecisions);
    } catch (error) {
      console.error('[AIReplier] Error editing reply:', error);
      editorRef.current?.getEditor()?.setEditable(true);
      wallsToast.error("Edit Failed", error instanceof Error ? error.message : "Failed to edit reply content");
    } finally {
      setIsGenerating(false);
      requestInProgress.current = false;
    }
  };

  // ── Reply generation ─────────────────────────────────────────────────────

  const handleGenerateReply = async (optionalAngle: string) => {
    if (requestInProgress.current || isGenerating) return;

    if (!replyTo?.threadId) {
      wallsToast.error('Cannot generate reply', 'No thread is selected. Reply from a thread first.');
      return;
    }

    const uid = await resolveUserId();
    if (!uid) {
      wallsToast.error('Not signed in', 'Sign in to use AI reply.');
      return;
    }

    try {
      setIsGenerating(true);
      requestInProgress.current = true;

      const threadResult = await fetchThreadContextForReply(replyTo.threadId, uid);
      if (!threadResult) {
        wallsToast.error('Thread not found', 'Could not load thread messages. Try opening the thread again.');
        return;
      }

      const response = await fetch('/api/walli/reply-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadContext: threadResult.context,
          threadId: threadResult.threadId,
          replyTo: { to: replyTo.to, subject: replyTo.subject ?? '' },
          optionalAngle: (optionalAngle ?? '').trim(),
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.content) throw new Error('Empty response from API');

      typeContent(data.content);

      wallsToast.success('Reply generated', 'AI reply has been inserted into the composer.');
      setShowPopover(false);
    } catch (e) {
      console.error('[AIReplier]', e);
      wallsToast.error('Generation failed', e instanceof Error ? e.message : 'Could not generate reply');
    } finally {
      setIsGenerating(false);
      requestInProgress.current = false;
    }
  };

  return (
    <Popover
      open={diffBlocks ? false : showPopover}
      onOpenChange={(open) => {
        if (diffBlocks) return;
        if (open && !replyTo?.threadId) {
          wallsToast.error('No thread', 'Open a thread and click Reply to use AI reply.');
          return;
        }
        if (open) setIsEditMode(editorHasContent());
        setShowPopover(open);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0"
          disabled={isGenerating}
        >
          <div className="relative">
            <div className="relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
              {isGenerating ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin text-neutral-500" />
              ) : (
                <Sparkles className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
              )}
            </div>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={8}
        align="center"
        className="w-[400px] max-w-[calc(100vw-2rem)] p-4 bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl z-[200] rounded-[2rem]"
      >
        <ReplyPopupContent
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onClose={() => setShowPopover(false)}
          onSubmit={(angle) => {
            setShowPopover(false);
            if (isEditMode) {
              editReplyWithAI(angle);
            } else {
              handleGenerateReply(angle);
            }
          }}
          isGenerating={isGenerating}
          isEditMode={isEditMode}
        />
      </PopoverContent>
    </Popover>
  );
}
