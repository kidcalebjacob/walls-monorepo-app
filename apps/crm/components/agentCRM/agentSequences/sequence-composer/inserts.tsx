"use client";

import { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Braces,
  User,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Building2,
  Globe,
  Calendar,
  Plus,
  Minus,
  Sparkles,
  Search,
} from "lucide-react";
import { EditorRef } from "@/components/agentCRM/emailComposer/components/editor/editor";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FieldDefinition {
  key: string;
  label: string;
  icon: React.ReactNode;
  category?: string;
}

const personFields: FieldDefinition[] = [
  { key: "person.first_name", label: "First name", icon: <User className="h-4 w-4" />, category: "Basic information" },
  { key: "person.last_name", label: "Last name", icon: <User className="h-4 w-4" />, category: "Basic information" },
  { key: "person.title", label: "Job title", icon: <Briefcase className="h-4 w-4" />, category: "Basic information" },
  { key: "person.phone", label: "Phone number", icon: <Phone className="h-4 w-4" />, category: "Basic information" },
  { key: "person.email", label: "Email", icon: <Mail className="h-4 w-4" />, category: "Basic information" },
  { key: "person.city", label: "City", icon: <MapPin className="h-4 w-4" />, category: "Location" },
  { key: "person.state", label: "State", icon: <MapPin className="h-4 w-4" />, category: "Location" },
  { key: "person.country", label: "Country", icon: <MapPin className="h-4 w-4" />, category: "Location" },
  { key: "person.headline", label: "Headline", icon: <Briefcase className="h-4 w-4" />, category: "Profile" },
  { key: "person.seniority", label: "Seniority", icon: <Briefcase className="h-4 w-4" />, category: "Profile" },
  { key: "person.linkedin_url", label: "LinkedIn URL", icon: <Globe className="h-4 w-4" />, category: "Social" },
  { key: "person.twitter_url", label: "Twitter URL", icon: <Globe className="h-4 w-4" />, category: "Social" },
  { key: "person.github_url", label: "GitHub URL", icon: <Globe className="h-4 w-4" />, category: "Social" },
  { key: "person.facebook_url", label: "Facebook URL", icon: <Globe className="h-4 w-4" />, category: "Social" },
];

const companyFields: FieldDefinition[] = [
  { key: "company.name", label: "Company name", icon: <Building2 className="h-4 w-4" />, category: "Basic information" },
  { key: "company.domain", label: "Domain", icon: <Globe className="h-4 w-4" />, category: "Basic information" },
  { key: "company.website", label: "Website", icon: <Globe className="h-4 w-4" />, category: "Basic information" },
  { key: "company.phone", label: "Phone", icon: <Phone className="h-4 w-4" />, category: "Basic information" },
  { key: "custom.similar_partner", label: "Similar partner", icon: <User className="h-4 w-4" />, category: "Custom" },
  { key: "company.employee_count", label: "Employee count", icon: <User className="h-4 w-4" />, category: "Details" },
  { key: "company.industry", label: "Industry", icon: <Briefcase className="h-4 w-4" />, category: "Details" },
  { key: "company.founding_year", label: "Founding year", icon: <Calendar className="h-4 w-4" />, category: "Details" },
  { key: "company.annual_revenue", label: "Annual revenue", icon: <Briefcase className="h-4 w-4" />, category: "Details" },
  { key: "company.city", label: "City", icon: <MapPin className="h-4 w-4" />, category: "Location" },
  { key: "company.country", label: "Country", icon: <MapPin className="h-4 w-4" />, category: "Location" },
  { key: "company.address", label: "Address", icon: <MapPin className="h-4 w-4" />, category: "Location" },
  { key: "company.overview", label: "Overview", icon: <Briefcase className="h-4 w-4" />, category: "Details" },
];

const spintaxSnippets: { label: string; insertText: string; category: string }[] = [
  { label: "Greeting", insertText: "{{spin.Hi|Hello|Hey}}", category: "Greetings" },
  { label: "Greeting + name", insertText: "{{spin.Hi|Hello|Hey}} {{person.first_name}},", category: "Greetings" },
  { label: "Formal greeting", insertText: "{{spin.Good morning|Good afternoon|Hello}},", category: "Greetings" },
  { label: "Quick opener", insertText: "{{spin.Hope you're well|Hope all is well|Hope this finds you well}}.", category: "Greetings" },
  { label: "Best", insertText: "{{spin.Best|Cheers|Thanks|Regards}}", category: "Closings" },
  { label: "Sign-off", insertText: "{{spin.Looking forward to connecting|Talk soon|Speak soon|Cheers}}", category: "Closings" },
  { label: "Thanks closing", insertText: "{{spin.Thanks again|Thank you|Appreciate your time}}.", category: "Closings" },
  { label: "Warm closing", insertText: "{{spin.Best regards|Warm regards|Kind regards}}", category: "Closings" },
  { label: "Call to action", insertText: "{{spin.Would love to connect|Happy to jump on a call|Let me know if you'd like to chat}}.", category: "Closings" },
];

interface FieldInserterButtonProps {
  editorRef: React.RefObject<EditorRef>;
}

export function FieldInserterButton({ editorRef }: FieldInserterButtonProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"person" | "company" | "spintax" | "custom">("person");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const editor = editorRef.current?.getEditor();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearchQuery("");
    }
  }, [open]);

  const isCategoryExpanded = (tab: string, category: string) => {
    const key = `${tab}-${category}`;
    // If we've explicitly toggled this category, respect that state
    if (Object.prototype.hasOwnProperty.call(expandedCategories, key)) {
      return expandedCategories[key];
    }
    // Default behavior: for Person & Company, only "Basic information" starts open
    if (tab === "person" || tab === "company") {
      return category === "Basic information";
    }
    // For Spintax and any other tabs, default to expanded
    return true;
  };

  const setCategoryExpanded = (tab: string, category: string, value: boolean) => {
    setExpandedCategories((prev) => ({ ...prev, [`${tab}-${category}`]: value }));
  };

  const toggleCategory = (tab: string, category: string) => {
    setCategoryExpanded(tab, category, !isCategoryExpanded(tab, category));
  };

  const insertContent = (text: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
    setOpen(false);
    setSearchQuery("");
  };

  const handleFieldClick = (fieldKey: string) => {
    insertContent(`{{${fieldKey}}}`);
  };

  const handleSpintaxClick = (insertText: string) => {
    insertContent(insertText);
  };

  const filterFields = (fields: FieldDefinition[]) => {
    if (!searchQuery.trim()) return fields;
    const q = searchQuery.toLowerCase();
    return fields.filter(
      (f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    );
  };

  const filterSpintax = () => {
    if (!searchQuery.trim()) return spintaxSnippets;
    const q = searchQuery.toLowerCase();
    return spintaxSnippets.filter(
      (s) => s.label.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  };

  const groupByCategory = (fields: FieldDefinition[]) => {
    const grouped: Record<string, FieldDefinition[]> = {};
    fields.forEach((field) => {
      const cat = field.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(field);
    });
    return grouped;
  };

  const groupSpintaxByCategory = () => {
    const grouped: Record<string, typeof spintaxSnippets> = {};
    filterSpintax().forEach((s) => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });
    return grouped;
  };

  const customFields = companyFields.filter((f) => f.category === "Custom");
  const filteredPerson = filterFields(personFields);
  const filteredCompany = filterFields(companyFields.filter((f) => f.category !== "Custom"));
  const filteredCustom = filterFields(customFields);
  const personByCategory = groupByCategory(filteredPerson);
  const companyByCategory = groupByCategory(filteredCompany);

  const renderPersonContent = () => {
    if (filteredPerson.length === 0)
      return <div className="px-4 py-2 text-sm font-light text-gray-500">No fields found</div>;
    return (
      <>
        {Object.entries(personByCategory).map(([category, categoryFields]) => {
          if (categoryFields.length === 0) return null;
          const expanded = isCategoryExpanded("person", category);
          return (
            <div key={category}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleCategory("person", category);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="flex w-full cursor-pointer items-center border-b border-neutral-200/60 bg-neutral-50/40 px-4 py-2 transition-colors hover:bg-neutral-100/60"
              >
                <span className="text-sm font-light text-neutral-800">{category}</span>
                <div className="flex-1" />
                {expanded ? (
                  <Minus className="h-4 w-4 shrink-0 text-neutral-400" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-neutral-400" />
                )}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {categoryFields.map((field) => (
                      <button
                        key={field.key}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFieldClick(field.key);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="relative flex w-full cursor-pointer items-center rounded-none px-4 py-2 text-left hover:bg-neutral-100/60 focus:bg-neutral-100/60"
                      >
                        <div className="flex min-w-0 w-full items-center space-x-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                            {field.icon}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-light">{field.label}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </>
    );
  };

  const renderCompanyContent = () => {
    if (filteredCompany.length === 0)
      return <div className="px-4 py-2 text-sm font-light text-gray-500">No fields found</div>;
    return (
      <>
        {Object.entries(companyByCategory).map(([category, categoryFields]) => {
          if (categoryFields.length === 0) return null;
          const expanded = isCategoryExpanded("company", category);
          return (
            <div key={category}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleCategory("company", category);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="flex w-full cursor-pointer items-center border-b border-neutral-200/60 bg-neutral-50/40 px-4 py-2 transition-colors hover:bg-neutral-100/60"
              >
                <span className="text-sm font-light text-neutral-800">{category}</span>
                <div className="flex-1" />
                {expanded ? (
                  <Minus className="h-4 w-4 shrink-0 text-neutral-400" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-neutral-400" />
                )}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {categoryFields.map((field) => (
                      <button
                        key={field.key}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFieldClick(field.key);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="relative flex w-full cursor-pointer items-center rounded-none px-4 py-2 text-left hover:bg-neutral-100/60 focus:bg-neutral-100/60"
                      >
                        <div className="flex min-w-0 w-full items-center space-x-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                            {field.icon}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-light">{field.label}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </>
    );
  };

  const renderCustomContent = () => {
    if (filteredCustom.length === 0)
      return <div className="px-4 py-2 text-sm font-light text-gray-500">No custom fields found</div>;
    return (
      <div className="py-1">
        {filteredCustom.map((field) => (
          <button
            key={field.key}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFieldClick(field.key);
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="relative flex w-full cursor-pointer items-center rounded-none px-4 py-2 text-left hover:bg-neutral-100/60 focus:bg-neutral-100/60"
          >
            <div className="flex min-w-0 w-full items-center space-x-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                {field.icon}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-light">{field.label}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderSpintaxContent = () => {
    const grouped = groupSpintaxByCategory();
    const entries = Object.entries(grouped);
    if (entries.length === 0)
      return <div className="px-4 py-2 text-sm font-light text-gray-500">No spintax found</div>;
    return (
      <>
        {entries.map(([category, snippets]) => {
          if (snippets.length === 0) return null;
          const expanded = isCategoryExpanded("spintax", category);
          return (
            <div key={category}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  toggleCategory("spintax", category);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="flex w-full cursor-pointer items-center border-b border-neutral-200/60 bg-neutral-50/40 px-4 py-2 transition-colors hover:bg-neutral-100/60"
              >
                <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-light text-neutral-800">{category}</span>
                <div className="flex-1" />
                {expanded ? (
                  <Minus className="h-4 w-4 shrink-0 text-neutral-400" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-neutral-400" />
                )}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {snippets.map((snippet, idx) => (
                      <button
                        key={`${snippet.category}-${snippet.label}-${idx}`}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSpintaxClick(snippet.insertText);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="relative flex w-full cursor-pointer items-center rounded-none px-4 py-2 text-left hover:bg-neutral-100/60 focus:bg-neutral-100/60"
                      >
                        <div className="flex min-w-0 w-full items-center space-x-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-light">{snippet.label}</span>
                            <span className="block truncate text-xs font-light text-neutral-500">
                              {snippet.insertText}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <Select value="" open={open} onOpenChange={(isOpen) => setOpen(isOpen)} onValueChange={() => {}}>
      <SelectTrigger className="relative group hover:bg-transparent p-0 w-10 h-10 flex items-center justify-center border-0 shadow-none bg-transparent focus:ring-0 focus:ring-offset-0 flex-shrink-0">
        <div className="relative">
          <div className="relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95">
            <Braces className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500 flex-shrink-0" />
          </div>
        </div>
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className={cn(
          "!z-[9999] flex max-h-[min(500px,var(--radix-select-content-available-height))] flex-col overflow-hidden rounded-lg bg-white/80 p-0 shadow-2xl backdrop-blur-xl",
          "[&>div]:!p-0",
          "max-w-[calc(100vw-2rem)] w-[max(var(--radix-select-trigger-width),min(21rem,calc(100vw-2rem)))]"
        )}
      >
        <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                e.stopPropagation();
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") setSearchQuery("");
              }}
              placeholder="Search fields or spintax…"
              className={cn(
                "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-2 text-sm font-light transition-colors placeholder:text-neutral-300 focus:border-b-[var(--kenoo-sky)] focus:outline-none focus-visible:outline-none",
                searchQuery.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
              )}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="flex shrink-0 border-b border-neutral-200/60 bg-white/80 backdrop-blur-xl">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setActiveTab("person");
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-light transition-colors",
              activeTab === "person"
                ? "border-b-2 border-[var(--kenoo-sky)] text-neutral-900"
                : "border-b-2 border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Person
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setActiveTab("company");
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-light transition-colors",
              activeTab === "company"
                ? "border-b-2 border-[var(--kenoo-sky)] text-neutral-900"
                : "border-b-2 border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Company
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setActiveTab("spintax");
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-light transition-colors",
              activeTab === "spintax"
                ? "border-b-2 border-[var(--kenoo-sky)] text-neutral-900"
                : "border-b-2 border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Spintax
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setActiveTab("custom");
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-light transition-colors",
              activeTab === "custom"
                ? "border-b-2 border-[var(--kenoo-sky)] text-neutral-900"
                : "border-b-2 border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Custom
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto bg-white/80 backdrop-blur-xl"
          onWheel={(e) => e.stopPropagation()}
        >
          {activeTab === "person" && renderPersonContent()}
          {activeTab === "company" && renderCompanyContent()}
          {activeTab === "spintax" && renderSpintaxContent()}
          {activeTab === "custom" && renderCustomContent()}
        </div>
      </SelectContent>
    </Select>
  );
}
