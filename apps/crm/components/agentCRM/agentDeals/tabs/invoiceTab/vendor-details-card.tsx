"use client";

import { AutocompleteComponent } from "@/components/address-autocomplete";
import type { AddressType } from "@/components/ui/address-autocomplete";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { VendorBillingInfo } from "./invoice-vendor-shared";
import {
  FALLBACK_IMAGE_URL,
  labelClass,
} from "./invoice-tab-styles";

const noopSetAddress = () => {};
const vendorFieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] bg-transparent placeholder:text-neutral-300";
const vendorSelectTriggerClass =
  "w-full border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] bg-transparent justify-between [&_[data-placeholder]]:text-neutral-300";

export type DealCompanyOption = {
  company_id: string;
  company_name: string;
  role?: string;
  logo_url?: string | null;
};

export type VendorDetailsCardProps = {
  showVendorDetails: boolean;
  onToggleVendorDetails: () => void;
  showVendorInvoiceWarning: boolean;
  vendorInvoiceWarningTooltip: string;
  dealCompanies: DealCompanyOption[];
  selectedCompanyId: string | null;
  onSelectVendor: (companyId: string) => void;
  loadingVendor: boolean;
  vendorInfo: VendorBillingInfo;
  onVendorFieldChange: (field: keyof VendorBillingInfo, value: string) => void;
};

export function VendorDetailsCard({
  showVendorDetails,
  onToggleVendorDetails,
  showVendorInvoiceWarning,
  vendorInvoiceWarningTooltip,
  dealCompanies,
  selectedCompanyId,
  onSelectVendor,
  loadingVendor,
  vendorInfo,
  onVendorFieldChange,
}: VendorDetailsCardProps) {
  const onStructuredPlaceSelected = useCallback(
    (a: AddressType) => {
      const street = [a.address1, a.address2].filter(Boolean).join(", ").trim();
      onVendorFieldChange("address", street);
      onVendorFieldChange("city", a.city);
      onVendorFieldChange("state", a.region);
      onVendorFieldChange("post_code", a.postalCode);
      onVendorFieldChange("country", a.country);
    },
    [onVendorFieldChange],
  );

  return (
    <div className="bg-gray-50 rounded-[30px] p-6">
      <LayoutGroup id="vendor-details-header">
        <motion.div
          layout
          className={`flex items-center gap-2 min-w-0 ${showVendorDetails ? "mb-6" : "mb-0"}`}
          transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {showVendorInvoiceWarning ? (
              <motion.div
                key="vendor-invoice-warning"
                layout
                initial={{ opacity: 0, x: -36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                transition={{
                  layout: { type: "spring", stiffness: 420, damping: 34 },
                  type: "spring",
                  stiffness: 480,
                  damping: 30,
                  mass: 0.65,
                  opacity: { duration: 0.22 },
                }}
                className="shrink-0 origin-left"
              >
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-1 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                        aria-label={vendorInvoiceWarningTooltip}
                      >
                        <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="max-w-[280px] text-left leading-snug"
                    >
                      {vendorInvoiceWarningTooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.h2
            layout
            className="text-black font-black text-4xl min-w-0"
            transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
          >
            VENDOR DETAILS
          </motion.h2>
          <motion.div
            layout
            className="flex-1 border-t border-black h-[1px] mx-2 min-[420px]:mx-4 min-w-[8px]"
            transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
          />
          <motion.button
            layout
            type="button"
            onClick={onToggleVendorDetails}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
          >
            <span className="text-xs font-light text-foreground">See more</span>
            {showVendorDetails ? (
              <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
            ) : (
              <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
            )}
          </motion.button>
        </motion.div>
      </LayoutGroup>

      <AnimatePresence initial={false}>
        {showVendorDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <div
                className={
                  selectedCompanyId
                    ? "mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start"
                    : "mb-6 max-w-md"
                }
              >
                <div className="min-w-0">
                  <label className={labelClass}>Vendor company</label>
                  <Select value={selectedCompanyId ?? "__none__"} onValueChange={onSelectVendor}>
                    <SelectTrigger className={vendorSelectTriggerClass}>
                      <SelectValue placeholder="Select a company linked to this deal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select a company…</SelectItem>
                      {dealCompanies.map((dc) => (
                        <SelectItem key={dc.company_id} value={dc.company_id}>
                          <div className="flex items-center gap-2">
                            {dc.logo_url ? (
                              <Image
                                src={dc.logo_url}
                                alt=""
                                width={20}
                                height={20}
                                className="rounded-full object-cover aspect-square w-5 h-5 shrink-0"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = FALLBACK_IMAGE_URL;
                                }}
                              />
                            ) : null}
                            <span>{dc.company_name || "Unnamed company"}</span>
                            {dc.role ? (
                              <span className="text-muted-foreground text-xs capitalize">({dc.role})</span>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dealCompanies.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      No companies linked to this deal. Add companies on the <strong>Architecture</strong> tab
                      first.
                    </p>
                  )}
                </div>
                {selectedCompanyId ? (
                  <div className="min-w-0">
                    {loadingVendor ? (
                      <div className="flex min-h-[52px] items-center justify-center rounded-[20px] border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-6 text-center text-sm text-muted-foreground">
                        Loading…
                      </div>
                    ) : (
                      <>
                        <label className={labelClass}>Legal name</label>
                        <BorderlessInput
                          value={vendorInfo.legal_name}
                          onChange={(e) => onVendorFieldChange("legal_name", e.target.value)}
                          className={`${vendorFieldClass} h-10`}
                          placeholder="Legal company name"
                        />
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              {selectedCompanyId && (
                <div>
                  {loadingVendor ? null : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div>
                        <label className={labelClass}>Vendor email</label>
                        <BorderlessInput
                          type="email"
                          value={vendorInfo.vendor_email}
                          onChange={(e) => onVendorFieldChange("vendor_email", e.target.value)}
                          className={vendorFieldClass}
                          placeholder="vendor@company.com"
                        />
                      </div>
                      <div className="sm:col-span-2 mt-5">
                        <AutocompleteComponent
                          key={selectedCompanyId ?? "no-company"}
                          setAddressNew={noopSetAddress}
                          existingAddress=""
                          placeholder="Search address"
                          searchInputAppearance="people-toolbar"
                          onStructuredPlaceSelected={onStructuredPlaceSelected}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Street address</label>
                        <BorderlessInput
                          value={vendorInfo.address}
                          onChange={(e) => onVendorFieldChange("address", e.target.value)}
                          className={vendorFieldClass}
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>City</label>
                        <BorderlessInput
                          value={vendorInfo.city}
                          onChange={(e) => onVendorFieldChange("city", e.target.value)}
                          className={vendorFieldClass}
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>State</label>
                        <BorderlessInput
                          value={vendorInfo.state}
                          onChange={(e) => onVendorFieldChange("state", e.target.value)}
                          className={vendorFieldClass}
                          placeholder="State / Region"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Post code</label>
                        <BorderlessInput
                          value={vendorInfo.post_code}
                          onChange={(e) => onVendorFieldChange("post_code", e.target.value)}
                          className={vendorFieldClass}
                          placeholder="Postal code"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Country</label>
                        <BorderlessInput
                          value={vendorInfo.country}
                          onChange={(e) => onVendorFieldChange("country", e.target.value)}
                          className={vendorFieldClass}
                          placeholder="Country"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
