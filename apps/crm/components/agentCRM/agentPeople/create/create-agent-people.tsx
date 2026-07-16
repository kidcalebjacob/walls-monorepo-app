"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthContext";
import { createClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Command, Loader2, User, Camera, X, Save, Expand, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import BasicInformation from "../tabs/general";
import Region from "../tabs/region";
import EmploymentHistory from "../tabs/employment-history";
import SystemInformation from "../tabs/system-information";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SquareImageCrop } from "@/components/ui/square-image-crop";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet-view";

/** Same button chrome as view-agent-deals header icons. */
const peopleSheetHeaderIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent active:bg-transparent focus-visible:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50";
const peopleSheetHeaderIconInnerClass = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-100 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
);

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CreateAgentLeadsProps {
  analyticsData: any;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a person is successfully created (so the parent can refresh the list). */
  onSuccess?: () => void;
}

interface LeadFormData {
  firstName: string;
  lastName: string;
  leadName: string;
  email: string;
  company: string;
  companyId?: string;
  source: string;
  status: string;
  region: string;
  city: string;
  state: string;
  title: string;
  linkedin: string;
  phone?: string;
  department?: string;
  operatingCountries?: string[];
  photoURL?: string;
  photo?: string;
  isVerified?: boolean;
  contactOwner?: string | null;
}

const initialFormData: LeadFormData = {
  firstName: "",
  lastName: "",
  leadName: "",
  email: "",
  company: "",
  source: "",
  status: "New",
  region: "",
  city: "",
  state: "",
  title: "",
  linkedin: "",
  phone: "",
  department: "",
  operatingCountries: [],
  photoURL: "",
  photo: "",
  isVerified: false,
  contactOwner: null,
};

export default function CreateAgentLeads({ analyticsData, isOpen, onClose, onSuccess }: CreateAgentLeadsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<LeadFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(true);
  const [draftPersonId, setDraftPersonId] = useState<string | null>(null);
  const [isEnsuringDraftPerson, setIsEnsuringDraftPerson] = useState(false);
  const [hasCompletedSave, setHasCompletedSave] = useState(false);

  const tabs = [
    { id: 'basic', name: 'General' },
    { id: 'region', name: 'Region' },
    { id: 'employment', name: 'Employment History' },
    { id: 'system-information', name: 'System Information' },
  ];

  const checkDuplicateEmail = async (email: string) => {
    if (!email) {
      setDuplicateEmail(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('people')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
        console.error("Error checking duplicate email:", error);
        return;
      }

      if (data) {
        setDuplicateEmail("A lead with this email already exists");
      } else {
        setDuplicateEmail(null);
      }
    } catch (error) {
      console.error("Error checking duplicate email:", error);
    }
  };

  const handleInputChange = (field: keyof LeadFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => {
      const newState = {
        ...prev,
        [field]: value
      };

      // Auto-populate lead name when first or last name changes
      if (field === "firstName" || field === "lastName") {
        const firstName = field === "firstName" ? value : prev.firstName;
        const lastName = field === "lastName" ? value : prev.lastName;
        newState.leadName = [firstName, lastName].filter(Boolean).join(' ');
      }

      return newState;
    });

    if (field === "email") {
      checkDuplicateEmail(value);
    }
  };

  const handleSelectChange = (field: keyof LeadFormData) => (value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value === "none" ? "" : value
    }));
  };

  const buildPersonPayload = () => ({
    first_name: formData.firstName || null,
    last_name: formData.lastName || null,
    email: formData.email || null,
    phone: formData.phone || null,
    title: formData.title || null,
    linkedin_url: formData.linkedin || null,
    company_id: formData.companyId || null,
    company_name: formData.company || null,
    company_website: formData.company
      ? formData.company.startsWith('http')
        ? formData.company
        : `https://${formData.company}`
      : null,
    source: formData.source || null,
    status: formData.status || 'New',
    country: formData.region || null,
    city: formData.city || null,
    state: formData.state || null,
    is_contact: false,
    is_verified: formData.isVerified || false,
    contact_owner: formData.contactOwner || null,
    photo_url: null,
  });

  const ensureDraftPerson = async (): Promise<string | null> => {
    if (draftPersonId) {
      const { error } = await supabase
        .from('people')
        .update(buildPersonPayload())
        .eq('id', draftPersonId);
      if (error) {
        console.error("Error updating draft person:", error);
        return null;
      }
      return draftPersonId;
    }

    try {
      setIsEnsuringDraftPerson(true);
      const { data, error } = await supabase
        .from('people')
        .insert(buildPersonPayload())
        .select('id')
        .single();

      if (error || !data?.id) {
        console.error("Error creating draft person:", error);
        wallsToast.error("Error", "Could not prepare employment history. Please try again.");
        return null;
      }

      setDraftPersonId(data.id);
      return data.id;
    } finally {
      setIsEnsuringDraftPerson(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'employment' && isOpen) {
      void ensureDraftPerson();
    }
  }, [activeTab, isOpen]);

  const handleSheetClose = async () => {
    if (draftPersonId && !hasCompletedSave) {
      await supabase.from('people').delete().eq('id', draftPersonId);
    }
    setDraftPersonId(null);
    setHasCompletedSave(false);
    onClose();
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setTempImage(reader.result as string);
          setShowCropDialog(true);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCroppedImage = async (croppedImage: File) => {
    try {
      setIsLoadingPhoto(true);
      
      // Store the base64 data directly - we'll upload to Storage after creating the document
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(croppedImage);
      });

      setFormData(prev => ({
        ...prev,
        photoURL: base64
      }));

      setTempImage(null);
      wallsToast.success("Success", "Profile picture added successfully");
    } catch (error) {
      console.error("Error processing profile picture:", error);
      wallsToast.error("Error", "Failed to process profile picture");
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  // Remove the fetchProfilePicture function and its useEffect since proxycurl is no longer available
  
  const handleSave = async (createNew: boolean = false) => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to create a lead");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const personData: any = buildPersonPayload();

      let personId: string;

      if (draftPersonId) {
        const { data: existingPerson } = await supabase
          .from('people')
          .select('company_id, company_name, company_website')
          .eq('id', draftPersonId)
          .single();

        if (existingPerson?.company_id) {
          personData.company_id = existingPerson.company_id;
          personData.company_name = existingPerson.company_name;
          personData.company_website = existingPerson.company_website;
        }

        const { error: updateError } = await supabase
          .from('people')
          .update(personData)
          .eq('id', draftPersonId);

        if (updateError) {
          throw updateError;
        }

        personId = draftPersonId;
      } else {
        const { data: person, error: personError } = await supabase
          .from('people')
          .insert(personData)
          .select()
          .single();

        if (personError) {
          throw personError;
        }

        personId = person.id;
      }

      setHasCompletedSave(true);

      // Handle departments if provided
      if (formData.department) {
        await supabase
          .from('people_departments')
          .insert({
            person_id: personId,
            name: formData.department,
          });
      }

      // Handle territories/operating countries
      if (formData.operatingCountries && formData.operatingCountries.length > 0) {
        // First, get or create territory records
        const territoryPromises = formData.operatingCountries.map(async (countryName: string) => {
          // Check if territory exists
          const { data: existingTerritory } = await supabase
            .from('people_territories')
            .select('id')
            .eq('name', countryName)
            .maybeSingle();

          let territoryId: string;
          if (existingTerritory) {
            territoryId = existingTerritory.id;
          } else {
            // Create new territory
            const { data: newTerritory, error: territoryError } = await supabase
              .from('people_territories')
              .insert({ name: countryName })
              .select()
              .single();

            if (territoryError) {
              console.error("Error creating territory:", territoryError);
              return null;
            }
            territoryId = newTerritory.id;
          }

          // Create join record
          return supabase
            .from('people_territories_join')
            .insert({
              person_id: personId,
              territories_id: territoryId,
            });
        });

        await Promise.all(territoryPromises);
      }

      // If we have a base64 photo, upload it using our API route
      if (formData.photoURL && formData.photoURL.startsWith('data:')) {
        try {
          const uploadResponse = await fetch('/api/leads/upload-profile-picture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              leadId: personId,
              imageData: formData.photoURL
            }),
          });

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            // Update person with photo URL
            await supabase
              .from('people')
              .update({ photo_url: uploadData.downloadUrl })
              .eq('id', personId);
          }
        } catch (error) {
          console.error("Error uploading profile picture:", error);
          // Continue with the save process even if the photo upload fails
        }
      }

      wallsToast.success("Success", "Lead created successfully");

      if (createNew) {
        setFormData(initialFormData);
        setDraftPersonId(null);
        setHasCompletedSave(false);
      } else {
        onSuccess?.();
        setHasCompletedSave(true);
        onClose();
        router.push("/agents/crm/people");
      }
    } catch (error) {
      console.error("Error saving lead data:", error);
      wallsToast.error("Error", error instanceof Error ? error.message : "Failed to save lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && void handleSheetClose()}>
      <SheetContent 
        side="right" 
        className={cn("overflow-y-auto p-0 [&>button]:hidden shadow-2xl rounded-none bg-gray-50 border border-neutral-200/80", isMaximized ? "w-full" : "w-3/4")}
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
                {isLoadingPhoto ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-full before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-r before:from-black/40 before:via-transparent before:to-black/40 before:animate-gradient-x">
                    <span className="text-lg font-bold text-kenoo-yellow ai-text-glow relative z-10">AI</span>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  id="profile-upload"
                />
                <label
                  htmlFor="profile-upload"
                  className="cursor-pointer absolute inset-0 rounded-full group"
                >
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </label>
                <AvatarImage 
                  src={
                    (formData.photo && formData.photo !== "https://static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")
                      ? formData.photo
                      : (formData.photoURL && formData.photoURL !== "https://static.licdn.com/aero-v1/sc/h/9c8pery4andzj6ohjkjp54ma2")
                        ? formData.photoURL
                        : undefined
                  } 
                  alt={formData.leadName} 
                  className="object-cover"
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
                  title={formData.leadName || "Lead Name"}
                >
                  {formData.leadName || "Lead Name"}
                </h1>
                <div className="flex-1 min-w-8 shrink border-t border-black h-[1px]" />
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
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
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleSheetClose()}
                    disabled={isSubmitting}
                    className={peopleSheetHeaderIconButtonClass}
                  >
                    <div className="relative">
                      <div className={peopleSheetHeaderIconInnerClass}>
                        <X className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                      </div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleSave(false)}
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
                  </Button>
                </div>
            </div>
            </div>
          </div>
        </div>

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
              draftPersonId ? (
                <EmploymentHistory personId={draftPersonId} />
              ) : (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              )
            )}
            {activeTab === 'system-information' && (
              <SystemInformation
                formData={formData}
                personId={draftPersonId || undefined}
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

      {/* Add the crop dialog */}
      {tempImage && (
        <SquareImageCrop
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageUrl={tempImage}
          onCropComplete={handleCroppedImage}
        />
      )}
    </Sheet>
  );
} 