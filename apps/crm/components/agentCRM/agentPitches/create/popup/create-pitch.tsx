"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent } from "./dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check } from "lucide-react";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { CompanySearch } from "@/components/ui/searches/companySearch/company-search";
import { CreatorSearch } from "@/components/ui/creator-search";
import { RecipientSelector } from "@/components/ui/recipient-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CreatePitchAnchorRect = { top: number; left: number; width: number; height: number } | null;

interface CreatePitchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: CreatePitchAnchorRect;
  triggerRef?: React.RefObject<HTMLElement | null>;
  onCreated?: () => void;
}

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'walls', label: 'Walls' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'other', label: 'Other' },
];

const AnimatedSuccessToast = ({ message }: { message?: string }) => (
  <div className="flex items-center gap-3">
    <motion.div
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: [0, 1.2, 1], rotate: [-45, 10, 0] }}
      transition={{ duration: 0.6, times: [0, 0.6, 1], ease: "easeOut" }}
      className="relative flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0, opacity: 0.5 }}
        animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0 rounded-full bg-kenoo-yellow"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="relative z-10 bg-kenoo-yellow rounded-full p-2"
      >
        <Check className="h-4 w-4 text-neutral-800" />
      </motion.div>
    </motion.div>
    <div className="flex flex-col">
      <motion.span
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="font-semibold text-sm text-neutral-900"
      >
        {message || "Pitch created successfully"}
      </motion.span>
    </div>
  </div>
);

const DROPDOWN_OFFSET = 8;
const DROPDOWN_WIDTH = 300;

function CreatePitchForm({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const { user } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedCreator, setSelectedCreator] = useState("");
  const [creators, setCreators] = useState<{ id: string; name: string; avatar_url?: string }[]>([]);
  const [pitchedTo, setPitchedTo] = useState("");
  const [channel, setChannel] = useState("email");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.email) {
      // pre-fill sent by context if needed
    }
  }, [user]);

  const handleCreatorSelect = (name: string, talentId?: string, avatarUrl?: string) => {
    if (!talentId) return;
    if (!creators.some((c) => c.id === talentId)) {
      setCreators((prev) => [...prev, { id: talentId, name, avatar_url: avatarUrl }]);
    }
    setSelectedCreator("");
  };

  const handleRemoveCreator = (talentId: string) => {
    setCreators((prev) => prev.filter((c) => c.id !== talentId));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();

      // Find company
      let companyId: string | null = null;
      let companyWebsite = "";
      if (selectedCompany) {
        const { data: company } = await supabase
          .from('companies')
          .select('id, website')
          .eq('name', selectedCompany)
          .limit(1)
          .single();
        if (company) {
          companyId = company.id;
          companyWebsite = company.website || "";
        }
      }

      // Find person
      let personId: string | null = null;
      if (pitchedTo) {
        const { data: person } = await supabase
          .from('people')
          .select('id')
          .eq('email', pitchedTo)
          .limit(1)
          .single();
        if (person) personId = person.id;
      }

      // Find agent from current user
      let agentId: string | null = null;
      if (user.email) {
        const { data: agent } = await supabase
          .from('team')
          .select('id')
          .eq('email', user.email)
          .limit(1)
          .single();
        if (agent) agentId = agent.id;
      }

      // Create pitch
      const pitchUuid = crypto.randomUUID();

      const { data: pitchData, error: pitchError } = await supabase
        .from('pitches')
        .insert({
          id: pitchUuid,
          provider_id: pitchUuid,
          provider: 'manual',
          person_id: personId,
          agent_id: agentId,
          company_website: companyWebsite || null,
          company_id: companyId,
          channel,
          timestamp: new Date().toISOString(),
          message: null,
        })
        .select('id')
        .single();

      if (pitchError || !pitchData) throw pitchError;

      if (creators.length > 0) {
        await supabase.from('pitches_creators').insert(
          creators.map((creator) => ({ pitch_id: pitchData.id, talent_id: creator.id }))
        );
      }

      wallsToast.success("Pitch created successfully");

      onClose();
      if (onCreated) onCreated();
    } catch (error) {
      console.error("Error creating pitch:", error);
      wallsToast.error("Failed to create pitch");
    } finally {
      setIsSaving(false);
    }
  };

  const fieldWrapperClass = "rounded-xl bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 px-3 py-1";
  const labelClass = "text-xs font-normal text-neutral-400 tracking-wide block mb-1";

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Company</label>
        <CompanySearch value={selectedCompany} onChange={setSelectedCompany} triggerIcon="chevron" />
      </div>

      <div>
        <label className={labelClass}>Pitched To</label>
        <RecipientSelector
          value={pitchedTo}
          onChange={setPitchedTo}
          selectedCompany={selectedCompany}
        />
      </div>

      <div>
        <label className={labelClass}>Creators</label>
        <div className={fieldWrapperClass}>
          <CreatorSearch
            value={selectedCreator}
            onChange={setSelectedCreator}
            onChangeWithId={(talentId, name, avatarUrl) => handleCreatorSelect(name, talentId, avatarUrl)}
            selectedIds={creators.map((c) => c.id)}
            onRemoveId={handleRemoveCreator}
            triggerIcon="chevron"
            placeholder="Select creator..."
          />
        </div>
        {creators.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {creators.map((creator) => (
              <div key={creator.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 shadow-inner border border-neutral-200/50 text-sm">
                <span className="text-neutral-700 font-light">{creator.name}</span>
                <button onClick={() => handleRemoveCreator(creator.id)} className="text-neutral-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Channel</label>
        <div className={fieldWrapperClass}>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="border-0 focus:ring-0 focus-visible:ring-0 bg-transparent shadow-none h-9 px-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl z-[10000]">
              {CHANNEL_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="rounded-xl">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="w-8 h-8 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all group disabled:opacity-50"
        >
          <X className="w-4 h-4 text-gray-700 group-hover:text-red-600 transition-colors" />
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !selectedCompany}
          className="w-8 h-8 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-4 h-4 text-gray-700 group-hover:text-kenoo-yellow transition-colors" />
          )}
        </button>
      </div>
    </div>
  );
}

export function CreatePitchPopup({
  isOpen,
  onClose,
  anchorRect = null,
  triggerRef,
  onCreated,
}: CreatePitchPopupProps) {
  const [showForm, setShowForm] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isOpen || !anchorRect || !isMounted) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;

      // Ignore clicks that occur inside Radix popper-based dropdowns/menus
      if (target instanceof HTMLElement) {
        if (target.closest("[data-radix-popper-content-wrapper]")) {
          return;
        }
      }

      if (triggerRef?.current?.contains(target)) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) onClose();
    };
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [isOpen, anchorRect, onClose, isMounted, triggerRef]);

  useEffect(() => {
    if (!isOpen) setShowForm(false);
  }, [isOpen]);

  if (!isMounted) return null;

  const dropdownContainerVariants = {
    hidden: { opacity: 0, scale: 0.96, y: -6 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const } },
  };

  const buttonClass = "w-full text-left p-3 rounded-lg border border-neutral-200/50 bg-neutral-100 backdrop-blur-md shadow-inner hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-colors duration-200";

  if (anchorRect && isMounted && typeof document !== "undefined") {
    const style: React.CSSProperties = {
      position: "fixed",
      top: anchorRect.top + anchorRect.height + DROPDOWN_OFFSET,
      left: anchorRect.left - 12,
      width: DROPDOWN_WIDTH,
      zIndex: 9999,
    };
    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            role="dialog"
            aria-modal="true"
            style={style}
            className="rounded-lg bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl p-3"
            variants={dropdownContainerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {showForm ? (
              <CreatePitchForm
                onClose={() => {
                  setShowForm(false);
                  onClose();
                }}
                onCreated={onCreated}
              />
            ) : (
              <motion.div className="space-y-3">
                <motion.button
                  onClick={() => setShowForm(true)}
                  className={buttonClass}
                >
                  <div className="flex items-center gap-3">
                    <Plus className="h-4 w-4 text-gray-700 shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium text-gray-800 text-sm">Manual Add</span>
                      <span className="text-xs text-gray-600 mt-0.5 font-light">Manually create a pitch</span>
                    </div>
                  </div>
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="w-full max-w-[360px] bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden p-4">
        {showForm ? (
          <CreatePitchForm
            onClose={() => {
              setShowForm(false);
              onClose();
            }}
            onCreated={onCreated}
          />
        ) : (
          <div className="space-y-3">
            <button onClick={() => setShowForm(true)} className={buttonClass}>
              <div className="flex items-center gap-3">
                <Plus className="h-4 w-4 text-gray-700 shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-gray-800 text-sm">Manual Add</span>
                  <span className="text-xs text-gray-600 mt-0.5 font-light">Manually create a pitch</span>
                </div>
              </div>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
