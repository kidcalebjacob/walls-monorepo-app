"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, X, Pencil } from "lucide-react";
import { EditorRef } from '../editor';
import {
  collection,
  query,
  where,
  getDocs,
  getFirestore
} from 'firebase/firestore';
import { Input } from '@/components/ui/borderless-input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AITemplatePopup } from '@/components/ui/ai-template-popup';
import {
  computeDiff,
  buildFinalHtml,
  buildTrackedChangesDisplayHtml,
  type DiffBlock,
  type Decision,
} from '@/components/ui/tracked-changes-modal';
import { getSupabaseClient } from '@/app/auth/supabaseClient';
import type { SelectedCreatorSummary } from './pitchTracker';

/** Talent context item sent to email-gen (match route TalentContextItem). */
interface TalentContextItem {
  type: 'talent';
  id: string;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  bio_short?: string | null;
  category?: string | null;
  slug?: string | null;
  rates?: { channel: string; deliverable: string; currency: string; rate: number }[];
}

/** Same model list as Wallie chat for email-gen multi-select */
const EMAIL_GEN_AI_MODELS = [
  { value: "gpt-4o", provider: "OpenAI", model: "GPT-4o" },
  { value: "gpt-4o-mini", provider: "OpenAI", model: "GPT-4o Mini" },
  { value: "claude-sonnet-4-6", provider: "Anthropic", model: "Claude Sonnet" },
  { value: "claude-opus-4-6", provider: "Anthropic", model: "Claude Opus" },
  { value: "sonar-pro", provider: "Perplexity", model: "Sonar Pro" },
  { value: "sonar-deep-research", provider: "Perplexity", model: "Sonar Deep Research" },
];

interface AIWriterToolProps {
  onChange: (content: string) => void;
  onSubjectChange: (subject: string) => void;
  editorRef: React.RefObject<EditorRef>;
  recipientEmails: string[];
  selectedCreators: SelectedCreatorSummary[];
  onGeneratingChange?: (generating: boolean) => void;
  onAIGenerationComplete?: (result: { subject: string; content: string }) => void;
  isFollowUpTab?: boolean;
  firstEmailContent?: string;
  isTalentOutreach?: boolean;
  outreachPersonId?: string | null;
  outreachRecipientFirstNameFallback?: string | null;
}

interface CreatorInfo {
  name: string;
  bio: string;
  emailExample?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  templateType: string;
  lastModified: string;
}

// ─── Popup content components ─────────────────────────────────────────────────

const popupIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";

const popupIconInnerClass =
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";

interface PersonalInfoPopupContentProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClose: () => void;
  onSubmit: (info: string) => void;
  hasTaggedTalent: boolean;
  isFollowUpMode?: boolean;
  hasFirstEmail?: boolean;
  isTalentOutreach?: boolean;
  isEditMode?: boolean;
  personalInfo: string;
  onPersonalInfoChange: (info: string) => void;
}

function PersonalInfoPopupContent({
  selectedModel,
  onModelChange,
  onClose,
  onSubmit,
  hasTaggedTalent,
  isFollowUpMode = false,
  hasFirstEmail = false,
  isTalentOutreach = false,
  isEditMode = false,
  personalInfo,
  onPersonalInfoChange,
}: PersonalInfoPopupContentProps) {
  const current = EMAIL_GEN_AI_MODELS.find((m) => m.value === selectedModel) ?? EMAIL_GEN_AI_MODELS[0];

  const canGenerate = isEditMode
    ? (personalInfo ?? '').trim().length > 0
    : isFollowUpMode
      ? hasFirstEmail || (personalInfo ?? '').trim().length > 0
      : isTalentOutreach || hasTaggedTalent || (personalInfo ?? '').trim().length > 0;

  const handleConfirm = () => {
    if (!canGenerate) return;
    onSubmit(personalInfo);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate) return;
    handleConfirm();
  };

  const placeholder = isEditMode
    ? "How would you like to edit this email?"
    : isFollowUpMode
      ? "Optional: add any angle for this follow-up"
      : isTalentOutreach
        ? "Optional: add any extra context (e.g. specific collab idea)"
        : "Add additional content";

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-4">
      <div>
        <div className="rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
          <div className="relative w-full flex items-center">
            <Input
              value={personalInfo}
              onChange={(e) => onPersonalInfoChange(e.target.value)}
              placeholder={placeholder}
              className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full placeholder:text-neutral-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canGenerate) handleConfirm();
                }
              }}
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 pl-2">
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger className="w-auto max-w-[160px] min-w-0 h-auto py-0 pl-0 pr-6 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors justify-start text-left [&>span:first-child]:min-w-0 [&>span:first-child]:text-left [&>span:first-child]:truncate [&>span:first-child]:block">
            <SelectValue>{current.model}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl z-[250]" sideOffset={4}>
            {EMAIL_GEN_AI_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-sm">
                {m.model} <span className="text-neutral-600">({m.provider})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { onPersonalInfoChange(''); onClose(); }}
            className={popupIconButtonClass}
            aria-label="Cancel"
          >
            <div className={popupIconInnerClass}>
              <X className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500 transition-colors" />
            </div>
          </button>
          <button
            type="submit"
            disabled={!canGenerate}
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

// ─── Main component ───────────────────────────────────────────────────────────

export function AIWriterTool({
  onChange,
  onSubjectChange,
  editorRef,
  recipientEmails,
  selectedCreators,
  onGeneratingChange,
  onAIGenerationComplete,
  isFollowUpTab = false,
  firstEmailContent = '',
  isTalentOutreach = false,
  outreachPersonId = null,
  outreachRecipientFirstNameFallback = null,
}: AIWriterToolProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [personalInfo, setPersonalInfo] = useState('');
  const requestInProgress = useRef(false);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-6');
  const [isEditMode, setIsEditMode] = useState(false);
  // Tracked-changes review state
  const [diffBlocks, setDiffBlocks] = useState<DiffBlock[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const reviewableBlocks = diffBlocks?.filter((b) => b.type !== 'unchanged') ?? [];
  const hasPendingReview = reviewableBlocks.some((b) => {
    const decision = decisions[b.id];
    return !decision || decision === 'pending';
  });

  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  const editorHasContent = (): boolean =>
    (editorRef.current?.getEditor()?.getText()?.trim() ?? '').length > 0;

  // ── Tracked-changes helpers ──────────────────────────────────────────────

  // Refs so the DOM click listener always sees current state without stale closures
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
    setShowPersonalInfo(false);
  }, [diffBlocks, reviewableBlocks.length, hasPendingReview, decisions, editorRef, onChange]);

  // ── Firestore helpers ────────────────────────────────────────────────────

  const getFirestoreData = async (email: string) => {
    try {
      const db = getFirestore();
      let recipientDoc;
      let companyName;
      let firstName;

      const leadsRef = collection(db, 'leads');
      const leadsQuery = query(leadsRef, where('email', '==', email));
      let recipientDocs = await getDocs(leadsQuery);

      if (recipientDocs.empty) {
        const contactsRef = collection(db, 'contacts');
        const contactsQuery = query(contactsRef, where('email', '==', email));
        recipientDocs = await getDocs(contactsQuery);
      }

      if (recipientDocs.empty) {
        const scoutersRef = collection(db, 'scouter');
        const scoutersQuery = query(scoutersRef, where('personalEmail', '==', email));
        recipientDocs = await getDocs(scoutersQuery);

        if (!recipientDocs.empty) {
          recipientDoc = recipientDocs.docs[0].data();
          firstName = recipientDoc.creatorAlias || '';
          return { companyData: null, recipientData: { firstName, email } };
        }
      }

      if (!recipientDocs.empty) {
        recipientDoc = recipientDocs.docs[0].data();
        firstName = recipientDoc.firstName || '';
        companyName = recipientDoc.company;
      } else {
        return null;
      }

      let companyData = null;
      if (companyName) {
        const companiesRef = collection(db, 'companies');
        const companiesQuery = query(companiesRef, where('name', '==', companyName));
        const companyDocs = await getDocs(companiesQuery);
        if (!companyDocs.empty) companyData = companyDocs.docs[0].data();
      }

      return {
        companyData: companyData ? { name: companyData.name, overview: companyData.overview } : null,
        recipientData: { firstName, email },
      };
    } catch (error) {
      console.error('AIWriterTool - Error getting Firestore data:', error);
      return null;
    }
  };

  const fetchTalentContext = async (creatorIds: string[]): Promise<TalentContextItem[]> => {
    if (!creatorIds.length) return [];
    try {
      const supabase = getSupabaseClient();
      const { data: talentData, error: talentError } = await supabase
        .from('talent')
        .select('id, first_name, last_name, country, bio_short, profile_id, slug')
        .in('id', creatorIds);

      if (talentError || !talentData?.length) return [];

      const profileIds = talentData.map((t: { profile_id?: string }) => t.profile_id).filter(Boolean) as string[];
      let categoryByProfileId: Record<string, string | null> = {};
      if (profileIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, category_id, profile_categories!profiles_category_id_fkey(name)')
          .in('id', profileIds);
        if (profileData) {
          profileData.forEach((p) => {
            const raw = p.profile_categories as { name?: string } | { name?: string }[] | null | undefined;
            const name = Array.isArray(raw) ? raw[0]?.name : raw?.name;
            categoryByProfileId[p.id] = name ?? null;
          });
        }
      }

      const { data: ratesData } = await supabase
        .from('talent_rates')
        .select('talent_id, channel, deliverable, currency, rate')
        .in('talent_id', creatorIds);

      const ratesByTalentId: Record<string, { channel: string; deliverable: string; currency: string; rate: number }[]> = {};
      if (ratesData?.length) {
        ratesData.forEach((r: { talent_id: string; channel: string; deliverable: string; currency: string; rate: number }) => {
          if (!ratesByTalentId[r.talent_id]) ratesByTalentId[r.talent_id] = [];
          ratesByTalentId[r.talent_id].push({ channel: r.channel, deliverable: r.deliverable, currency: r.currency, rate: Number(r.rate) });
        });
      }

      return talentData.map((t: { id: string; first_name?: string | null; last_name?: string | null; country?: string | null; bio_short?: string | null; profile_id?: string | null; slug?: string | null }) => {
        const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown';
        return {
          type: 'talent' as const,
          id: t.id, name,
          first_name: t.first_name ?? null, last_name: t.last_name ?? null,
          country: t.country ?? null, bio_short: t.bio_short ?? null,
          category: t.profile_id ? (categoryByProfileId[t.profile_id] ?? null) : null,
          slug: t.slug ?? null,
          rates: ratesByTalentId[t.id] ?? [],
        };
      });
    } catch (err) {
      console.error('AIWriterTool - Error fetching talent context:', err);
      return [];
    }
  };

  // ── AI edit (tracked changes) ────────────────────────────────────────────

  const editEmailWithAI = async (editInstructions: string) => {
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
      console.error('AIWriterTool - Error editing email:', error);
      editorRef.current?.getEditor()?.setEditable(true);
      wallsToast.error("Edit Failed", error instanceof Error ? error.message : "Failed to edit email content");
    } finally {
      setIsGenerating(false);
      requestInProgress.current = false;
    }
  };

  // ── Email generation ─────────────────────────────────────────────────────

  const generateEmailWithTemplate = async (personalInfo: string) => {
    const hasTalent = selectedCreators.length > 0;
    const hasContext = (personalInfo ?? '').trim().length > 0;
    const hasFirstEmail = (firstEmailContent ?? '').trim().length > 0;

    if (isFollowUpTab) {
      if (!hasFirstEmail) {
        wallsToast.error("First email required", "Switch to the original email tab, add content, then create a follow-up tab.");
        return;
      }
    } else if (!isTalentOutreach && !hasTalent && !hasContext) {
      wallsToast.error("Talent or context required", "Tag at least one talent in the pitch tracker or add additional context above before generating.");
      return;
    }

    try {
      setIsGenerating(true);
      requestInProgress.current = true;

      if (!recipientEmails.length) throw new Error('No recipient email found');

      const primaryRecipient = recipientEmails[0];
      const firestoreData = await getFirestoreData(primaryRecipient);
      const firstName = firestoreData?.recipientData?.firstName || 'there';

      if (isFollowUpTab) {
        const response = await fetch('/api/walli/email-gen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followUpMode: true, firstEmailContent: (firstEmailContent ?? '').trim(), personalInfo: (personalInfo ?? '').trim(), recipientName: firstName, recipientEmail: primaryRecipient, model: selectedModel }),
        });
        if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error || `API request failed with status ${response.status}`); }
        const data = await response.json();
        if (!data.content) throw new Error('Invalid response format from API');
        if (onAIGenerationComplete) { onAIGenerationComplete({ subject: '', content: data.content }); }
        else if (editorRef.current?.getEditor()) { editorRef.current.getEditor()?.commands.setContent(data.content); onChange(data.content); }
        wallsToast.success("Follow-up Generated", "Follow-up content has been generated.");
        return;
      }

      if (isTalentOutreach) {
        const fallback = (outreachRecipientFirstNameFallback ?? '').trim();
        const payload = {
          personalInfo: (personalInfo ?? '').trim(),
          recipientEmail: primaryRecipient,
          model: selectedModel,
          ...(outreachPersonId?.trim() ? { personId: outreachPersonId.trim() } : {}),
          ...(fallback ? { recipientFirstNameFallback: fallback } : {}),
        };
        console.log('[aiWriter] email-gen-talent request', {
          recipientEmail: primaryRecipient,
          personId: outreachPersonId?.trim() ?? null,
          hasFirstNameFallback: Boolean(fallback),
          model: selectedModel,
        });
        const response = await fetch('/api/walli/email-gen-talent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error || `API request failed with status ${response.status}`); }
        const data = await response.json();
        if (!data.content || !data.subject) throw new Error('Invalid response format from API');
        if (onAIGenerationComplete) { onAIGenerationComplete({ subject: data.subject, content: data.content }); }
        else if (editorRef.current?.getEditor()) { editorRef.current.getEditor()?.commands.setContent(data.content); onChange(data.content); onSubjectChange(data.subject); }
        wallsToast.success("Email Generated", "Talent outreach email has been generated.");
        return;
      }

      const talentContext = await fetchTalentContext(selectedCreators.map((c) => c.id));
      const response = await fetch('/api/walli/email-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalInfo, recipientName: firstName, recipientEmail: primaryRecipient, model: selectedModel, ...(talentContext.length > 0 && { talentContext }) }),
      });

      if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error || `API request failed with status ${response.status}`); }

      const data = await response.json();
      if (!data.content || !data.subject) throw new Error('Invalid response format from API');

      if (onAIGenerationComplete) { onAIGenerationComplete({ subject: data.subject, content: data.content }); }
      else if (editorRef.current?.getEditor()) { editorRef.current.getEditor()?.commands.setContent(data.content); onChange(data.content); onSubjectChange(data.subject); }
      else throw new Error('Editor not initialized');

      wallsToast.success("Email Generated", "Email content and subject line have been generated.");
    } catch (error) {
      wallsToast.error("Generation Failed", error instanceof Error ? error.message : "Failed to generate email content");
    } finally {
      setIsGenerating(false);
      requestInProgress.current = false;
    }
  };

  const handleTemplateSelect = async (template: EmailTemplate) => {
    if (!recipientEmails.length) { wallsToast.error("No Recipient", "Please add a recipient before generating."); return; }
    if (selectedCreators.length === 0) { wallsToast.error("Tag a talent", "Tag at least one talent in the pitch tracker to generate an email from a template."); return; }

    try {
      setIsGenerating(true);
      const primaryRecipient = recipientEmails[0];
      const firestoreData = await getFirestoreData(primaryRecipient);
      const firstName = firestoreData?.recipientData?.firstName || 'there';
      const talentContext = await fetchTalentContext(selectedCreators.map((c) => c.id));

      const response = await fetch('/api/walli/email-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalInfo: '', recipientName: firstName, recipientEmail: primaryRecipient, model: selectedModel, ...(talentContext.length > 0 && { talentContext }) }),
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || 'Failed to generate email'); }
      const data = await response.json();
      if (!data.content || !data.subject) throw new Error('Invalid response from email generation');

      if (onAIGenerationComplete) { onAIGenerationComplete({ subject: data.subject, content: data.content }); }
      else if (editorRef.current?.getEditor()) { editorRef.current.getEditor()?.commands.setContent(data.content); onChange(data.content); onSubjectChange(data.subject); }
      wallsToast.success("Email Generated", "Email content and subject line have been generated.");
    } catch (error) {
      wallsToast.error("Generation Failed", error instanceof Error ? error.message : "Failed to generate email");
    } finally {
      setIsGenerating(false);
      setShowTemplatePopup(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* No footer-level review actions: resolve changes inline inside editor only */}

      <Popover
        open={diffBlocks ? false : showPersonalInfo}
        onOpenChange={(open) => {
          if (diffBlocks) return;
          if (open && !recipientEmails.length) {
            wallsToast.error("Missing Information", "Please add a recipient before generating.");
            return;
          }
          if (open) setIsEditMode(editorHasContent());
          setShowPersonalInfo(open);
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
                {isGenerating
                  ? <Loader2 className="h-[18px] w-[18px] animate-spin text-neutral-500" />
                  : <Sparkles className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />}
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
          <div className="relative">
            <PersonalInfoPopupContent
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onClose={() => setShowPersonalInfo(false)}
              onSubmit={(info) => {
                setShowPersonalInfo(false);
                setPersonalInfo('');
                if (isEditMode) {
                  editEmailWithAI(info);
                } else {
                  generateEmailWithTemplate(info);
                }
              }}
              hasTaggedTalent={selectedCreators.length > 0}
              isFollowUpMode={isFollowUpTab}
              hasFirstEmail={(firstEmailContent ?? '').trim().length > 0}
              isTalentOutreach={isTalentOutreach}
              isEditMode={isEditMode}
              personalInfo={personalInfo}
              onPersonalInfoChange={setPersonalInfo}
            />
          </div>
        </PopoverContent>
      </Popover>

      <AITemplatePopup
        isOpen={showTemplatePopup}
        onClose={() => setShowTemplatePopup(false)}
        onSelectTemplate={handleTemplateSelect}
      />
    </>
  );
}
