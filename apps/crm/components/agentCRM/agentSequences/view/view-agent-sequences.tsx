"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthContext";
import { createClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { Loader2, Save, Trash2, Expand, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDeletePopup } from "@/components/ui/confirm-delete-popup";
import { HoldRevealDeleteCloseXButton } from "@/components/ui/hold-reveal-delete-close-x-button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet-view";
import General from "../tabs/general";
import Steps, { StepsRef } from "../tabs/steps";
import Schedule from "../tabs/schedule";
import Contacts from "../tabs/contacts";
import Tasks from "../tabs/tasks";
import { UnsavedChangesPopup } from "../../ui/unsaved-changes-popup";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface EditAgentSequencesProps {
  analyticsData: any;
  sequenceId: string;
  initialData: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    stop_on_reply: boolean;
    daily_limit: number | null;
    is_campaign: boolean;
    created_at: string | null;
    updated_at: string | null;
    sequence_owner: string;
    owner_avatar_url: string | null;
    contact_count: number;
    active_count: number;
    paused_count: number;
    complete_count: number;
    replied_count: number;
    use_case?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

const sequenceSheetHeaderIconButtonClass =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent active:bg-transparent focus-visible:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0 disabled:opacity-50";
const sequenceSheetHeaderIconInnerClass = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-100 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95",
);

export default function EditAgentSequences({ analyticsData, sequenceId, initialData, isOpen, onClose, onDelete }: EditAgentSequencesProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('steps');
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    description: initialData.description || '',
    status: initialData.status || 'draft',
    stop_on_reply: initialData.stop_on_reply ?? true,
    daily_limit: initialData.daily_limit || null,
    is_campaign: initialData.is_campaign || false,
    createdAt: initialData.created_at,
    updated_at: initialData.updated_at,
    sequence_owner: initialData.sequence_owner || '',
    owner_avatar_url: initialData.owner_avatar_url || '',
    use_case: initialData.use_case || 'general',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const [isHoldingComplete, setIsHoldingComplete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasTemplateChanges, setHasTemplateChanges] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [stepsRemountKey, setStepsRemountKey] = useState(0);
  const stepsRef = useRef<StepsRef>(null);
  const [scheduledTasksCount, setScheduledTasksCount] = useState<number>(0);

  const tabs = [
    { id: 'steps', name: 'Steps' },
    { id: 'contacts', name: 'Contacts' },
    { id: 'schedule', name: 'Schedule' },
    { id: 'tasks', name: 'Tasks' },
    { id: 'general', name: 'General' },
  ];

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectChange = (field: string) => (value: string | boolean | number | null) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to edit a sequence");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Save email templates first if there are changes
      if (hasTemplateChanges && stepsRef.current) {
        await stepsRef.current.saveTemplates();
      }
      
      // Map form data to Supabase schema
      // Note: status and is_campaign are not included - they are handled by the backend/other buttons
      const updatedData: any = {
        name: formData.name || null,
        description: formData.description || null,
        stop_on_reply: formData.stop_on_reply ?? true,
        daily_limit: formData.daily_limit || null,
        sequence_owner: formData.sequence_owner || null,
        use_case: formData.use_case || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('sequences')
        .update(updatedData)
        .eq('id', sequenceId);

      if (error) {
        throw error;
      }

      wallsToast.success("Success", "Sequence updated successfully");

      // Reset change tracking
      setHasTemplateChanges(false);
      setHasChanges(false);
      
      if (pendingClose) {
        onClose();
        setPendingClose(false);
        setShowUnsavedChangesDialog(false);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Error updating sequence:", error);
      wallsToast.error("Error", "Failed to update sequence");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) {
      wallsToast.error("Error", "You must be logged in to delete a sequence");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', sequenceId);

      if (error) {
        throw error;
      }

      wallsToast.negative("Success", "Sequence deleted successfully");

      onDelete?.();
      onClose();
      router.push("/agents/crm/sequences");
    } catch (error) {
      console.error("Error deleting sequence:", error);
      wallsToast.error("Error", "Failed to delete sequence");
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
    
    // Check if there are unsaved changes
    if (hasChanges) {
      setShowUnsavedChangesDialog(true);
      setPendingClose(true);
    } else {
      onClose();
    }
  };

  const handleRevertChanges = () => {
    // Revert form data to initial values
    setFormData({
      name: initialData.name || '',
      description: initialData.description || '',
      status: initialData.status || 'draft',
      stop_on_reply: initialData.stop_on_reply ?? true,
      daily_limit: initialData.daily_limit || null,
      is_campaign: initialData.is_campaign || false,
      createdAt: initialData.created_at,
      updated_at: initialData.updated_at,
      sequence_owner: initialData.sequence_owner || '',
      owner_avatar_url: initialData.owner_avatar_url || '',
      use_case: initialData.use_case || 'general',
    });
    setHasTemplateChanges(false);
    setHasChanges(false);
    
    // Force remount of Steps component to reset template editors
    setStepsRemountKey(prev => prev + 1);
    
    if (pendingClose) {
      onClose();
      setPendingClose(false);
    }
  };

  // Check for changes
  // Note: status and is_campaign are not tracked - they are handled by the backend/other buttons
  useEffect(() => {
    const hasBasicInfoChanges = 
      formData.name !== (initialData.name || '') ||
      formData.description !== (initialData.description || '') ||
      formData.stop_on_reply !== (initialData.stop_on_reply ?? true) ||
      formData.daily_limit !== (initialData.daily_limit || null) ||
      formData.sequence_owner !== (initialData.sequence_owner || '') ||
      formData.use_case !== (initialData.use_case || 'general');

    setHasChanges(hasBasicInfoChanges || hasTemplateChanges);
  }, [formData, initialData, hasTemplateChanges]);

  // Fetch scheduled tasks count
  useEffect(() => {
    const fetchScheduledTasksCount = async () => {
      if (!sequenceId) {
        return;
      }

      try {
        // First, get all sequence_people_ids for this sequence
        const { data: sequencePeopleData } = await supabase
          .from('sequence_people')
          .select('id')
          .eq('sequence_id', sequenceId);
        
        if (!sequencePeopleData || sequencePeopleData.length === 0) {
          setScheduledTasksCount(0);
          return;
        }
        
        const sequencePeopleIds = sequencePeopleData.map(sp => sp.id);
        const now = new Date().toISOString();
        
        // Fetch scheduled task steps count where scheduled_for is in the past
        const { data: tasksData, error: tasksError } = await supabase
          .from('sequence_steps_people_join')
          .select(`
            id,
            scheduled_for,
            sequence_step_join:sequence_steps_join(
              step:sequence_steps(
                is_task
              )
            )
          `)
          .eq('status', 'scheduled')
          .in('sequence_people_id', sequencePeopleIds)
          .lte('scheduled_for', now);

        if (tasksError) {
          console.error("Error fetching scheduled tasks count:", tasksError);
          setScheduledTasksCount(0);
          return;
        }

        // Count only tasks where is_task = true and scheduled_for is in the past
        let count = 0;
        if (tasksData) {
          for (const item of tasksData) {
            const stepJoin = Array.isArray(item.sequence_step_join)
              ? (item.sequence_step_join.length > 0 ? item.sequence_step_join[0] : null)
              : item.sequence_step_join;
            
            const step = stepJoin?.step
              ? (Array.isArray(stepJoin.step) ? stepJoin.step[0] : stepJoin.step)
              : null;
            
            // Check if task is ready (is_task = true and scheduled_for is in the past)
            if (step?.is_task === true && item.scheduled_for) {
              const scheduledTime = new Date(item.scheduled_for);
              const currentTime = new Date();
              if (scheduledTime <= currentTime) {
                count++;
              }
            }
          }
        }

        setScheduledTasksCount(count);
      } catch (error) {
        console.error("Error fetching scheduled tasks count:", error);
        setScheduledTasksCount(0);
      }
    };

    if (sequenceId && isOpen) {
      fetchScheduledTasksCount();
      
      // Refresh count periodically or when tab changes
      const interval = setInterval(fetchScheduledTasksCount, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [sequenceId, isOpen, activeTab]);

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      // Check if there are unsaved changes
      if (hasChanges) {
        setShowUnsavedChangesDialog(true);
        setPendingClose(true);
      } else {
        onClose();
      }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleSheetClose}>
      <SheetContent 
        side="right" 
        className={cn(
          "overflow-x-hidden overscroll-contain p-0 [&>button]:hidden shadow-2xl rounded-none bg-gray-50 border border-neutral-200/80",
          activeTab === "contacts" ? "overflow-hidden" : "overflow-y-auto",
          isMaximized ? "w-full" : "w-3/4"
        )}
        style={{
          transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <motion.div 
          className="flex h-full min-h-0 flex-col"
          layout
          transition={{
            duration: 0.3,
            ease: "easeInOut"
          }}
        >
          <div className={cn(
            "flex-1 w-full px-6 pt-6",
            activeTab === "contacts" ? "flex min-h-0 flex-col pb-0" : "pb-8",
          )}>
        <div className="mb-4 flex items-center justify-between relative z-[2]">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-4 min-w-0">
                <h1
                  className="text-5xl font-black text-foreground leading-tight mt-1 min-w-0 truncate"
                  title={formData.name || "Sequence Name"}
                >
                  {formData.name || "Sequence Name"}
                </h1>
                <div className="flex-1 min-w-8 shrink border-t border-black h-[1px]" />
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="relative group">
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      disabled={isSubmitting}
                      className={sequenceSheetHeaderIconButtonClass}
                    >
                      <div className="relative">
                        <div className={sequenceSheetHeaderIconInnerClass}>
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
                      iconButtonClass={sequenceSheetHeaderIconButtonClass}
                      iconInnerClass={sequenceSheetHeaderIconInnerClass}
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
                        className={sequenceSheetHeaderIconButtonClass}
                      >
                        <div className="relative">
                          <div className={sequenceSheetHeaderIconInnerClass}>
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
                        className={sequenceSheetHeaderIconButtonClass}
                      >
                        <div className="relative">
                          <div className={sequenceSheetHeaderIconInnerClass}>
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
                {formData.description && (
                  <span className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 text-neutral-600 font-normal text-sm px-4 py-1 rounded-[50px]">
                    {formData.description}
                  </span>
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
        
        {/* Tabs underneath description */}
        <div className={cn(
          "flex space-x-1 items-center -ml-2",
          activeTab === "contacts" ? "mt-4" : "mt-8",
        )}>
                {tabs.map((tab) => (
                  <Button 
                    key={tab.id}
                    variant="ghost"
                    className={cn(
                      "relative px-4 py-2 group hover:bg-transparent font-light flex items-center gap-2",
                      activeTab === tab.id 
                        ? "text-neutral-700" 
                        : "text-neutral-700 hover:text-neutral-700"
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span>{tab.name}</span>
                    {tab.id === 'tasks' && scheduledTasksCount > 0 && (
                      <span className="ml-1 text-xs rounded-full px-2 py-0.5 bg-kenoo-yellow/70 text-black font-semibold">
                        {scheduledTasksCount}
                      </span>
                    )}
                    <div className={cn(
                      "absolute bottom-0 left-0 h-0.5 bg-neutral-700 transition-all duration-300",
                      activeTab === tab.id ? "w-4/5 mx-auto right-0" : "w-0 group-hover:w-4/5 group-hover:mx-auto group-hover:right-0"
                    )} />
                  </Button>
                ))}
              </div>

        <div className={cn(
          "relative z-[2]",
          activeTab === "contacts" ? "flex min-h-0 flex-1 flex-col" : "space-y-8",
        )}>
          <div className={cn(activeTab === "contacts" ? "flex min-h-0 flex-1 flex-col" : "mt-6")}>
            {activeTab === 'general' && (
              <General
                formData={formData}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
                sequenceId={sequenceId}
                initialData={initialData}
              />
            )}
            {activeTab === 'steps' && (
              <Steps
                key={stepsRemountKey}
                ref={stepsRef}
                sequenceId={sequenceId}
                onTemplateChange={(hasChanges) => setHasTemplateChanges(hasChanges)}
              />
            )}
            {activeTab === 'schedule' && (
              <Schedule
                sequenceId={sequenceId}
                formData={formData}
                handleSelectChange={handleSelectChange}
              />
            )}
            {activeTab === 'contacts' && (
              <Contacts
                sequenceId={sequenceId}
              />
            )}
            {activeTab === 'tasks' && (
              <Tasks
                sequenceId={sequenceId}
              />
            )}
          </div>
        </div>
          </div>
        </motion.div>
      </SheetContent>
      <Toaster />
      
      {/* Unsaved Changes Dialog */}
      <UnsavedChangesPopup
        isOpen={showUnsavedChangesDialog}
        onClose={() => {
          setShowUnsavedChangesDialog(false);
          setPendingClose(false);
        }}
        onSave={handleSave}
        onRevert={handleRevertChanges}
        isSaving={isSubmitting}
      />
    </Sheet>
  );
}

