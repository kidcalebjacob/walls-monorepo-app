"use client";

import { cn } from "@/lib/utils";
import { COMPANY_DETAIL_TABS, type CompanyDetailTabId } from "./types";

export function CompanyDetailTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: CompanyDetailTabId;
  onTabChange: (tab: CompanyDetailTabId) => void;
}) {
  return (
    <div className="mt-8 border-b border-neutral-200/70">
      <div className="flex gap-0">
        {COMPANY_DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "shrink-0 border-b-2 -mb-px px-5 py-3.5 text-xs font-medium uppercase tracking-widest transition-colors",
              activeTab === tab.id
                ? "border-[var(--walls-sky)] text-neutral-900"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
