"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useAuth } from "@/lib/auth";
import {
  useUploadProfilePicture,
} from "@/hooks/useMutations";
import Image from "next/image";
import { useCallback, useEffect, useState, useRef } from "react";
import { AutocompleteComponent } from "@/components/settings/address-autocomplete";
import { CalendarForm } from "./dob-calendar";
import { Lock, Plus, Minus, Check, X, RotateCcw, Search } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import { COMMON_TIMEZONES, TimezoneGroup } from "@/types/timezone.types";
import { SquareImageCrop } from "@/components/ui/square-image-crop";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileProgressIndicator } from "@/components/settings/talentSettings/profile-progress-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--walls-sky)] bg-transparent w-full placeholder:text-neutral-300";
const labelClass = "text-xs font-normal text-neutral-400 tracking-wide block mb-1";
const readonlyFieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light bg-transparent w-full text-neutral-400 placeholder:text-neutral-300 cursor-not-allowed pr-10";
const selectTriggerClass =
  "w-full border-0 border-b border-neutral-200 rounded-none px-0 py-2 h-auto min-h-0 font-light shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--walls-sky)] bg-transparent";

const AgentSettingsPage = () => {
  const { user } = useAuth();
  
  const [addressNew, setAddressNew] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [existingLinkedInUrl, setExistingLinkedInUrl] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [existingFirstName, setExistingFirstName] = useState<string>("");
  const [existingLastName, setExistingLastName] = useState<string>("");
  const [personalEmail, setPersonalEmail] = useState<string>("");
  const [agencyEmail, setAgencyEmail] = useState<string>("");
  const [existingPersonalEmail, setExistingPersonalEmail] = useState<string>("");
  const [existingAgencyEmail, setExistingAgencyEmail] = useState<string>("");

  const { mutate: uploadMutation } = useUploadProfilePicture();
  const [dob, setDob] = useState<string | null>("");
  const [existingDob, setExistingDob] = useState("");
  const [existingAddress, setExistingAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [existingPhoneNumber, setExistingPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("");
  const [existingTimezone, setExistingTimezone] = useState("");
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [timezoneSearchTerm, setTimezoneSearchTerm] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<TimezoneGroup, boolean>>({} as Record<TimezoneGroup, boolean>);
  const timezoneInputRef = useRef<HTMLInputElement>(null);
  const [isHoveringSave, setIsHoveringSave] = useState(false);
  const [isHoveringCancel, setIsHoveringCancel] = useState(false);
  const [addressResetKey, setAddressResetKey] = useState(0);
  
  const isAddressChanged = addressNew !== "";
  const isDobChanged = dob === null || (dob !== "" && dob !== existingDob);
  const isProfilePictureChanged = profilePicture !== null;
  const isLinkedInChanged = linkedInUrl !== existingLinkedInUrl;
  const isPhoneNumberChanged = phoneNumber !== existingPhoneNumber;
  const isFirstNameChanged = firstName !== existingFirstName;
  const isLastNameChanged = lastName !== existingLastName;
  const isTimezoneChanged = timezone !== existingTimezone;
  const isPersonalEmailChanged = personalEmail !== "" && personalEmail !== existingPersonalEmail;
  
  const savable = isProfilePictureChanged || isAddressChanged || isDobChanged || isLinkedInChanged || isPhoneNumberChanged || isFirstNameChanged || isLastNameChanged || isTimezoneChanged || isPersonalEmailChanged;
  
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  // Fetch user data from Supabase
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        
        // Get user record from users table - users.id now equals user.id directly
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, address, date_of_birth, avatar_url, first_name, last_name, phone_number, timezone, email, personal_email')
          .eq('id', user.id)
          .single();
        
        if (userError) {
          console.error("Error fetching user data:", userError);
          setLoading(false);
          return;
        }
        
        if (userData) {
          setUserId(userData.id);
          
          // Set avatar URL and display name
          if (userData.avatar_url) {
            setUserAvatarUrl(userData.avatar_url);
          }
          const fName = userData.first_name || '';
          const lName = userData.last_name || '';
          setFirstName(fName);
          setLastName(lName);
          setExistingFirstName(fName);
          setExistingLastName(lName);
          setPersonalEmail(userData.personal_email || '');
          setAgencyEmail(userData.email || user?.email || '');
          setExistingPersonalEmail(userData.personal_email || '');
          setExistingAgencyEmail(userData.email || '');
          const fullName = `${fName} ${lName}`.trim() || user?.email || '';
          setUserDisplayName(fullName);
          
          // Set existing address, DOB, and phone number
          if (userData.address) {
            setExistingAddress(userData.address);
          }
          if (userData.date_of_birth) {
            setExistingDob(userData.date_of_birth);
          }
          if (userData.phone_number) {
            setExistingPhoneNumber(userData.phone_number);
            setPhoneNumber(userData.phone_number);
          }
          const savedTimezone = userData.timezone || "";
          setExistingTimezone(savedTimezone);
          setTimezone(savedTimezone);
          
          // Fetch team data to get LinkedIn URL
          const { data: teamData, error: teamError } = await supabase
            .from('team')
            .select('linkedin_url')
            .eq('user_id', userData.id)
            .single();
          
          if (!teamError && teamData?.linkedin_url) {
            setExistingLinkedInUrl(teamData.linkedin_url);
            setLinkedInUrl(teamData.linkedin_url);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user?.id]);

  // Initialize expanded groups - expand first group by default
  useEffect(() => {
    const groups = COMMON_TIMEZONES.reduce((acc, tz) => {
      if (!acc[tz.group]) {
        acc[tz.group] = [];
      }
      acc[tz.group].push(tz);
      return acc;
    }, {} as Record<TimezoneGroup, typeof COMMON_TIMEZONES>);
    
    const groupKeys = Object.keys(groups) as TimezoneGroup[];
    const initialExpanded: Record<TimezoneGroup, boolean> = {} as Record<TimezoneGroup, boolean>;
    groupKeys.forEach((group) => {
      initialExpanded[group] = false; // All groups collapsed by default
    });
    setExpandedGroups(initialExpanded);
  }, []);

  // Filter timezones by search term
  const filteredTimezones = COMMON_TIMEZONES.filter(tz => {
    if (!timezoneSearchTerm.trim()) return true;
    const query = timezoneSearchTerm.toLowerCase();
    return tz.label.toLowerCase().includes(query) || 
           tz.group.toLowerCase().includes(query) ||
           tz.id.toLowerCase().includes(query);
  });

  // Group filtered timezones
  const groupedTimezones = filteredTimezones.reduce((acc, tz) => {
    if (!acc[tz.group]) {
      acc[tz.group] = [];
    }
    acc[tz.group].push(tz);
    return acc;
  }, {} as Record<TimezoneGroup, typeof COMMON_TIMEZONES>);

  const toggleGroup = (group: TimezoneGroup) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
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

  const handleCroppedImage = (croppedImage: File) => {
    setProfilePicture(croppedImage);
    setPreviewUrl(URL.createObjectURL(croppedImage));
    setTempImage(null);
  };

  const updateAddress = async () => {
    if (!userId || !addressNew || addressNew === existingAddress) return true;

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('users')
        .update({ address: addressNew })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      setExistingAddress(addressNew);
      setAddressNew("");
      
      wallsToast.success("Success", "Address updated successfully");
      
      return true;
    } catch (error) {
      console.error("Error updating address:", error);
      wallsToast.error("Error", "Failed to update address");
      
      return false;
    }
  };

  const updatePhoneNumber = async () => {
    if (!userId || phoneNumber === existingPhoneNumber) return true;

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('users')
        .update({ phone_number: phoneNumber })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      setExistingPhoneNumber(phoneNumber);
      
      wallsToast.success("Success", "Phone number updated successfully");
      
      return true;
    } catch (error) {
      console.error("Error updating phone number:", error);
      wallsToast.error("Error", "Failed to update phone number");
      
      return false;
    }
  };

  const updateDob = async () => {
    if (!userId || dob === "" || dob === existingDob) return true;

    try {
      const supabase = getSupabaseClient();

      const dateStr =
        dob === null
          ? null
          : typeof dob === "string"
            ? dob
            : `${(dob as Date).getFullYear()}-${String((dob as Date).getMonth() + 1).padStart(2, "0")}-${String((dob as Date).getDate()).padStart(2, "0")}`;

      const { error } = await supabase
        .from('users')
        .update({ 
          date_of_birth: dateStr
        })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      setExistingDob(dateStr ?? "");
      setDob("");
      
      wallsToast.success(
        "Success",
        dob === null ? "Date of birth removed" : "Date of birth updated successfully"
      );
      
      return true;
    } catch (error) {
      console.error("Error updating date of birth:", error);
      wallsToast.error("Error", "Failed to update date of birth");
      
      return false;
    }
  };

  const updateLinkedIn = async () => {
    if (!userId || linkedInUrl === existingLinkedInUrl) return true;

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('team')
        .update({ linkedin_url: linkedInUrl })
        .eq('user_id', userId);
      
      if (error) {
        throw error;
      }
      
      setExistingLinkedInUrl(linkedInUrl);
      
      wallsToast.success("Success", "LinkedIn URL updated successfully");
      
      return true;
    } catch (error) {
      console.error("Error updating LinkedIn URL:", error);
      wallsToast.error("Error", "Failed to update LinkedIn URL");
      
      return false;
    }
  };

  const updateName = async () => {
    if (!userId) return true;

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('users')
        .update({ 
          first_name: firstName,
          last_name: lastName
        })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      setExistingFirstName(firstName);
      setExistingLastName(lastName);
      
      return true;
    } catch (error) {
      console.error("Error updating name:", error);
      wallsToast.error("Error", "Failed to update name");
      
      return false;
    }
  };

  const updateTimezone = async () => {
    if (!userId || timezone === existingTimezone) return true;

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('users')
        .update({ 
          timezone: timezone || null
        })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      setExistingTimezone(timezone);
      
      wallsToast.success("Success", timezone ? "Timezone updated successfully" : "Timezone set to browser default");
      
      return true;
    } catch (error) {
      console.error("Error updating timezone:", error);
      wallsToast.error("Error", "Failed to update timezone");
      
      return false;
    }
  };

  const updatePersonalEmail = async () => {
    if (!userId || !personalEmail || personalEmail === existingPersonalEmail) return true;

    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('users')
        .update({ 
          personal_email: personalEmail
        })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      setExistingPersonalEmail(personalEmail);
      
      wallsToast.success("Success", "Personal email updated successfully");
      
      return true;
    } catch (error) {
      console.error("Error updating personal email:", error);
      wallsToast.error("Error", "Failed to update personal email");
      
      return false;
    }
  };

  const handleSave = useCallback(async () => {
    let success = true;
    
    if (profilePicture) {
      uploadMutation(profilePicture);
    }
    
    if ((isFirstNameChanged || isLastNameChanged) && userId) {
      const nameSuccess = await updateName();
      if (!nameSuccess) success = false;
    }
    
    if (addressNew && addressNew !== existingAddress && userId) {
      const addressSuccess = await updateAddress();
      if (!addressSuccess) success = false;
    }
    
    if (dob !== "" && dob !== existingDob && userId) {
      const dobSuccess = await updateDob();
      if (!dobSuccess) success = false;
    }

    if (linkedInUrl !== existingLinkedInUrl && userId) {
      const linkedInSuccess = await updateLinkedIn();
      if (!linkedInSuccess) success = false;
    }

    if (phoneNumber !== existingPhoneNumber && userId) {
      const phoneSuccess = await updatePhoneNumber();
      if (!phoneSuccess) success = false;
    }
    
    if (timezone !== existingTimezone && userId) {
      const timezoneSuccess = await updateTimezone();
      if (!timezoneSuccess) success = false;
    }
    
    if (personalEmail && personalEmail !== existingPersonalEmail && userId) {
      const personalEmailSuccess = await updatePersonalEmail();
      if (!personalEmailSuccess) success = false;
    }
    
    if (success) {
      wallsToast.success("Settings saved", "Your changes have been updated");
    }
    
    return success;
  }, [profilePicture, addressNew, existingAddress, dob, existingDob, userId, linkedInUrl, existingLinkedInUrl, phoneNumber, existingPhoneNumber, timezone, existingTimezone, personalEmail, existingPersonalEmail, uploadMutation, isFirstNameChanged, isLastNameChanged, firstName, lastName]);

  const handleRevert = useCallback(() => {
    setProfilePicture(null);
    setPreviewUrl(null);
    setAddressNew("");
    setDob("");
    setFirstName(existingFirstName);
    setLastName(existingLastName);
    setPersonalEmail(existingPersonalEmail);
    setLinkedInUrl(existingLinkedInUrl);
    setPhoneNumber(existingPhoneNumber);
    setTimezone(existingTimezone);
    // Reset address field by incrementing key to force remount
    setAddressResetKey(prev => prev + 1);
    
    wallsToast.success("Changes reverted", "All changes have been discarded");
  }, [existingFirstName, existingLastName, existingPersonalEmail, existingLinkedInUrl, existingPhoneNumber, existingTimezone]);

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-none bg-gray-50">
      <div className="w-full">
        <div className="max-w-5xl mx-auto px-8 pb-8">
          {/* Header */}
          <div className="mb-8 pt-8">
            <div className="flex items-center gap-3 mb-2">
              <ProfileProgressIndicator
                firstName={firstName}
                lastName={lastName}
                personalEmail={personalEmail || existingPersonalEmail}
                agencyEmail={agencyEmail || existingAgencyEmail}
                dateOfBirth={dob === null ? "" : (dob || existingDob)}
                avatarUrl={previewUrl || userAvatarUrl}
                address={addressNew || existingAddress}
                timezone={timezone}
                loading={loading}
              />
              <h1 className="text-3xl font-bold text-foreground">My profile</h1>
            </div>
            <p className="text-sm font-light text-neutral-500">Manage your account settings and preferences</p>
          </div>

          {/* Account Content */}
          <div className="space-y-8">
              {/* Personal Information Divider */}
              <div className="flex items-center mb-8">
                <span className="text-black font-black text-4xl mr-4">Personal information</span>
                <div className="flex-1 border-t border-black h-[1px]" />
              </div>

              {/* Profile Section */}
              <div className="space-y-4">
                <div className="flex gap-8">
                  {/* Profile Picture - Left Side, Vertically Centered */}
                  <div className="flex-shrink-0 flex items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                      id="profile-upload"
                    />
                    <label
                      htmlFor="profile-upload"
                      className="cursor-pointer block relative group"
                    >
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="Profile preview"
                          width={120}
                          height={120}
                          className="rounded-full object-cover"
                          style={{
                            width: "120px",
                            height: "120px",
                          }}
                        />
                      ) : userAvatarUrl && !loading ? (
                        <Image
                          src={userAvatarUrl}
                          alt="Profile photo"
                          width={120}
                          height={120}
                          className="rounded-full object-cover"
                          style={{
                            width: "120px",
                            height: "120px",
                          }}
                        />
                      ) : (
                        <Skeleton className="w-[120px] h-[120px] rounded-full" />
                      )}
                      {/* Hover Overlay */}
                      {(previewUrl || userAvatarUrl) && !loading && (
                        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <Plus className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </label>
                  </div>
                  
                  {/* Name Fields - Right Side, Separate Rows */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label htmlFor="first-name" className={labelClass}>
                        First name
                      </label>
                      <BorderlessInput
                        id="first-name"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={fieldClass}
                        placeholder="First name"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="last-name" className={labelClass}>
                        Last name
                      </label>
                      <BorderlessInput
                        id="last-name"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={fieldClass}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Date of Birth Field - Full Width */}
                <div>
                  <label htmlFor="date-of-birth" className={labelClass}>
                    Date of Birth
                  </label>
                  <CalendarForm
                    existingDob={existingDob}
                    dob={dob}
                    setDob={setDob}
                  />
                </div>
              </div>

              {/* Contact Information Divider */}
              <div className="flex items-center mb-8 mt-8">
                <span className="text-black font-black text-4xl mr-4">Contact information</span>
                <div className="flex-1 border-t border-black h-[1px]" />
              </div>

              {/* Contact Section */}
              <div className="flex gap-4">
                {/* Left Column - Email Fields */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label htmlFor="personal-email" className={labelClass}>
                      Personal email
                    </label>
                    <BorderlessInput
                      id="personal-email"
                      type="email"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      className={fieldClass}
                      placeholder="Personal email address"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="agency-email" className={labelClass}>
                      Agency email
                    </label>
                    <div className="relative">
                      <BorderlessInput
                        id="agency-email"
                        type="email"
                        value={agencyEmail}
                        readOnly
                        className={readonlyFieldClass}
                        placeholder="Agency email address"
                      />
                      <Lock className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                    </div>
                  </div>
                </div>

                {/* Right Column - LinkedIn and Phone */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label htmlFor="linkedin" className={labelClass}>
                      LinkedIn URL
                    </label>
                    <BorderlessInput
                      id="linkedin"
                      type="url"
                      placeholder="https://linkedin.com/in/your-profile"
                      value={linkedInUrl}
                      onChange={(e) => setLinkedInUrl(e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="phone-number" className={labelClass}>
                      Phone Number
                    </label>
                    <BorderlessInput
                      id="phone-number"
                      type="tel"
                      placeholder="+13103878027"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>
              </div>

              {/* Location & Timezone Divider */}
              <div className="flex items-center mb-8 mt-8">
                <span className="text-black font-black text-4xl mr-4">Location & timezone</span>
                <div className="flex-1 border-t border-black h-[1px]" />
              </div>

              {/* Location & Timezone Section */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="address" className={labelClass}>
                    Shipping address
                  </label>
                  <AutocompleteComponent
                    key={addressResetKey}
                    setAddressNew={setAddressNew}
                    existingAddress={existingAddress}
                    inputClassName={fieldClass}
                    placeholder="Enter address"
                  />
                </div>
                
                <div>
                  <label htmlFor="timezone" className={labelClass}>
                    Timezone
                  </label>
                  <Select
                    value={timezone || "browser-default"}
                    open={timezoneOpen}
                    onOpenChange={(isOpen) => {
                      setTimezoneOpen(isOpen);
                      if (!isOpen) {
                        setTimezoneSearchTerm("");
                      } else {
                        setTimeout(() => timezoneInputRef.current?.focus(), 0);
                      }
                    }}
                    onValueChange={(value) => {
                      setTimezone(value === "browser-default" ? "" : value);
                      setTimezoneOpen(false);
                    }}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <span className="font-light text-neutral-900">
                        {timezone
                          ? COMMON_TIMEZONES.find(tz => tz.id === timezone)?.label || "Browser default"
                          : "Browser default"}
                      </span>
                    </SelectTrigger>
                    <SelectContent 
                      className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-[350px] min-w-[350px] max-w-[calc(100vw-2rem)] max-h-[500px] overflow-hidden flex flex-col [&>div]:!p-0 [&>div]:!min-w-0 [&>div]:!w-full [&>div]:!h-auto [&>div]:!max-h-[500px] rounded-lg"
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      position="popper"
                    >
                      {/* Search Input - Sticky */}
                      <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
                        <div className="relative w-full">
                          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                          <input
                            ref={timezoneInputRef}
                            type="text"
                            value={timezoneSearchTerm}
                            onChange={(e) => {
                              e.stopPropagation();
                              setTimezoneSearchTerm(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Escape") {
                                setTimezoneSearchTerm("");
                              }
                            }}
                            placeholder="Search timezones…"
                            className={`w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-4 text-sm font-light transition-colors placeholder:text-neutral-300 focus:outline-none focus-visible:outline-none ${
                              timezoneSearchTerm.trim() ? "border-b-[var(--walls-sky)]" : "border-neutral-200"
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* Timezone List - Scrollable */}
                      <div className="overflow-y-auto flex-1 bg-white/80 backdrop-blur-xl">
                        {/* Browser Default Option */}
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTimezone("");
                            setTimezoneOpen(false);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="relative flex items-center px-4 py-2 pr-16 cursor-pointer rounded-none hover:bg-neutral-100/60"
                        >
                          <div className="flex items-center space-x-3 w-full min-w-0">
                            <div className="flex-1 min-w-0">
                              <span className="block truncate text-sm font-light">Browser default</span>
                            </div>
                          </div>
                          {!timezone && (
                            <span className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[10px] font-light lowercase leading-none tracking-wide text-[var(--walls-sky)]">
                              selected
                            </span>
                          )}
                        </div>
                        {Object.entries(groupedTimezones).map(([group, timezones]) => {
                          const groupKey = group as TimezoneGroup;
                          const isExpanded = expandedGroups[groupKey] ?? false;
                          const selectedTimezone = timezone;
                          
                          return (
                            <div key={group}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  toggleGroup(groupKey);
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                className="flex items-center w-full px-4 py-2 border-b border-neutral-200/60 cursor-pointer bg-white/80 backdrop-blur-xl hover:bg-neutral-100/60 transition-colors"
                              >
                                <span className="text-sm font-light text-gray-700">{group}</span>
                                <div className="flex-1" />
                                {isExpanded ? (
                                  <Minus className="h-4 w-4 text-neutral-600" />
                                ) : (
                                  <Plus className="h-4 w-4 text-neutral-600" />
                                )}
                              </button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                  >
                                    {timezones.length === 0 ? (
                                      <div className="py-2 px-4 text-sm font-light text-gray-500">No timezones found</div>
                                    ) : (
                                      timezones.map((tz) => {
                                        const isSelected = tz.id === selectedTimezone;
                                        return (
                                          <div
                                            key={tz.id}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setTimezone(tz.id);
                                              setTimezoneOpen(false);
                                            }}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                            }}
                                            className="relative flex items-center px-4 py-2 pr-16 cursor-pointer rounded-none hover:bg-neutral-100/60"
                                          >
                                            <div className="flex items-center space-x-3 w-full min-w-0">
                                              <div className="flex-1 min-w-0">
                                                <span className="block truncate text-sm font-light">{tz.label}</span>
                                              </div>
                                            </div>
                                            {isSelected && (
                                              <span className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[10px] font-light lowercase leading-none tracking-wide text-[var(--walls-sky)]">
                                                selected
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Save and Cancel Buttons */}
              <div className="flex justify-start gap-3 pt-8 pb-8">
                <Button
                  onClick={handleSave}
                  disabled={!savable}
                  variant="ghost"
                  onMouseEnter={() => setIsHoveringSave(true)}
                  onMouseLeave={() => setIsHoveringSave(false)}
                  className="relative bg-background backdrop-blur-md border border-neutral-200/50 text-foreground font-normal px-8 py-6 rounded-none hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                >
                  <AnimatePresence>
                    {isHoveringSave && (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.8 }}
                        animate={{ 
                          opacity: 1, 
                          x: 0,
                          scale: 1,
                          transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
                        }}
                        exit={{ 
                          opacity: 0, 
                          x: -10,
                          scale: 0.8,
                          transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
                        }}
                        className="absolute left-4 flex items-center pointer-events-none"
                      >
                        <Check className="h-4 w-4 text-walls-yellow" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.span 
                    className="inline-block"
                    animate={{
                      x: isHoveringSave ? 8 : 0,
                      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
                    }}
                  >
                    Save Changes
                  </motion.span>
                </Button>
                <Button
                  onClick={handleRevert}
                  disabled={!savable}
                  variant="ghost"
                  onMouseEnter={() => setIsHoveringCancel(true)}
                  onMouseLeave={() => setIsHoveringCancel(false)}
                  className="relative bg-background backdrop-blur-md border border-neutral-200/50 text-foreground font-normal px-8 py-6 rounded-none hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                >
                  <AnimatePresence>
                    {isHoveringCancel && (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.8 }}
                        animate={{ 
                          opacity: 1, 
                          x: 0,
                          scale: 1,
                          transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
                        }}
                        exit={{ 
                          opacity: 0, 
                          x: -10,
                          scale: 0.8,
                          transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
                        }}
                        className="absolute left-4 flex items-center pointer-events-none"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.span 
                    className="inline-block"
                    animate={{
                      x: isHoveringCancel ? 8 : 0,
                      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
                    }}
                  >
                    Cancel
                  </motion.span>
                </Button>
              </div>
            </div>
        </div>
      </div>
      {tempImage && (
        <SquareImageCrop
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageUrl={tempImage}
          onCropComplete={handleCroppedImage}
        />
      )}

      <Toaster />
    </div>
  );
};

export default AgentSettingsPage;