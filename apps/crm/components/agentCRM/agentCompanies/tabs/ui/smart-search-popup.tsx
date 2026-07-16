"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Globe, Briefcase, Users, MailCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CountrySelect } from "@/components/ui/searches/scouter-country-search";
import { SequenceSwitch as Switch } from "@/components/agentCRM/agentSequences/ui/sequence-switch";
import { countryCodeMapping } from "@/types/country.types";
import { cn } from "@/lib/utils";

const CODE_TO_COUNTRY_NAME: Record<string, string> = {};
Object.entries(countryCodeMapping).forEach(([name, code]) => {
  CODE_TO_COUNTRY_NAME[code] = name;
});

export function getCountryNameFromCode(code: string): string {
  return CODE_TO_COUNTRY_NAME[code] ?? code;
}

export interface SmartSearchFilters {
  countryCode: string;
  title: string;
  seniorities: string[];
  emailStatuses: string[];
}

interface SmartSearchPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (filters: SmartSearchFilters) => void;
  companyName?: string;
}

const PANEL_SURFACE_CLASS =
  "rounded-2xl border-0 bg-transparent p-4 shadow-none";

const TOGGLE_ROW_CLASS =
  "group flex w-full items-center justify-between rounded-2xl border border-neutral-300/30 bg-white/60 backdrop-blur-sm backdrop-saturate-150 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_22px_-8px_rgba(0,0,0,0.1)] px-3 py-2.5 text-left";

const footerButtonClass =
  "group inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out border border-transparent bg-transparent hover:bg-gray-50 hover:border hover:border-neutral-200 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] hover:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

type FilterSection = "country" | "title" | "seniority" | "emailStatus";

const ALL_SECTION_IDS: FilterSection[] = ["country", "title", "seniority", "emailStatus"];

type SectionEnabledMap = Record<FilterSection, boolean>;

const DEFAULT_SECTION_ENABLED: SectionEnabledMap = {
  country: false,
  title: true,
  seniority: false,
  emailStatus: true,
};

const DEFAULT_TITLE = "Marketing";

const SENIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
  { value: "intern", label: "Intern" },
];

const EMAIL_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "verified", label: "Verified" },
  { value: "likely", label: "Likely to engage" },
  { value: "unverified", label: "Unverified" },
  { value: "unavailable", label: "Unavailable" },
];

const DEFAULT_EMAIL_STATUSES = ["verified", "likely", "unverified"];

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sorted1 = [...a].sort();
  const sorted2 = [...b].sort();
  return sorted1.every((v, i) => v === sorted2[i]);
};

export function SmartSearchPopup({
  open,
  onOpenChange,
  onSearch,
  companyName,
}: SmartSearchPopupProps) {
  const [countryCode, setCountryCode] = useState("");
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [emailStatuses, setEmailStatuses] = useState<string[]>(DEFAULT_EMAIL_STATUSES);
  const [sectionEnabled, setSectionEnabled] = useState<SectionEnabledMap>(DEFAULT_SECTION_ENABLED);
  const [activeSection, setActiveSection] = useState<FilterSection>("country");
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (justOpened) {
      setCountryCode("");
      setTitle(DEFAULT_TITLE);
      setSeniorities([]);
      setEmailStatuses(DEFAULT_EMAIL_STATUSES);
      setSectionEnabled(DEFAULT_SECTION_ENABLED);
      setActiveSection("country");
    }
  }, [open]);

  const setSectionEnabledFor = (id: FilterSection, enabled: boolean) => {
    setSectionEnabled((prev) => ({ ...prev, [id]: enabled }));
  };

  const ensureSectionEnabled = (id: FilterSection) => {
    setSectionEnabled((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    if (code) ensureSectionEnabled("country");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    ensureSectionEnabled("title");
  };

  const toggleSeniority = (value: string) => {
    setSeniorities((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    ensureSectionEnabled("seniority");
  };

  const toggleEmailStatus = (value: string) => {
    setEmailStatuses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    ensureSectionEnabled("emailStatus");
  };

  const handleSearch = () => {
    onSearch({
      countryCode: sectionEnabled.country ? countryCode : "",
      title: sectionEnabled.title ? title.trim() : "",
      seniorities: sectionEnabled.seniority ? seniorities : [],
      emailStatuses: sectionEnabled.emailStatus ? emailStatuses : [],
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setCountryCode("");
    setTitle(DEFAULT_TITLE);
    setSeniorities([]);
    setEmailStatuses(DEFAULT_EMAIL_STATUSES);
    setSectionEnabled(DEFAULT_SECTION_ENABLED);
  };

  const sectionHasValue = (id: FilterSection) => {
    switch (id) {
      case "country":
        return !!countryCode;
      case "title":
        return !!title.trim();
      case "seniority":
        return seniorities.length > 0;
      case "emailStatus":
        return !arraysEqual(emailStatuses, DEFAULT_EMAIL_STATUSES);
      default:
        return false;
    }
  };

  const hasFilters =
    !!countryCode ||
    title.trim() !== DEFAULT_TITLE ||
    seniorities.length > 0 ||
    !arraysEqual(emailStatuses, DEFAULT_EMAIL_STATUSES) ||
    ALL_SECTION_IDS.some((id) => sectionEnabled[id] !== DEFAULT_SECTION_ENABLED[id]);

  const sections: Array<{ id: FilterSection; label: string; icon: typeof Globe }> = [
    { id: "country", label: "Country", icon: Globe },
    { id: "title", label: "Title", icon: Briefcase },
    { id: "seniority", label: "Seniority", icon: Users },
    { id: "emailStatus", label: "Email Status", icon: MailCheck },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex w-[calc(100%-1.5rem)] max-w-[min(720px,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden rounded-[28px] border border-neutral-200/60 bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:max-w-[720px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Smart search filters</DialogTitle>
        <DialogDescription className="sr-only">
          Filter people search by country, title, seniority, and email status.
        </DialogDescription>

        <div className="flex h-[min(440px,80vh)] min-h-0 flex-col md:flex-row">
          {/* Sidebar: filter section selector */}
          <aside className="shrink-0 border-b border-neutral-200/60 bg-gradient-to-b from-neutral-100/90 to-neutral-50/60 p-5 md:w-[36%] md:border-b-0 md:border-r md:p-6">
            <div className="mb-5">
              <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                Filter by
              </p>
              {companyName && (
                <p className="mt-1 text-xs font-light text-neutral-400 truncate">
                  at {companyName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {sections.map(({ id, label, icon: Icon }) => {
                const isActive = activeSection === id;
                const isEnabled = sectionEnabled[id];
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSection(id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveSection(id);
                      }
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "group flex w-full cursor-pointer items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all duration-300 ease-in-out",
                      isActive
                        ? "border-[rgba(110,173,192,0.45)] bg-white/40 shadow-[0_0_0_1px_rgba(110,173,192,0.35),0_0_12px_rgba(110,173,192,0.25)]"
                        : "border-transparent bg-white/50 hover:border-neutral-200 hover:bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 transition-colors",
                          isEnabled ? "text-neutral-400" : "text-neutral-300"
                        )}
                      />
                      <p
                        className={cn(
                          "text-sm font-semibold transition-colors",
                          isEnabled ? "text-neutral-900" : "text-neutral-400"
                        )}
                      >
                        {label}
                      </p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => setSectionEnabledFor(id, checked)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Toggle ${label} filter`}
                    />
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main panel: active filter config */}
          <section className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-5 md:px-8 md:pb-5 md:pt-8">
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto pt-4 space-y-4 transition-opacity duration-300",
                sectionEnabled[activeSection] ? "opacity-100" : "opacity-50"
              )}
              aria-disabled={!sectionEnabled[activeSection]}
            >
              <AnimatePresence mode="wait">
                {activeSection === "country" && (
                  <motion.div
                    key="country"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className={PANEL_SURFACE_CLASS}>
                      <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 mb-3">
                        Country of person
                      </p>
                      <CountrySelect
                        value={countryCode}
                        onValueChange={handleCountryChange}
                        className="w-full h-9 border-0 border-b border-neutral-200 rounded-none bg-transparent px-0 py-1 text-[15px] font-light text-neutral-900 shadow-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-b-[var(--kenoo-sky)] data-[state=open]:border-b-[var(--kenoo-sky)] [&_[data-placeholder]]:text-neutral-300 transition-colors"
                      />
                      {countryCode && (
                        <button
                          type="button"
                          onClick={() => setCountryCode("")}
                          className="mt-2.5 text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-400 transition-colors hover:text-neutral-600"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeSection === "title" && (
                  <motion.div
                    key="title"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className={PANEL_SURFACE_CLASS}>
                      <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500 mb-3">
                        Title keywords
                      </p>
                      <input
                        type="text"
                        placeholder="e.g. Brand partnerships, Marketing..."
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                        className="w-full border-0 border-b border-neutral-200 bg-transparent py-1 text-[15px] font-light text-neutral-900 placeholder:text-neutral-300 focus:border-[var(--kenoo-sky)] focus:outline-none transition-colors"
                      />
                    </div>
                  </motion.div>
                )}

                {activeSection === "seniority" && (
                  <motion.div
                    key="seniority"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className={PANEL_SURFACE_CLASS}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                          Seniority levels
                        </p>
                        {seniorities.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSeniorities([])}
                            className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-400 transition-colors hover:text-neutral-600"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {SENIORITY_OPTIONS.map(({ value, label }) => {
                          const isOn = seniorities.includes(value);
                          return (
                            <div
                              key={value}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleSeniority(value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleSeniority(value);
                                }
                              }}
                              className={cn(TOGGLE_ROW_CLASS, "cursor-pointer")}
                            >
                              <p className="text-sm font-light text-neutral-900">
                                {label}
                              </p>
                              <Switch
                                checked={isOn}
                                onCheckedChange={() => toggleSeniority(value)}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`Toggle ${label} seniority`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeSection === "emailStatus" && (
                  <motion.div
                    key="emailStatus"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className={PANEL_SURFACE_CLASS}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
                          Email status
                        </p>
                        {!arraysEqual(emailStatuses, DEFAULT_EMAIL_STATUSES) && (
                          <button
                            type="button"
                            onClick={() => setEmailStatuses(DEFAULT_EMAIL_STATUSES)}
                            className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-400 transition-colors hover:text-neutral-600"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {EMAIL_STATUS_OPTIONS.map(({ value, label }) => {
                          const isOn = emailStatuses.includes(value);
                          return (
                            <div
                              key={value}
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleEmailStatus(value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleEmailStatus(value);
                                }
                              }}
                              className={cn(TOGGLE_ROW_CLASS, "cursor-pointer")}
                            >
                              <p className="text-sm font-light text-neutral-900">
                                {label}
                              </p>
                              <Switch
                                checked={isOn}
                                onCheckedChange={() => toggleEmailStatus(value)}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`Toggle ${label} email status`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200/40 bg-transparent pt-4">
              {hasFilters && (
                <button
                  type="button"
                  onClick={handleReset}
                  className={footerButtonClass}
                >
                  <span className="text-sm font-normal text-neutral-500">Reset</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={footerButtonClass}
              >
                <X className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-red-600/60" />
                <span className="text-sm font-normal text-neutral-800 transition-colors group-hover:text-red-600/60">
                  Cancel
                </span>
              </button>
              <button
                type="button"
                onClick={handleSearch}
                className={footerButtonClass}
              >
                <Search className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-kenoo-sky" />
                <span className="text-sm font-normal text-neutral-800 transition-colors group-hover:text-kenoo-sky">
                  Search
                </span>
              </button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
