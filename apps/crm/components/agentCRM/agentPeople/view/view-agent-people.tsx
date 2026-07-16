"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect } from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthContext";
import { createClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Loader2, User, Save, Trash2, Expand, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ConfirmDeletePopup } from "@/components/ui/confirm-delete-popup";
import { HoldRevealDeleteCloseXButton } from "@/components/ui/hold-reveal-delete-close-x-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet-view";
import BasicInformation from "../tabs/general";
import Region from "../tabs/region";
import EmploymentHistory from "../tabs/employment-history";
import SystemInformation from "../tabs/system-information";
import { FaLinkedin, FaTwitter, FaFacebook, FaGithub } from "react-icons/fa";
import Image from "next/image";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface EditAgentPeopleProps {
  analyticsData: any;
  personId: string;
  initialData: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    title?: string;
    headline?: string;
    company_name?: string;
    company_website?: string;
    company_photo_url?: string;
    linkedin_url?: string;
    twitter_url?: string;
    facebook_url?: string;
    github_url?: string;
    photo_url?: string;
    source?: string;
    status?: string;
    country?: string;
    city?: string;
    state?: string;
    seniority?: string;
    time_zone?: string;
    is_contact?: boolean;
    is_verified?: boolean;
    contact_owner?: string | null;
    apollo_contact_id?: string;
    apollo_person_id?: string;
    apollo_organization_id?: string;
    createdAt?: any;
    createdBy?: string;
    updated_at?: any;
    last_contacted?: any;
    last_enriched?: any;
  };
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const peopleSheetHeaderIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent active:bg-transparent focus-visible:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50";
const peopleSheetHeaderIconInnerClass = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-100 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
);

export default function EditAgentPeople({ analyticsData, personId, initialData, isOpen, onClose, onSaved }: EditAgentPeopleProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [formData, setFormData] = useState({
    firstName: initialData.first_name || '',
    lastName: initialData.last_name || '',
    leadName: initialData.first_name && initialData.last_name 
      ? `${initialData.first_name} ${initialData.last_name}`
      : initialData.first_name || initialData.last_name || '',
    email: initialData.email || '',
    phone: initialData.phone || '',
    title: initialData.title || '',
    headline: initialData.headline || '',
    company: initialData.company_name || '',
    companyWebsite: initialData.company_website || '',
    companyPhotoUrl: initialData.company_photo_url || '',
    linkedin: initialData.linkedin_url || '',
    twitter: initialData.twitter_url || '',
    facebook: initialData.facebook_url || '',
    github: initialData.github_url || '',
    photoURL: initialData.photo_url || '',
    source: initialData.source || '',
    status: initialData.status || 'New',
    region: initialData.country || '',
    city: initialData.city || '',
    state: initialData.state || '',
    seniority: initialData.seniority || '',
    timeZone: initialData.time_zone || '',
    isVerified: initialData.is_verified || false,
    contactOwner: initialData.contact_owner || null,
    createdAt: initialData.createdAt,
    createdBy: initialData.createdBy,
    updated_at: initialData.updated_at,
    lastContacted: initialData.last_contacted,
    lastEnriched: initialData.last_enriched,
    apollo_contact_id: initialData.apollo_contact_id || '',
    apollo_person_id: initialData.apollo_person_id || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const [isHoldingComplete, setIsHoldingComplete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const tabs = [
    { id: 'basic', name: 'General' },
    { id: 'region', name: 'Region' },
    { id: 'employment', name: 'Employment History' },
    { id: 'system-information', name: 'System Information' },
  ];

  useEffect(() => {
    const firstName = formData.firstName?.trim() || '';
    const lastName = formData.lastName?.trim() || '';
    const newLeadName = [firstName, lastName].filter(Boolean).join(' ');
    
    if (newLeadName) {
      setFormData(prev => ({
        ...prev,
        leadName: newLeadName
      }));
    }
  }, [formData.firstName, formData.lastName]);

  const checkDuplicateEmail = async (email: string) => {
    if (!email || email === initialData.email) {
      setDuplicateEmail(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('people')
        .select('id')
        .eq('email', email.toLowerCase())
        .neq('id', personId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error checking duplicate email:", error);
        return;
      }

      if (data) {
        setDuplicateEmail("A person with this email already exists");
      } else {
        setDuplicateEmail(null);
      }
    } catch (error) {
      console.error("Error checking duplicate email:", error);
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));

    if (field === "email") {
      checkDuplicateEmail(value);
    }
  };

  const handleSelectChange = (field: string) => (value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to edit a person");
      return;
    }

    if (duplicateEmail) {
      wallsToast.error("Error", duplicateEmail);
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Map form data to Supabase schema
      const updatedData: any = {
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        email: formData.email || null,
        phone: formData.phone || null,
        title: formData.title || null,
        headline: formData.headline || null,
        company_name: formData.company || null,
        company_website: formData.companyWebsite || null,
        linkedin_url: formData.linkedin || null,
        twitter_url: formData.twitter || null,
        facebook_url: formData.facebook || null,
        github_url: formData.github || null,
        photo_url: formData.photoURL || null,
        source: formData.source || null,
        status: formData.status || 'New',
        country: formData.region || null,
        city: formData.city || null,
        state: formData.state || null,
        seniority: formData.seniority || null,
        time_zone: formData.timeZone || null,
        is_verified: formData.isVerified || false,
        contact_owner: formData.contactOwner || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('people')
        .update(updatedData)
        .eq('id', personId);

      if (error) {
        throw error;
      }

      wallsToast.success("Success", "Person updated successfully");

      onClose();
      if (onSaved) onSaved();
      else router.push("/agents/crm/people");
    } catch (error) {
      console.error("Error updating person:", error);
      wallsToast.error("Error", "Failed to update person");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to delete a person");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', personId);

      if (error) {
        throw error;
      }

      wallsToast.negative("Success", "Person deleted successfully");

      onClose();
      if (onSaved) onSaved();
      else router.push("/agents/crm/people");
    } catch (error) {
      console.error("Error deleting person:", error);
      wallsToast.error("Error", "Failed to delete person");
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
    if (isHoldingComplete) return;
    setShowDeleteButton(false);
    onClose();
  };

  // Check for changes in basic information fields
  useEffect(() => {
    const basicInfoFields: (keyof typeof formData)[] = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'title',
      'headline',
      'company',
      'linkedin',
      'twitter',
      'facebook',
      'github',
      'source',
      'status',
      'region',
      'city',
      'state',
      'seniority',
      'timeZone',
      'isVerified',
      'contactOwner',
    ];

    const hasBasicInfoChanges = basicInfoFields.some(field => {
      const emptyDefault = field === 'isVerified' ? false : field === 'contactOwner' ? null : '';
      const currentValue = formData[field] ?? emptyDefault;
      const initialValue = initialData[field === 'firstName' ? 'first_name' : field === 'lastName' ? 'last_name' : field === 'photoURL' ? 'photo_url' : field === 'linkedin' ? 'linkedin_url' : field === 'twitter' ? 'twitter_url' : field === 'facebook' ? 'facebook_url' : field === 'github' ? 'github_url' : field === 'company' ? 'company_name' : field === 'companyWebsite' ? 'company_website' : field === 'region' ? 'country' : field === 'timeZone' ? 'time_zone' : field === 'isVerified' ? 'is_verified' : field === 'contactOwner' ? 'contact_owner' : field] ?? emptyDefault;
      const normalizedCurrent = currentValue == null ? "" : String(currentValue).trim();
      const normalizedInitial = initialValue == null ? "" : String(initialValue).trim();
      return normalizedCurrent !== normalizedInitial;
    });

    setHasChanges(hasBasicInfoChanges);
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
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={
                    formData.photoURL && !formData.photoURL.includes("static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")
                      ? formData.photoURL
                      : FALLBACK_ICON_URL
                  }
                  alt={formData.leadName}
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const fallbackUrl = FALLBACK_ICON_URL;
                    if (target.src !== fallbackUrl) {
                      target.src = fallbackUrl;
                    }
                  }}
                />
                <AvatarFallback className="bg-kenoo-light/5">
                  <User className="h-10 w-10 text-gray-400" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-4 min-w-0">
                <h1
                  className="text-5xl font-black text-foreground leading-tight mt-1 min-w-0 truncate"
                  title={formData.leadName || "Person Name"}
                >
                  {formData.leadName || "Person Name"}
                </h1>
                <div className="flex-1 min-w-8 shrink border-t border-black h-[1px]" />
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="relative group">
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      disabled={isSubmitting}
                      className={peopleSheetHeaderIconButtonClass}
                    >
                      <div className="relative">
                        <div className={peopleSheetHeaderIconInnerClass}>
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
                      iconButtonClass={peopleSheetHeaderIconButtonClass}
                      iconInnerClass={peopleSheetHeaderIconInnerClass}
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
                        className={peopleSheetHeaderIconButtonClass}
                      >
                        <div className="relative">
                          <div className={peopleSheetHeaderIconInnerClass}>
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
                        className={peopleSheetHeaderIconButtonClass}
                      >
                        <div className="relative">
                          <div className={peopleSheetHeaderIconInnerClass}>
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
                {(formData.title || formData.company) && (
                  <span className="bg-white/50 backdrop-blur-sm shadow-inner border border-neutral-200/50 text-neutral-600 font-light text-sm pl-9 pr-4 py-1 rounded-[50px] flex items-center relative">
                    <span className="bg-kenoo-yellow rounded-full flex items-center justify-center absolute left-0 top-0 bottom-0 h-full aspect-square overflow-hidden p-0">
                      {formData.companyPhotoUrl ? (
                        <Image
                          src={formData.companyPhotoUrl}
                          alt={formData.company || "Company"}
                          width={36}
                          height={36}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = FALLBACK_ICON_URL;
                          }}
                        />
                      ) : (
                        <Image
                          src={FALLBACK_ICON_URL}
                          alt="Company"
                          width={36}
                          height={36}
                          className="w-full h-full object-contain"
                        />
                      )}
                    </span>
                    {formData.title}
                  </span>
                )}
                {formData.linkedin && (
                  <a 
                    href={formData.linkedin.startsWith('http') ? formData.linkedin : `https://linkedin.com/in/${formData.linkedin}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaLinkedin className="relative z-10" />
                  </a>
                )}
                {formData.twitter && (
                  <a 
                    href={formData.twitter.startsWith('http') ? formData.twitter : `https://twitter.com/${formData.twitter}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaTwitter className="relative z-10" />
                  </a>
                )}
                {formData.facebook && (
                  <a 
                    href={formData.facebook.startsWith('http') ? formData.facebook : `https://facebook.com/${formData.facebook}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaFacebook className="relative z-10" />
                  </a>
                )}
                {formData.github && (
                  <a 
                    href={formData.github.startsWith('http') ? formData.github : `https://github.com/${formData.github}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-2xl text-black hover:opacity-80 transition-opacity relative group"
                  >
                    <div className="absolute inset-0 -m-2 rounded-[25px] bg-kenoo-yellow scale-0 transition-transform duration-300 ease-in-out group-hover:scale-100" />
                    <FaGithub className="relative z-10" />
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
                duplicateEmail={duplicateEmail}
                handleSelectChange={handleSelectChange}
                personId={personId}
              />
            )}
            {activeTab === 'region' && (
              <Region
                formData={formData}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
              />
            )}
            {activeTab === 'employment' && (
              <EmploymentHistory
                personId={personId}
              />
            )}
            {activeTab === 'system-information' && (
              <SystemInformation
                formData={formData}
                personId={personId}
                isVerified={formData.isVerified}
                onToggleVerified={(checked) => setFormData(prev => ({ ...prev, isVerified: checked }))}
                contactOwner={formData.contactOwner}
                onContactOwnerChange={(ownerId) => setFormData(prev => ({ ...prev, contactOwner: ownerId }))}
              />
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
