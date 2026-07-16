"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getSupabaseClient, useAuth } from "@/lib/auth";
import { wallsToast } from "@/components/ui/walls-toast";
import { Toaster } from "@/components/ui/toaster";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentType = "reply_agent" | "talent_pitch_agent" | "brand_pitch_agent";
type Tone = "friendly" | "professional" | "conversational" | "enthusiastic" | "persuasive";
type Formality = "casual" | "semi_formal" | "formal";
type Length = "concise" | "balanced" | "detailed";
type Directness = "soft" | "balanced" | "direct";
type Personalization = "low" | "medium" | "high";

interface WritingProfile {
  id?: string;
  user_id?: string;
  name: string;
  description: string;
  agent_type: AgentType;
  tone: Tone;
  formality: Formality;
  length: Length;
  directness: Directness;
  personalization: Personalization;
  emoji_usage: boolean;
  custom_instructions: string;
  is_default: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_TABS: { value: AgentType; label: string; description: string }[] = [
  { value: "reply_agent", label: "Reply Writer", description: "Handles inbound message replies" },
  { value: "talent_pitch_agent", label: "Scouter", description: "Outreach to talent & creators" },
  { value: "brand_pitch_agent", label: "Brand Outreach", description: "Pitching brands & sponsors" },
];

const TONE_OPTIONS: { value: Tone; label: string; helper: string }[] = [
  { value: "friendly", label: "Friendly", helper: "Warm, approachable, conversational." },
  { value: "professional", label: "Professional", helper: "Polished and business-ready." },
  { value: "conversational", label: "Conversational", helper: "Casual, like talking to a friend." },
  { value: "enthusiastic", label: "Enthusiastic", helper: "High energy, excited tone." },
  { value: "persuasive", label: "Persuasive", helper: "Compelling, action-oriented." },
];

const FORMALITY_OPTIONS: { value: Formality; label: string; helper: string }[] = [
  { value: "casual", label: "Casual", helper: "Relaxed, informal phrasing." },
  { value: "semi_formal", label: "Semi-formal", helper: "Balanced — the default." },
  { value: "formal", label: "Formal", helper: "Structured, professional language." },
];

const LENGTH_OPTIONS: { value: Length; label: string; helper: string }[] = [
  { value: "concise", label: "Concise", helper: "Short and to the point." },
  { value: "balanced", label: "Balanced", helper: "Adequate detail without fluff." },
  { value: "detailed", label: "Detailed", helper: "Thorough, comprehensive copy." },
];

const DIRECTNESS_OPTIONS: { value: Directness; label: string; helper: string }[] = [
  { value: "soft", label: "Soft", helper: "Gentle, diplomatic phrasing." },
  { value: "balanced", label: "Balanced", helper: "Clear without being blunt." },
  { value: "direct", label: "Direct", helper: "Straight to the point." },
];

const PERSONALIZATION_OPTIONS: { value: Personalization; label: string; helper: string }[] = [
  { value: "low", label: "Low", helper: "Generic, broadly applicable." },
  { value: "medium", label: "Medium", helper: "Some tailoring to context." },
  { value: "high", label: "High", helper: "Highly tailored to the recipient." },
];

const EMOJI_OPTIONS: { value: boolean; label: string; helper: string }[] = [
  { value: false, label: "No emojis", helper: "Keep it clean and text-only." },
  { value: true, label: "Use emojis", helper: "Add personality with emojis." },
];

const fieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] bg-transparent w-full placeholder:text-neutral-300";
const labelClass = "text-xs font-normal text-neutral-400 tracking-wide block mb-1";
const textareaClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] bg-transparent w-full resize-none text-sm placeholder:text-neutral-300";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultProfile = (agentType: AgentType): WritingProfile => ({
  name: "",
  description: "",
  agent_type: agentType,
  tone: "friendly",
  formality: "semi_formal",
  length: "concise",
  directness: "direct",
  personalization: "high",
  emoji_usage: false,
  custom_instructions: "",
  is_default: true,
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionGroup<T extends string | boolean>({
  label,
  sublabel,
  options,
  value,
  onChange,
  cols = 3,
}: {
  label: string;
  sublabel?: string;
  options: { value: T; label: string; helper: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: 2 | 3 | 4 | 5;
}) {
  const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-5",
  }[cols];

  const selectedMeta = options.find((o) => o.value === value);

  return (
    <div className="pt-8 pb-2">
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </p>
        <p className="text-xl font-light tracking-tight text-neutral-900 sm:text-2xl">
          {selectedMeta?.label ?? "—"}
        </p>
        {sublabel && (
          <p className="text-xs font-light text-neutral-500">{sublabel}</p>
        )}
      </div>

      <div className={cn("grid gap-2", colClass)}>
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(opt.value)}
              className="group w-full text-left"
            >
              <div
                className={cn(
                  "relative z-10 rounded-2xl px-3 py-3 transition-all duration-300 ease-in-out",
                  "border border-transparent",
                  "group-hover:bg-kenoo-white group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-[0.99]",
                  isSelected
                    ? [
                        "border-[rgba(110,173,192,0.45)] bg-white/40",
                        "shadow-[0_0_0_1px_rgba(110,173,192,0.35),0_0_12px_rgba(110,173,192,0.25)]",
                        "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(110,173,192,0.35),0_0_12px_rgba(110,173,192,0.25)]",
                      ]
                    : "bg-transparent"
                )}
              >
                <div className="text-sm font-light text-neutral-800">{opt.label}</div>
                <div className="mt-1 text-xs font-light text-neutral-500">{opt.helper}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WallieSettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<AgentType>("reply_agent");
  const [profiles, setProfiles] = React.useState<Record<AgentType, WritingProfile>>({
    reply_agent: defaultProfile("reply_agent"),
    talent_pitch_agent: defaultProfile("talent_pitch_agent"),
    brand_pitch_agent: defaultProfile("brand_pitch_agent"),
  });
  const [savedProfiles, setSavedProfiles] = React.useState<Record<AgentType, WritingProfile>>({
    reply_agent: defaultProfile("reply_agent"),
    talent_pitch_agent: defaultProfile("talent_pitch_agent"),
    brand_pitch_agent: defaultProfile("brand_pitch_agent"),
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [isHoveringSave, setIsHoveringSave] = React.useState(false);
  const [isHoveringCancel, setIsHoveringCancel] = React.useState(false);

  const current = profiles[activeTab];

  const hasChanges = React.useMemo(() => {
    const a = profiles[activeTab];
    const b = savedProfiles[activeTab];
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [profiles, savedProfiles, activeTab]);

  const setField = <K extends keyof WritingProfile>(key: K, value: WritingProfile[K]) => {
    setProfiles((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [key]: value },
    }));
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!user?.id) return;

    const fetchProfiles = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("wallie_writing_profiles")
          .select("*")
          .eq("user_id", user.id)
          .in("agent_type", ["reply_agent", "talent_pitch_agent", "brand_pitch_agent"])
          .eq("is_default", true);

        if (error) throw error;

        if (data && data.length > 0) {
          const updated: Record<AgentType, WritingProfile> = {
            reply_agent: defaultProfile("reply_agent"),
            talent_pitch_agent: defaultProfile("talent_pitch_agent"),
            brand_pitch_agent: defaultProfile("brand_pitch_agent"),
          };
          for (const row of data) {
            const key = row.agent_type as AgentType;
            updated[key] = {
              id: row.id,
              user_id: row.user_id,
              name: row.name ?? "",
              description: row.description ?? "",
              agent_type: row.agent_type,
              tone: row.tone,
              formality: row.formality,
              length: row.length,
              directness: row.directness,
              personalization: row.personalization,
              emoji_usage: row.emoji_usage,
              custom_instructions: row.custom_instructions ?? "",
              is_default: row.is_default,
            };
          }
          setProfiles(updated);
          setSavedProfiles(JSON.parse(JSON.stringify(updated)));
        }
      } catch (err) {
        console.error("Error fetching Wallie settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [user?.id]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!user?.id || !hasChanges) return;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const profile = profiles[activeTab];

      const payload = {
        user_id: user.id,
        name: profile.name || AGENT_TABS.find((t) => t.value === activeTab)!.label,
        description: profile.description || null,
        agent_type: activeTab,
        tone: profile.tone,
        formality: profile.formality,
        length: profile.length,
        directness: profile.directness,
        personalization: profile.personalization,
        emoji_usage: profile.emoji_usage,
        custom_instructions: profile.custom_instructions || null,
        is_default: true,
        updated_at: new Date().toISOString(),
      };

      if (profile.id) {
        const { error } = await supabase
          .from("wallie_writing_profiles")
          .update(payload)
          .eq("id", profile.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("wallie_writing_profiles")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setProfiles((prev) => ({
          ...prev,
          [activeTab]: { ...prev[activeTab], id: data.id },
        }));
      }

      setSavedProfiles((prev) => ({
        ...prev,
        [activeTab]: { ...profiles[activeTab] },
      }));

      wallsToast.success("Saved", "Writing profile updated.");
    } catch (err) {
      console.error("Error saving writing profile:", err);
      wallsToast.error("Error", "Failed to save writing profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setProfiles((prev) => ({
      ...prev,
      [activeTab]: { ...savedProfiles[activeTab] },
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-none bg-kenoo-white">
      <div className="w-full">
        <div className="max-w-5xl mx-auto px-8 pb-24">

          {/* Page Header */}
          <div className="mb-8 pt-8">
            <h1 className="text-3xl font-bold text-foreground">Wallie Settings</h1>
            <p className="text-sm font-light text-neutral-500 mt-1">
              Configure how Wallie writes for each agent type.
            </p>
          </div>

          {/* Agent Type Tabs */}
          <div className="grid grid-cols-3 gap-2 mb-10">
            {AGENT_TABS.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className="group w-full text-left"
                >
                  <div
                    className={cn(
                      "relative z-10 rounded-2xl px-4 py-4 transition-all duration-300 ease-in-out",
                      "border border-transparent",
                      "group-hover:bg-kenoo-white group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-[0.99]",
                      isActive
                        ? [
                            "border-[rgba(110,173,192,0.45)] bg-white/40",
                            "shadow-[0_0_0_1px_rgba(110,173,192,0.35),0_0_12px_rgba(110,173,192,0.25)]",
                          ]
                        : "bg-white/20"
                    )}
                  >
                    <div className="text-sm font-medium text-neutral-800">{tab.label}</div>
                    <div className="mt-0.5 text-xs font-light text-neutral-500">{tab.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center mb-8">
            <span className="text-black font-black text-4xl mr-4">
              {AGENT_TABS.find((t) => t.value === activeTab)?.label}
            </span>
            <div className="flex-1 border-t border-black h-[1px]" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Profile Name */}
                <div className="mb-4">
                  <label className={labelClass}>Profile name</label>
                  <BorderlessInput
                    type="text"
                    value={current.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder={AGENT_TABS.find((t) => t.value === activeTab)?.label ?? "Profile name"}
                    className={fieldClass}
                  />
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className={labelClass}>Description</label>
                  <BorderlessInput
                    type="text"
                    value={current.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Optional — what is this profile for?"
                    className={fieldClass}
                  />
                </div>

                {/* Tone */}
                <OptionGroup
                  label="Tone"
                  sublabel="The general voice and energy of the writing."
                  options={TONE_OPTIONS}
                  value={current.tone}
                  onChange={(v) => setField("tone", v)}
                  cols={5}
                />

                {/* Formality */}
                <OptionGroup
                  label="Formality"
                  sublabel="How formally Wallie addresses the recipient."
                  options={FORMALITY_OPTIONS}
                  value={current.formality}
                  onChange={(v) => setField("formality", v)}
                  cols={3}
                />

                {/* Length */}
                <OptionGroup
                  label="Message length"
                  sublabel="How much detail goes into each message."
                  options={LENGTH_OPTIONS}
                  value={current.length}
                  onChange={(v) => setField("length", v)}
                  cols={3}
                />

                {/* Directness */}
                <OptionGroup
                  label="Directness"
                  sublabel="How direct and assertive the copy is."
                  options={DIRECTNESS_OPTIONS}
                  value={current.directness}
                  onChange={(v) => setField("directness", v)}
                  cols={3}
                />

                {/* Personalization */}
                <OptionGroup
                  label="Personalization"
                  sublabel="How much Wallie tailors each message to the recipient."
                  options={PERSONALIZATION_OPTIONS}
                  value={current.personalization}
                  onChange={(v) => setField("personalization", v)}
                  cols={3}
                />

                {/* Emoji usage */}
                <OptionGroup
                  label="Emoji usage"
                  sublabel="Whether Wallie includes emojis in messages."
                  options={EMOJI_OPTIONS}
                  value={current.emoji_usage}
                  onChange={(v) => setField("emoji_usage", v)}
                  cols={2}
                />

                {/* Custom Instructions */}
                <div className="pt-8 pb-2">
                  <div className="mb-4">
                    <label className={labelClass}>Custom instructions</label>
                    <p className="text-xs font-light text-neutral-500 mb-3">
                      Additional instructions Wallie follows when writing for this agent type.
                    </p>
                    <textarea
                      value={current.custom_instructions}
                      onChange={(e) => setField("custom_instructions", e.target.value)}
                      placeholder="e.g. Always mention our talent roster size. Never use the word 'leverage'."
                      rows={4}
                      className={textareaClass}
                    />
                  </div>
                </div>

                {/* Save / Cancel */}
                <div className="flex justify-start gap-3 pt-8 pb-8">
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    variant="ghost"
                    onMouseEnter={() => setIsHoveringSave(true)}
                    onMouseLeave={() => setIsHoveringSave(false)}
                    className="relative bg-background backdrop-blur-md border border-neutral-200/50 text-foreground font-normal px-8 py-6 rounded-none hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <AnimatePresence>
                          {isHoveringSave && (
                            <motion.div
                              initial={{ opacity: 0, x: -10, scale: 0.8 }}
                              animate={{ opacity: 1, x: 0, scale: 1, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }}
                              exit={{ opacity: 0, x: -10, scale: 0.8, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                              className="absolute left-4 flex items-center pointer-events-none"
                            >
                              <Check className="h-4 w-4 text-kenoo-yellow" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <motion.span
                          className="inline-block"
                          animate={{ x: isHoveringSave ? 8 : 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}
                        >
                          Save Changes
                        </motion.span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleRevert}
                    disabled={!hasChanges || saving}
                    variant="ghost"
                    onMouseEnter={() => setIsHoveringCancel(true)}
                    onMouseLeave={() => setIsHoveringCancel(false)}
                    className="relative bg-background backdrop-blur-md border border-neutral-200/50 text-foreground font-normal px-8 py-6 rounded-none hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                  >
                    <AnimatePresence>
                      {isHoveringCancel && (
                        <motion.div
                          initial={{ opacity: 0, x: -10, scale: 0.8 }}
                          animate={{ opacity: 1, x: 0, scale: 1, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }}
                          exit={{ opacity: 0, x: -10, scale: 0.8, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                          className="absolute left-4 flex items-center pointer-events-none"
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.span
                      className="inline-block"
                      animate={{ x: isHoveringCancel ? 8 : 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}
                    >
                      Cancel
                    </motion.span>
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
