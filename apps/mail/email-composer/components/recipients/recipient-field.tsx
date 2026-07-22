// app/components/agent-mail/email-composer/components/recipients/recipient-field.tsx
"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { validateEmail } from "@/lib/utils";
import { RecipientSearch } from './recipient-search';
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import Image from "next/image";

interface EmailTag {
  email: string;
  id: string;
  personName?: string;
  personPhoto?: string;
}

interface RecipientFieldProps {
  toTags: EmailTag[];
  ccTags: EmailTag[];
  bccTags: EmailTag[];
  onToTagsChange: (tags: EmailTag[]) => void;
  onCcTagsChange: (tags: EmailTag[]) => void;
  onBccTagsChange: (tags: EmailTag[]) => void;
  replyTo?: {
    to: string;
    cc?: string;
    bcc?: string;
  };
}

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(str: string): string {
  const parts = str.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const atIdx = str.indexOf('@');
  const base = atIdx > 0 ? str.slice(0, atIdx) : str;
  return base.slice(0, 2).toUpperCase();
}

function RecipientChip({ tag, onRemove, disabled }: { tag: EmailTag; onRemove: () => void; disabled?: boolean }) {
  const [imageError, setImageError] = useState(false);
  const displayName = tag.personName || tag.email;
  const initials = getInitials(tag.personName || tag.email);
  const color = getAvatarColor(tag.email);
  const hasPhoto =
    tag.personPhoto &&
    !tag.personPhoto.includes('static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2') &&
    !imageError;
  const tooltip = tag.personName ? `${tag.personName} <${tag.email}>` : tag.email;

  return (
    <div
      className="group inline-flex items-center gap-1.5 rounded-full bg-white/40 hover:bg-white/60 border border-neutral-200/40 backdrop-blur-sm transition-colors duration-150 pl-[3px] pr-2 h-[26px] max-w-[240px] flex-shrink-0 shadow-md"
      title={tooltip}
    >
      {/* Avatar */}
      <div
        className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden ${
          hasPhoto ? '' : `${color.bg} ${color.text}`
        }`}
      >
        {hasPhoto ? (
          <Image
            src={tag.personPhoto!}
            alt={displayName}
            width={20}
            height={20}
            className="rounded-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="text-[9px] font-bold leading-none select-none">{initials}</span>
        )}
      </div>

      {/* Name */}
      <span className="text-[12px] font-medium text-gray-700 truncate leading-none">
        {displayName}
      </span>

      {/* Remove */}
      {!disabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/60 transition-all duration-100 ml-0.5 cursor-pointer"
          aria-label="Remove recipient"
        >
          <X className="w-2.5 h-2.5 text-gray-500" />
        </button>
      )}
    </div>
  );
}

async function fetchPersonData(email: string): Promise<{ name?: string; photo?: string } | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('people')
      .select('first_name, last_name, photo_url')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error || !data) return null;

    const firstName = data.first_name || '';
    const lastName = data.last_name || '';
    const name = `${firstName} ${lastName}`.trim() || undefined;
    const photo = data.photo_url || undefined;

    return { name, photo };
  } catch {
    return null;
  }
}

export function RecipientField({
  toTags,
  ccTags,
  bccTags,
  onToTagsChange,
  onCcTagsChange,
  onBccTagsChange,
  replyTo,
}: RecipientFieldProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(!!replyTo?.cc);
  const [showBcc, setShowBcc] = useState(!!replyTo?.bcc);

  // Enrich tags with person data from Supabase
  useEffect(() => {
    const enrichTags = async (tags: EmailTag[], setTags: (tags: EmailTag[]) => void) => {
      const needsEnrichment = tags.filter((t) => !t.personName && !t.personPhoto);
      if (needsEnrichment.length === 0) return;

      const enriched = await Promise.all(
        tags.map(async (tag) => {
          if (tag.personName || tag.personPhoto) return tag;
          const data = await fetchPersonData(tag.email);
          return data ? { ...tag, personName: data.name, personPhoto: data.photo } : tag;
        })
      );

      const hasChanges = enriched.some(
        (e, i) => e.personName !== tags[i]?.personName || e.personPhoto !== tags[i]?.personPhoto
      );
      if (hasChanges) setTags(enriched);
    };

    if (toTags.length > 0) enrichTags(toTags, onToTagsChange);
    if (ccTags.length > 0) enrichTags(ccTags, onCcTagsChange);
    if (bccTags.length > 0) enrichTags(bccTags, onBccTagsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toTags.map((t) => t.email).join(','), ccTags.map((t) => t.email).join(','), bccTags.map((t) => t.email).join(',')]);

  const addEmail = (
    email: string,
    tags: EmailTag[],
    setTags: (t: EmailTag[]) => void,
    setInput: (v: string) => void
  ) => {
    const trimmed = email.trim().replace(',', '');
    if (trimmed && validateEmail(trimmed) && !tags.some((t) => t.email === trimmed)) {
      setTags([...tags, { email: trimmed, id: Math.random().toString(36).substr(2, 9) }]);
      setInput('');
    } else if (trimmed && !validateEmail(trimmed)) {
      wallsToast.error('Invalid Email', 'Please enter a valid email address');
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    tags: EmailTag[],
    setTags: (t: EmailTag[]) => void,
    input: string,
    setInput: (v: string) => void
  ) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(input, tags, setTags, setInput);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (id: string, tags: EmailTag[], setTags: (t: EmailTag[]) => void) => {
    setTags(tags.filter((t) => t.id !== id));
  };

  return (
    <div className="divide-y divide-white/20">
      {/* To row */}
      <div className="relative flex items-start min-h-[46px]">
        <span className="w-10 flex-shrink-0 text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-[14px] pl-4 select-none">
          To
        </span>
        <div className="flex-1 flex flex-wrap items-center gap-1.5 py-2.5 pr-2 pl-1 min-h-[46px]">
          {toTags.map((tag) => (
            <RecipientChip
              key={tag.id}
              tag={tag}
              onRemove={() => { if (!replyTo) removeTag(tag.id, toTags, onToTagsChange); }}
              disabled={!!replyTo}
            />
          ))}
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, toTags, onToTagsChange, to, setTo)}
            onBlur={() => addEmail(to, toTags, onToTagsChange, setTo)}
            disabled={!!replyTo}
            placeholder={toTags.length === 0 ? 'Add recipient…' : ''}
            className="border-0 bg-transparent focus-visible:ring-0 p-0 h-[26px] flex-1 min-w-[120px] text-[13px] text-gray-700 placeholder:text-gray-400/60"
          />
        </div>
        <div className="flex items-center gap-0.5 pr-3 pt-[10px] flex-shrink-0">
          {!showCc && (
            <button
              className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors px-1.5 py-1 rounded hover:bg-white/30"
              onClick={() => setShowCc(true)}
            >
              Cc
            </button>
          )}
          {!showBcc && (
            <button
              className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors px-1.5 py-1 rounded hover:bg-white/30"
              onClick={() => setShowBcc(true)}
            >
              Bcc
            </button>
          )}
        </div>
        <RecipientSearch
          onSelect={(email) => {
            if (!toTags.some((t) => t.email === email)) {
              onToTagsChange([...toTags, { email, id: Math.random().toString(36).substr(2, 9) }]);
              setTo('');
            }
          }}
          currentInput={to}
        />
      </div>

      {/* Cc row */}
      {showCc && (
        <div className="flex items-start min-h-[46px]">
          <span className="w-10 flex-shrink-0 text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-[14px] pl-4 select-none">
            Cc
          </span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 py-2.5 pr-2 pl-1 min-h-[46px]">
            {ccTags.map((tag) => (
              <RecipientChip
                key={tag.id}
                tag={tag}
                onRemove={() => removeTag(tag.id, ccTags, onCcTagsChange)}
              />
            ))}
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, ccTags, onCcTagsChange, cc, setCc)}
              onBlur={() => addEmail(cc, ccTags, onCcTagsChange, setCc)}
              className="border-0 bg-transparent focus-visible:ring-0 p-0 h-[26px] flex-1 min-w-[120px] text-[13px] text-gray-700 placeholder:text-gray-400/60"
            />
          </div>
          <button
            className="p-2 mt-1.5 mr-1 text-gray-400 hover:text-gray-600 hover:bg-white/30 rounded transition-colors flex-shrink-0"
            onClick={() => { setShowCc(false); setCc(''); onCcTagsChange([]); }}
            aria-label="Remove Cc"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bcc row */}
      {showBcc && (
        <div className="flex items-start min-h-[46px]">
          <span className="w-10 flex-shrink-0 text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-[14px] pl-4 select-none">
            Bcc
          </span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 py-2.5 pr-2 pl-1 min-h-[46px]">
            {bccTags.map((tag) => (
              <RecipientChip
                key={tag.id}
                tag={tag}
                onRemove={() => removeTag(tag.id, bccTags, onBccTagsChange)}
              />
            ))}
            <Input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, bccTags, onBccTagsChange, bcc, setBcc)}
              onBlur={() => addEmail(bcc, bccTags, onBccTagsChange, setBcc)}
              className="border-0 bg-transparent focus-visible:ring-0 p-0 h-[26px] flex-1 min-w-[120px] text-[13px] text-gray-700 placeholder:text-gray-400/60"
            />
          </div>
          <button
            className="p-2 mt-1.5 mr-1 text-gray-400 hover:text-gray-600 hover:bg-white/30 rounded transition-colors flex-shrink-0"
            onClick={() => { setShowBcc(false); setBcc(''); onBccTagsChange([]); }}
            aria-label="Remove Bcc"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
