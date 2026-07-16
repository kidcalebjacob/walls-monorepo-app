"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthContext";
import { createClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Command, Loader2, Save, Trash2, Expand, Minimize, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ConfirmDeletePopup } from "@/components/ui/confirm-delete-popup";
import { HoldRevealDeleteCloseXButton } from "@/components/ui/hold-reveal-delete-close-x-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet-view";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import BasicInformation from "../tabs/general";
import VendorInformation from "../tabs/vendor-information";
import DepartmentHeadcount from "../tabs/company-people";
import Architecture from "../tabs/architecture";
import BrandRepresentation from "../tabs/brand-representation";
import SystemInformation from "../tabs/system-information";
import {
  BARE_DOMAIN_ERROR,
  bareDomainToWebsite,
  normalizeBareDomain,
} from "../lib/domain-utils";
import { FaLinkedin, FaTwitter, FaFacebook, FaGlobe } from "react-icons/fa";

interface EditAgentCompaniesProps {
  analyticsData: any;
  companyId: string;
  onEmailClick?: (email: string, e: React.MouseEvent) => void;
  onAddToSequence?: (personId: string, e: React.MouseEvent) => void;
  initialData: {
    organization_name: string;
    logo: string;
    domain?: string;
    website: string;
    linkedinUrl: string;
    twitterUrl: string;
    facebookUrl: string;
    annualRevenue: string;
    employeeCount: string;
    industry: string;
    foundingYear: string;
    country: string;
    vendorCompanyName: string;
    vendorCountry: string;
    vendorState: string;
    vendorCity: string;
    vendorStreetAddress: string;
    vendorZipCode: string;
    vendorContact: string;
    vendorInfoId?: string;
    shortDescription: string;
    createdAt: any;
    createdBy: string;
    apolloOrganizationId: string;
    apolloAccountId: string;
    alexaRanking: string;
    lastEnriched: any;
    phone: string;
    retail_location_count: string;
    updatedAt: any;
    departmentalHeadCount?: any;
    current_technologies?: Array<{ name: string; category: string | null }>;
    suborganizations?: Array<{ id: string; name: string; website_url?: string; apollo_organization_id: string; created_at: any }>;
    funding_events?: Array<{ id: string; event_id: string | null; type: string | null; amount: string | null; currency: string | null; date: string | null; investors: string | null; news_url: string | null; created_at: any }>;
    is_representative?: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const companySheetHeaderIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent active:bg-transparent focus-visible:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50";
const companySheetHeaderIconInnerClass = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-100 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
);

export default function EditAgentCompanies({ analyticsData, companyId, initialData, isOpen, onClose, onEmailClick, onAddToSequence, onSaved }: EditAgentCompaniesProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [formData, setFormData] = useState({
    ...initialData,
    is_representative: initialData.is_representative ?? false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const logoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isHoldingComplete, setIsHoldingComplete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Build tabs array conditionally based on is_representative
  const baseTabs = [
    { id: 'basic', name: 'General' },
    { id: 'people', name: 'People' },
    { id: 'architecture', name: 'Architecture' },
  ];

  const tabs = formData.is_representative
    ? [...baseTabs, { id: 'brand-representation', name: 'Brand Representation' }, { id: 'vendor', name: 'Vendor Information' }, { id: 'system-information', name: 'System Information' }]
    : [...baseTabs, { id: 'vendor', name: 'Vendor Information' }, { id: 'system-information', name: 'System Information' }];

  const handleInputChange = (field: keyof typeof initialData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectChange = (field: string) => (value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBooleanChange = (field: string) => async (value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));

    // Immediately save is_representative to database
    if (field === 'is_representative') {
      try {
        const { error } = await supabase
          .from('companies')
          .update({ is_representative: value })
          .eq('id', companyId);

        if (error) {
          console.error("Error updating is_representative:", error);
          wallsToast.error("Error", "Failed to update representative status");
          // Revert the change on error
          setFormData((prev) => ({
            ...prev,
            [field]: !value
          }));
        }
      } catch (error) {
        console.error("Error updating is_representative:", error);
        wallsToast.error("Error", "Failed to update representative status");
        // Revert the change on error
        setFormData((prev) => ({
          ...prev,
          [field]: !value
        }));
      }
    }
  };

  const handleContactChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      vendorContact: value
    }));
  };

  const handleCompanyLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      wallsToast.error("Invalid file", "Please upload an image file.");
      e.target.value = "";
      return;
    }

    try {
      setIsUploadingLogo(true);
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("companyId", companyId);

      const response = await fetch("/api/upload-company-logo", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload company logo");
      }

      const data = await response.json();
      const nextLogoUrl = data.downloadUrl as string;

      setFormData((prev) => ({
        ...prev,
        logo: nextLogoUrl,
      }));

      wallsToast.success("Success", "Company logo updated successfully.");

      if (onSaved) onSaved();
    } catch (error) {
      console.error("Error uploading company logo:", error);
      const message = error instanceof Error ? error.message : "Failed to upload company logo";
      wallsToast.error("Upload failed", message);
    } finally {
      setIsUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to edit a company");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const rawDomainInput = (formData.domain || '').trim();
      let newDomain: string | null = null;
      if (rawDomainInput) {
        newDomain = normalizeBareDomain(rawDomainInput);
        if (!newDomain) {
          wallsToast.error("Invalid domain", BARE_DOMAIN_ERROR);
          return;
        }
      }

      const isLinkingDomain = Boolean(newDomain && newDomain !== (initialData.domain || null));
      const websiteFromDomain = newDomain ? bareDomainToWebsite(newDomain) : null;

      // Map form data to Supabase schema
      const updatedData: any = {
        name: formData.organization_name || null,
        logo_url: formData.logo || null,
        website: isLinkingDomain ? websiteFromDomain : (formData.website || null),
        annual_revenue: formData.annualRevenue ? parseFloat(formData.annualRevenue) : null,
        employee_count: formData.employeeCount ? parseInt(formData.employeeCount) : null,
        industry: formData.industry || null,
        founding_year: formData.foundingYear ? parseInt(formData.foundingYear) : null,
        country: formData.country || null,
        phone: formData.phone || null,
        apollo_organization_id: formData.apolloOrganizationId || null,
        alexa_ranking: formData.alexaRanking ? parseInt(formData.alexaRanking) : null,
        overview: formData.shortDescription || null,
        is_representative: Boolean(formData.is_representative),
        updated_at: new Date().toISOString(),
      };

      if (isLinkingDomain) {
        updatedData.domain = newDomain;
      }

      const { error } = await supabase
        .from('companies')
        .update(updatedData)
        .eq('id', companyId);

      if (error) {
        throw error;
      }

      // Create the companies_domains entry the first time a domain is linked
      if (isLinkingDomain && newDomain) {
        await supabase
          .from('companies_domains')
          .insert({
            company_id: companyId,
            domain: newDomain,
            is_primary: true,
            url: websiteFromDomain,
          });
      }

      // Save vendor information to companies_vendor_information
      const vendorPayload = {
        legal_name: (formData.vendorCompanyName || '').trim() || formData.organization_name || '',
        city: (formData.vendorCity || '').trim() || null,
        state: (formData.vendorState || '').trim() || null,
        country: (formData.vendorCountry || '').trim() || null,
        address: (formData.vendorStreetAddress || '').trim() || null,
        post_code: (formData.vendorZipCode || '').trim() || null,
        vendor_email: (formData.vendorContact || '').trim() || null,
      };

      const vendorInfoId = (formData as any).vendorInfoId;
      if (vendorInfoId) {
        const { error: vendorError } = await supabase
          .from('companies_vendor_information')
          .update(vendorPayload)
          .eq('id', vendorInfoId);
        if (vendorError) throw vendorError;
      } else {
        const { data: insertedVendor, error: vendorError } = await supabase
          .from('companies_vendor_information')
          .insert({ company_id: companyId, ...vendorPayload })
          .select('id')
          .single();
        if (vendorError) throw vendorError;
        if (insertedVendor) {
          setFormData(prev => ({ ...prev, vendorInfoId: insertedVendor.id }));
        }
      }

      wallsToast.success("Success", "Company updated successfully");

      onClose();
      if (onSaved) onSaved();
      else router.push("/agents/crm/companies");
    } catch (error) {
      console.error("Error updating company:", error);
      wallsToast.error("Error", "Failed to update company");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to delete a company");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) {
        throw error;
      }

      wallsToast.negative("Success", "Company deleted successfully");

      onClose();
      if (onSaved) onSaved();
      else router.push("/agents/crm/companies");
    } catch (error) {
      console.error("Error deleting company:", error);
      wallsToast.error("Error", "Failed to delete company");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHoldStart = () => {
    setIsHoldingComplete(false);
  };

  const handleHoldComplete = () => {
    setIsHoldingComplete(true);
    setShowDeleteButton(true);
  };

  const cancelHold = () => {
    if (!isHoldingComplete) {
      setShowDeleteButton(false);
    }
    setIsHoldingComplete(false);
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    if (isHoldingComplete) return; // do nothing if hold succeeded
    setShowDeleteButton(false);
    onClose();
  };

  // Check for changes in basic information and vendor fields
  useEffect(() => {
    const basicInfoFields: (keyof typeof initialData)[] = [
      'shortDescription',
      'organization_name',
      'country',
      'industry',
      'foundingYear',
      'annualRevenue',
      'phone',
      'retail_location_count',
      'domain'
    ];

    const vendorInfoFields: (keyof typeof initialData)[] = [
      'vendorCompanyName',
      'vendorCountry',
      'vendorState',
      'vendorCity',
      'vendorStreetAddress',
      'vendorZipCode',
      'vendorContact',
    ];

    const fieldsToCheck = [...basicInfoFields, ...vendorInfoFields];

    const hasAnyChanges = fieldsToCheck.some(field => {
      const currentValue = formData[field] ?? '';
      const initialValue = initialData[field] ?? '';
      // Normalize values for comparison (handle null, undefined, empty strings)
      const normalizedCurrent = String(currentValue).trim();
      const normalizedInitial = String(initialValue).trim();
      return normalizedCurrent !== normalizedInitial;
    });

    setHasChanges(hasAnyChanges);
  }, [formData, initialData]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className={cn(
          "overflow-y-auto overflow-x-hidden overscroll-contain p-0 [&>button]:hidden shadow-2xl rounded-none bg-gray-50 border border-neutral-200/80",
          isMaximized ? "w-full" : "w-3/4"
        )}
        style={{
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <motion.div 
          className="flex flex-col h-full"
          layout
          transition={{
            duration: 0.3,
            ease: "easeInOut"
          }}
        >
          <div className="flex-1 w-full px-6 pt-6 pb-8">
        <div className="mb-4 flex items-center justify-between relative z-[2]">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative">
              <input
                ref={logoUploadInputRef}
                id={`company-logo-upload-${companyId}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCompanyLogoUpload}
                disabled={isUploadingLogo}
              />
              <label
                htmlFor={`company-logo-upload-${companyId}`}
                className={cn(
                  "group block cursor-pointer rounded-full",
                  isUploadingLogo && "pointer-events-none"
                )}
              >
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={formData.logo || undefined}
                    alt={formData.organization_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-kenoo-light/5">
                    <Plus className="h-6 w-6 text-gray-400" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex items-center justify-center">
                  {isUploadingLogo ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5 text-white" />
                  )}
                </div>
              </label>
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-4 min-w-0">
                <h1
                  className="text-5xl font-black text-foreground leading-tight mt-1 min-w-0 truncate"
                  title={formData.organization_name || "Company Name"}
                >
                  {formData.organization_name || "Company Name"}
                </h1>
                <div className="flex-1 min-w-8 shrink border-t border-black h-[1px]" />
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="relative group">
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      disabled={isSubmitting}
                      className={companySheetHeaderIconButtonClass}
                    >
                      <div className="relative">
                        <div className={companySheetHeaderIconInnerClass}>
                          {isMaximized ? (
                            <Minimize className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                          ) : (
                            <Expand className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                  <div className="relative group">
                    <HoldRevealDeleteCloseXButton
                      disabled={isSubmitting}
                      iconButtonClass={companySheetHeaderIconButtonClass}
                      iconInnerClass={companySheetHeaderIconInnerClass}
                      onCloseClick={handleCloseClick}
                      onHoldStart={handleHoldStart}
                      onHoldComplete={handleHoldComplete}
                      onHoldInterrupt={cancelHold}
                    />
                  </div>

                  {showDeleteButton && (
                    <div className="relative group animate-in fade-in slide-in-from-left-2 duration-200">
                      <button
                        onClick={() => {
                          setShowDeleteDialog(true);
                          setShowDeleteButton(false);
                          setIsHoldingComplete(false);
                        }}
                        disabled={isSubmitting}
                        className={companySheetHeaderIconButtonClass}
                      >
                        <div className="relative">
                          <div className={companySheetHeaderIconInnerClass}>
                            <Trash2 className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {hasChanges && (
                    <div className="relative group animate-in fade-in slide-in-from-left-2 duration-200">
                      <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className={companySheetHeaderIconButtonClass}
                      >
                        <div className="relative">
                          <div className={companySheetHeaderIconInnerClass}>
                            {isSubmitting ? (
                              <Loader2 className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500 animate-spin" />
                            ) : (
                              <Save className="h-[18px] w-[18px] stroke-[1.5] text-neutral-500" />
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {formData.website && (
                  <a 
                    href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaGlobe className="relative z-10" />
                  </a>
                )}
                {formData.linkedinUrl && (
                  <a 
                    href={formData.linkedinUrl.startsWith('http') ? formData.linkedinUrl : `https://linkedin.com/company/${formData.linkedinUrl}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaLinkedin className="relative z-10" />
                  </a>
                )}
                {formData.twitterUrl && (
                  <a 
                    href={formData.twitterUrl.startsWith('http') ? formData.twitterUrl : `https://twitter.com/${formData.twitterUrl}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaTwitter className="relative z-10" />
                  </a>
                )}
                {formData.facebookUrl && (
                  <a 
                    href={formData.facebookUrl.startsWith('http') ? formData.facebookUrl : `https://facebook.com/${formData.facebookUrl}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaFacebook className="relative z-10" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <ConfirmDeletePopup
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          isSubmitting={isSubmitting}
        />
        
        {/* Tabs underneath social icons */}
        <div className="flex space-x-1 items-center -ml-2 mt-8">
                {tabs.map((tab) => (
                  <Button 
                    key={tab.id}
                    variant="ghost"
                    className={cn(
                      "relative px-4 py-2 group hover:bg-transparent font-light",
                      activeTab === tab.id 
                        ? "text-neutral-700" 
                        : "text-neutral-700 hover:text-neutral-700"
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.name}
                    <div className={cn(
                      "absolute bottom-0 left-0 h-0.5 bg-neutral-700 transition-all duration-300",
                      activeTab === tab.id ? "w-4/5 mx-auto right-0" : "w-0 group-hover:w-4/5 group-hover:mx-auto group-hover:right-0"
                    )} />
                  </Button>
                ))}
              </div>

        <div className="space-y-8 relative z-[2]">
          <div className="mt-6">
            {activeTab === 'basic' && (
              <BasicInformation
                formData={formData}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
                savedDomain={initialData.domain}
              />
            )}
            {activeTab === 'vendor' && (
              <VendorInformation
                formData={formData}
                handleInputChange={handleInputChange}
                handleContactChange={handleContactChange}
              />
            )}
            {activeTab === 'people' && (
              <DepartmentHeadcount formData={formData} handleInputChange={handleInputChange} companyId={companyId} apolloOrganizationId={formData.apolloOrganizationId} companyWebsite={formData.website} apolloAccountId={formData.apolloAccountId} companyName={formData.organization_name} onEmailClick={onEmailClick} onAddToSequence={onAddToSequence} />
            )}
            {activeTab === 'architecture' && (
              <Architecture formData={formData} handleInputChange={handleInputChange} handleBooleanChange={handleBooleanChange} />
            )}
            {activeTab === 'brand-representation' && (
              <BrandRepresentation companyId={companyId} />
            )}
            {activeTab === 'system-information' && (
              <SystemInformation formData={formData} />
            )}
          </div>
        </div>
          </div>
        </motion.div>
      </SheetContent>
      <Toaster />
    </Sheet>
  );
} 