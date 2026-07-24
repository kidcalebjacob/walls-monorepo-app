"use client";

import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Loader2, Save, Trash2, Expand, Minimize, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ConfirmDeletePopup } from "@/components/ui/confirm-delete-popup";
import { HoldRevealDeleteCloseXButton } from "@/components/ui/hold-reveal-delete-close-x-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet-view";
import { AVATAR_FALLBACK_URL } from "@/lib/asset-urls";
import { Partnership } from "../types";
import GeneralTab from "./tabs/general";
import ContentTab from "./tabs/content";

interface ViewPartnershipProps {
  partnershipId: string;
  initialData: Partnership;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const partnershipSheetHeaderIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent active:bg-transparent focus-visible:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50";
const partnershipSheetHeaderIconInnerClass = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-100 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
);

export default function ViewPartnership({
  partnershipId,
  initialData,
  isOpen,
  onClose,
  onSaved,
}: ViewPartnershipProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('general');
  const [formData, setFormData] = useState({ ...initialData });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const [isHoldingComplete, setIsHoldingComplete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setFormData({ ...initialData });
  }, [initialData]);

  const tabs = [
    { id: 'general', name: 'General' },
    { id: 'content', name: 'Posts' },
  ];

  const handleInputChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  // Detect changes
  useEffect(() => {
    const changedFields: (keyof Partnership)[] = ['taggedHandle', 'partnershipUrl'];
    const hasChanged = changedFields.some(field => {
      const cur = String((formData as any)[field] ?? '').trim();
      const init = String((initialData as any)[field] ?? '').trim();
      return cur !== init;
    });
    setHasChanges(hasChanged);
  }, [formData, initialData]);

  const handleSave = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to save");
      return;
    }

    try {
      setIsSubmitting(true);
      const supabase = getSupabaseClient();

      const updateData: any = {
        tagged_handle: formData.taggedHandle || null,
        video_url: formData.partnershipUrl || null,
      };

      const { error } = await supabase
        .from('partnerships')
        .update(updateData)
        .eq('id', partnershipId);

      if (error) throw error;

      wallsToast.success("Success", "Partnership updated successfully");
      if (onSaved) onSaved();
      else onClose();
    } catch (error) {
      console.error("Error updating partnership:", error);
      wallsToast.error("Error", "Failed to update partnership");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to delete");
      return;
    }

    try {
      setIsSubmitting(true);
      const supabase = getSupabaseClient();

      // Delete related records first
      await supabase.from('partnership_content').delete().eq('partnership_id', partnershipId);

      const { error } = await supabase.from('partnerships').delete().eq('id', partnershipId);
      if (error) throw error;

      wallsToast.negative("Success", "Partnership deleted successfully");
      onClose();
      if (onSaved) onSaved();
    } catch (error) {
      console.error("Error deleting partnership:", error);
      wallsToast.error("Error", "Failed to delete partnership");
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
    if (!isHoldingComplete) setShowDeleteButton(false);
    setIsHoldingComplete(false);
  };

  const handleCloseClick = () => {
    if (isHoldingComplete) return;
    setShowDeleteButton(false);
    onClose();
  };

  const talentName = formData.talentName || 'Partnership';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          "overflow-y-auto overflow-x-hidden overscroll-contain p-0 [&>button]:hidden shadow-2xl rounded-none bg-gray-50 border border-neutral-200/80",
          isMaximized ? "w-full" : "w-3/4"
        )}
        style={{ transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        <motion.div
          className="flex flex-col h-full"
          layout
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="flex-1 w-full px-6 pt-6 pb-8">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between relative z-[2]">
              <div className="flex items-center gap-4 flex-1">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={formData.talentAvatar || AVATAR_FALLBACK_URL}
                    alt={talentName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-neutral-100">
                    <Handshake className="h-8 w-8 text-neutral-400" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-4">
                    <h1 className="text-5xl font-black text-foreground max-w-md leading-tight mt-1 truncate">
                      {talentName}
                    </h1>
                    <div className="flex-1 border-t border-black h-[1px]" />
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Maximize/Minimize */}
                      <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        disabled={isSubmitting}
                        className={partnershipSheetHeaderIconButtonClass}
                      >
                        <div className="relative">
                          <div className={partnershipSheetHeaderIconInnerClass}>
                            {isMaximized ? (
                              <Minimize className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                            ) : (
                              <Expand className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Close */}
                      <HoldRevealDeleteCloseXButton
                        disabled={isSubmitting}
                        iconButtonClass={partnershipSheetHeaderIconButtonClass}
                        iconInnerClass={partnershipSheetHeaderIconInnerClass}
                        onCloseClick={handleCloseClick}
                        onHoldStart={handleHoldStart}
                        onHoldComplete={handleHoldComplete}
                        onHoldInterrupt={cancelHold}
                      />

                      {/* Delete (shown on hold) */}
                      {showDeleteButton && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                          <button
                            onClick={() => {
                              setShowDeleteDialog(true);
                              setShowDeleteButton(false);
                              setIsHoldingComplete(false);
                            }}
                            disabled={isSubmitting}
                            className={partnershipSheetHeaderIconButtonClass}
                          >
                            <div className="relative">
                              <div className={partnershipSheetHeaderIconInnerClass}>
                                <Trash2 className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                              </div>
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Save (shown when changed) */}
                      {hasChanges && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                          <button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className={partnershipSheetHeaderIconButtonClass}
                          >
                            <div className="relative">
                              <div className={partnershipSheetHeaderIconInnerClass}>
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
                </div>
              </div>
            </div>

            <ConfirmDeletePopup
              isOpen={showDeleteDialog}
              onClose={() => setShowDeleteDialog(false)}
              onConfirm={handleDelete}
              isSubmitting={isSubmitting}
              title="Delete Partnership?"
            />

            {/* Tabs */}
            <div className="flex space-x-1 items-center -ml-2 mt-8">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  className={cn(
                    "relative px-4 py-2 group hover:bg-transparent font-light",
                    activeTab === tab.id ? "text-neutral-700" : "text-neutral-700 hover:text-neutral-700"
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

            {/* Tab Content */}
            <div className="space-y-8 relative z-[2] mt-6">
              {activeTab === 'general' && (
                <GeneralTab
                  formData={formData}
                  handleInputChange={handleInputChange}
                />
              )}
              {activeTab === 'content' && (
                <ContentTab contentItems={formData.contentItems || []} />
              )}
            </div>
          </div>
        </motion.div>
      </SheetContent>
      <Toaster />
    </Sheet>
  );
}
