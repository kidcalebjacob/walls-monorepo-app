"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { createClient } from '@supabase/supabase-js';
import { ChevronDown, ChevronUp, Plus, Mail, Clock, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FaInstagram, FaLinkedin } from "react-icons/fa";
import Image from "next/image";
import { StepDelayPopup } from "../ui/step-delay-popup";
import { EmailTemplateEditor, EmailTemplateEditorRef } from "../sequence-composer/editor";
import AddStepPopup from "../ui/add-step-popup";
import { ArchiveStepPopup } from "../ui/archive-step-popup"; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StepsProps {
  sequenceId: string;
  onTemplateChange?: (hasChanges: boolean) => void;
  onSaveTemplates?: () => Promise<void>;
}

export interface StepsRef {
  saveTemplates: () => Promise<void>;
}

interface SequenceStep {
  id: string;
  step_index: number;
  delay_minutes: number;
  step: {
    id: string;
    slug: string;
    name: string;
    is_task: boolean;
    channel: string;
    description: string | null;
  } | null;
}

const Steps = forwardRef<StepsRef, StepsProps>(({ sequenceId, onTemplateChange }, ref) => {
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<{ [key: number]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [addingStep, setAddingStep] = useState(false);
  const [delayPopupOpen, setDelayPopupOpen] = useState(false);
  const [selectedStepForDelay, setSelectedStepForDelay] = useState<{ id: string; delayMinutes: number } | null>(null);
  const [addStepPopupOpen, setAddStepPopupOpen] = useState(false);
  const [archivePopupOpen, setArchivePopupOpen] = useState(false);
  const [selectedStepForArchive, setSelectedStepForArchive] = useState<{ id: string; isAutoEmail: boolean } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const editorRefs = useRef<{ [key: string]: EmailTemplateEditorRef | null }>({});

  // Expose save function to parent
  useImperativeHandle(ref, () => ({
    saveTemplates: async () => {
      // Save all email template editors that have changes
      const savePromises = Object.values(editorRefs.current)
        .filter(editorRef => editorRef && editorRef.hasChanges)
        .map(editorRef => editorRef!.save());
      
      await Promise.all(savePromises);
    },
  }), []);

  const AUTO_EMAIL_STEP_ID = '8e9856d1-9480-46bc-86d9-fa9653128a88'; // Initial email step
  const AUTO_FOLLOW_UP_STEP_ID = '663b6577-8256-419a-8888-f4fab2c16928'; // Follow-up email step

  // Refetch steps when a new step is added
  const handleStepAdded = async () => {
    // Refetch steps to get the updated list
    const fetchSteps = async () => {
      if (!sequenceId) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('sequence_steps_join')
          .select(`
            id,
            step_index,
            delay_minutes,
            step:sequence_steps(
              id,
              slug,
              name,
              is_task,
              channel,
              description
            )
          `)
          .eq('sequence_id', sequenceId)
          .eq('is_archived', false)
          .order('step_index', { ascending: true });

        if (error) {
          console.error("Error fetching sequence steps:", error);
          return;
        }

        // Handle Supabase join response - step might be an array or object
        const formattedSteps = (data || []).map((item: any) => ({
          id: item.id,
          step_index: item.step_index,
          delay_minutes: item.delay_minutes,
          step: Array.isArray(item.step) 
            ? (item.step.length > 0 ? item.step[0] : null)
            : item.step
        }));
        
        setSteps(formattedSteps);
        
        // Initialize new steps as collapsed
        const updatedExpanded: { [key: number]: boolean } = {};
        formattedSteps.forEach((_, index) => {
          updatedExpanded[index] = expandedSteps[index] || false;
        });
        setExpandedSteps(updatedExpanded);
      } catch (error) {
        console.error("Error fetching sequence steps:", error);
      }
    };

    await fetchSteps();
  };

  useEffect(() => {
    const fetchSteps = async () => {
      if (!sequenceId) {
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('sequence_steps_join')
          .select(`
            id,
            step_index,
            delay_minutes,
            step:sequence_steps(
              id,
              slug,
              name,
              is_task,
              channel,
              description
            )
          `)
          .eq('sequence_id', sequenceId)
          .eq('is_archived', false)
          .order('step_index', { ascending: true });

        if (error) {
          console.error("Error fetching sequence steps:", error);
          setSteps([]);
        } else {
          // Handle Supabase join response - step might be an array or object
          const formattedSteps = (data || []).map((item: any) => ({
            id: item.id,
            step_index: item.step_index,
            delay_minutes: item.delay_minutes,
            step: Array.isArray(item.step) 
              ? (item.step.length > 0 ? item.step[0] : null)
              : item.step
          }));
          setSteps(formattedSteps);
          // Initialize all steps as collapsed
          const initialExpanded: { [key: number]: boolean } = {};
          formattedSteps.forEach((_, index) => {
            initialExpanded[index] = false;
          });
          setExpandedSteps(initialExpanded);
        }
      } catch (error) {
        console.error("Error fetching sequence steps:", error);
        setSteps([]);
      } finally {
        setLoading(false);
      }
    };

    if (sequenceId) {
      fetchSteps();
    }
  }, [sequenceId]);

  const formatDelay = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `${days} day${days !== 1 ? 's' : ''}`;
      }
      return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
  };

  const formatDelayForDisplay = (minutes: number) => {
    if (minutes === 0) {
      return "Immediately";
    }
    // Convert minutes to days (1440 minutes = 1 day)
    const days = Math.floor(minutes / 1440);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getChannelIcon = (channel: string | null | undefined) => {
    if (!channel) return null;
    
    const channelLower = channel.toLowerCase();
    
    if (channelLower === 'instagram') {
      return <FaInstagram className="h-6 w-6 text-black" />;
    } else if (channelLower === 'linkedin') {
      return <FaLinkedin className="h-6 w-6 text-black" />;
    } else if (channelLower === 'email') {
      return <Mail className="h-6 w-6 text-black" />;
    } else if (channelLower === 'walls') {
      return (
        <Image 
          src="/images/app-icons/crm.svg"
          alt="WALLS logo"
          width={24}
          height={24}
          className="h-6 w-6"
        />
      );
    }
    
    return null;
  };

  const handleDelayClick = (stepId: string, currentDelay: number) => {
    setSelectedStepForDelay({ id: stepId, delayMinutes: currentDelay });
    setDelayPopupOpen(true);
  };

  const handleDelaySave = async (delayMinutes: number) => {
    if (!selectedStepForDelay) return;

    try {
      const { error } = await supabase
        .from('sequence_steps_join')
        .update({ 
          delay_minutes: delayMinutes,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedStepForDelay.id);

      if (error) {
        console.error("Error updating step delay:", error);
        wallsToast.error("Error", "Failed to update step delay");
        return;
      }

      // Update local state
      setSteps(prev => prev.map(step => 
        step.id === selectedStepForDelay.id 
          ? { ...step, delay_minutes: delayMinutes }
          : step
      ));

      wallsToast.success("Success", "Step delay updated successfully");
    } catch (error) {
      console.error("Error updating step delay:", error);
      wallsToast.error("Error", "Failed to update step delay");
    }
  };

  const handleAddStepClick = () => {
    setAddStepPopupOpen(true);
  };

  const handleMoveStep = async (stepId: string, currentIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && currentIndex === 0) return; // Can't move first step up
    if (direction === 'down' && currentIndex === steps.length - 1) return; // Can't move last step down

    const currentStep = steps[currentIndex];
    const isAutoFollowUp = currentStep?.step?.id === AUTO_FOLLOW_UP_STEP_ID;
    const isAutoEmail = currentStep?.step?.id === AUTO_EMAIL_STEP_ID;

    // If moving up an auto_follow_up step, check if it would go above the auto_email step
    if (direction === 'up' && isAutoFollowUp) {
      // Find the index of the auto_email step
      const autoEmailIndex = steps.findIndex(s => s.step?.id === AUTO_EMAIL_STEP_ID);
      
      if (autoEmailIndex !== -1) {
        const newIndex = currentIndex - 1;
        // Prevent moving auto_follow_up above auto_email
        if (newIndex <= autoEmailIndex) {
          wallsToast.error("Cannot Move Step", "Follow-up emails must come after the initial email");
          return;
        }
      }
    }

    // If moving down an auto_email step, check if the next step is an auto_follow_up
    if (direction === 'down' && isAutoEmail) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep?.step?.id === AUTO_FOLLOW_UP_STEP_ID) {
        wallsToast.error("Cannot Move Step", "The initial email must come before follow-up emails");
        return;
      }
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetStep = steps[newIndex];

    try {
      const now = new Date().toISOString();
      
      // Swap the step_index values and update timestamps
      const { error: error1 } = await supabase
        .from('sequence_steps_join')
        .update({ 
          step_index: newIndex,
          updated_at: now
        })
        .eq('id', stepId);

      if (error1) {
        console.error("Error moving step:", error1);
        wallsToast.error("Error", "Failed to move step");
        return;
      }

      const { error: error2 } = await supabase
        .from('sequence_steps_join')
        .update({ 
          step_index: currentIndex,
          updated_at: now
        })
        .eq('id', targetStep.id);

      if (error2) {
        console.error("Error moving step:", error2);
        wallsToast.error("Error", "Failed to move step");
        return;
      }

      // Refetch steps to get updated order
      await handleStepAdded();

      wallsToast.success("Success", `Step moved ${direction === 'up' ? 'up' : 'down'} successfully`);
    } catch (error) {
      console.error("Error moving step:", error);
      wallsToast.error("Error", "Failed to move step");
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    // Find the step being deleted to check if it's the auto_email step
    const stepToDelete = steps.find(s => s.id === stepId);
    const isAutoEmail = stepToDelete?.step?.id === AUTO_EMAIL_STEP_ID;

    // Check if there are enrolled contacts for this step (or follow-up steps if auto_email)
    try {
      let stepIdsToCheck = [stepId];
      
      // If deleting auto_email, also check follow-up steps
      if (isAutoEmail) {
        const followUpSteps = steps.filter(
          s => s.step?.id === AUTO_FOLLOW_UP_STEP_ID
        );
        stepIdsToCheck = [stepId, ...followUpSteps.map(s => s.id)];
      }

      // Check if any contacts are enrolled in these steps
      const { data: enrolledContacts, error: checkError } = await supabase
        .from('sequence_steps_people_join')
        .select('id')
        .in('sequence_step_join_id', stepIdsToCheck)
        .limit(1);

      if (checkError) {
        console.error("Error checking enrolled contacts:", checkError);
        // If we can't check, proceed with normal deletion flow
      } else if (enrolledContacts && enrolledContacts.length > 0) {
        // Contacts are enrolled - show archive popup directly
        console.log(`[Step Deletion] Step ${stepId} has enrolled contacts. Showing archive popup.`);
        setSelectedStepForArchive({ id: stepId, isAutoEmail });
        setArchivePopupOpen(true);
        return;
      }
    } catch (error) {
      console.error("Error checking enrolled contacts:", error);
      // If check fails, proceed with normal deletion flow
    }

    // No enrolled contacts - show confirmation dialog
    const confirmMessage = isAutoEmail
      ? "Are you sure you want to delete the initial email? This will also delete all follow-up emails in this sequence."
      : "Are you sure you want to delete this step?";

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // If deleting auto_email, also delete all auto_follow_up steps
      if (isAutoEmail) {
        // First, find all auto_follow_up step join IDs
        const followUpSteps = steps.filter(
          s => s.step?.id === AUTO_FOLLOW_UP_STEP_ID
        );

        // Delete all follow-up steps
        if (followUpSteps.length > 0) {
          const followUpIds = followUpSteps.map(s => s.id);
          const { error: followUpDeleteError } = await supabase
            .from('sequence_steps_join')
            .delete()
            .in('id', followUpIds);

          if (followUpDeleteError) {
            console.error("Error deleting follow-up steps:", followUpDeleteError);
            
            // Check if error is due to foreign key constraint
            const isForeignKeyError = followUpDeleteError.code === '23503' || 
              followUpDeleteError.message?.toLowerCase().includes('foreign key') ||
              followUpDeleteError.message?.toLowerCase().includes('violates foreign key constraint');
            
            if (isForeignKeyError) {
              console.log(`[Step Deletion] Cannot delete follow-up steps for step ${stepId} - foreign key constraint violation. Contacts are enrolled in these steps.`);
              console.log(`[Step Deletion] Error details:`, {
                code: followUpDeleteError.code,
                message: followUpDeleteError.message,
                details: followUpDeleteError.details,
                hint: followUpDeleteError.hint
              });
              // Show archive popup instead
              setSelectedStepForArchive({ id: stepId, isAutoEmail });
              setArchivePopupOpen(true);
              return;
            }
            
            wallsToast.error("Warning", "Failed to delete some follow-up steps");
          }
        }
      }

      // Delete the main step
      const { error: deleteError } = await supabase
        .from('sequence_steps_join')
        .delete()
        .eq('id', stepId);

      if (deleteError) {
        console.error("Error deleting step:", deleteError);
        
        // Check if error is due to foreign key constraint (contacts enrolled)
        const isForeignKeyError = deleteError.code === '23503' || 
          deleteError.message?.toLowerCase().includes('foreign key') ||
          deleteError.message?.toLowerCase().includes('violates foreign key constraint');
        
        if (isForeignKeyError) {
          console.log(`[Step Deletion] Cannot delete step ${stepId} - foreign key constraint violation. Contacts are enrolled in this step.`);
          console.log(`[Step Deletion] Error details:`, {
            code: deleteError.code,
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint
          });
          // Show archive popup instead of error toast
          setSelectedStepForArchive({ id: stepId, isAutoEmail });
          setArchivePopupOpen(true);
          return;
        }
        
        wallsToast.error("Error", "Failed to delete step");
        return;
      }

      // Refetch remaining steps
      const { data: remainingSteps, error: fetchError } = await supabase
        .from('sequence_steps_join')
        .select('id, step_index')
        .eq('sequence_id', sequenceId)
        .eq('is_archived', false)
        .order('step_index', { ascending: true });

      if (fetchError) {
        console.error("Error fetching remaining steps:", fetchError);
        wallsToast.error("Error", "Failed to reorder steps after deletion");
        // Still refetch the full list to update UI
        await handleStepAdded();
        return;
      }

      // Reorder step_index values to be sequential (0, 1, 2, 3, ...)
      if (remainingSteps && remainingSteps.length > 0) {
        const now = new Date().toISOString();
        const updatePromises = remainingSteps.map((step, newIndex) =>
          supabase
            .from('sequence_steps_join')
            .update({ 
              step_index: newIndex,
              updated_at: now
            })
            .eq('id', step.id)
        );

        const updateResults = await Promise.all(updatePromises);
        const hasUpdateError = updateResults.some(result => result.error);

        if (hasUpdateError) {
          console.error("Error reordering steps:", updateResults);
          wallsToast.error("Warning", "Step deleted but failed to reorder remaining steps");
        }
      }

      // Refetch steps to get updated list with correct indices
      await handleStepAdded();

      wallsToast.success(
        "Success",
        isAutoEmail
          ? "Initial email and follow-up steps deleted successfully"
          : "Step deleted successfully"
      );
    } catch (error) {
      console.error("Error deleting step:", error);
      
      // Check if error is due to foreign key constraint
      const errorObj = error as any;
      const isForeignKeyError = errorObj?.code === '23503' || 
        errorObj?.message?.toLowerCase().includes('foreign key') ||
        errorObj?.message?.toLowerCase().includes('violates foreign key constraint');
      
      if (isForeignKeyError) {
        console.log(`[Step Deletion] Cannot delete step ${stepId} - foreign key constraint violation (caught in catch block). Contacts are enrolled in this step.`);
        console.log(`[Step Deletion] Error details:`, {
          code: errorObj?.code,
          message: errorObj?.message,
          details: errorObj?.details,
          hint: errorObj?.hint
        });
        const stepToDelete = steps.find(s => s.id === stepId);
        const isAutoEmail = stepToDelete?.step?.id === AUTO_EMAIL_STEP_ID;
        setSelectedStepForArchive({ id: stepId, isAutoEmail });
        setArchivePopupOpen(true);
        return;
      }
      
      wallsToast.error("Error", "Failed to delete step");
    }
  };

  const handleArchiveStep = async () => {
    if (!selectedStepForArchive) return;

    try {
      setIsArchiving(true);
      const { id: stepId, isAutoEmail } = selectedStepForArchive;

      // If archiving auto_email, also archive all auto_follow_up steps
      if (isAutoEmail) {
        // First, find all auto_follow_up step join IDs
        const followUpSteps = steps.filter(
          s => s.step?.id === AUTO_FOLLOW_UP_STEP_ID
        );

        // Archive all follow-up steps
        if (followUpSteps.length > 0) {
          const followUpIds = followUpSteps.map(s => s.id);
          const now = new Date().toISOString();
          const { error: followUpArchiveError } = await supabase
            .from('sequence_steps_join')
            .update({ 
              is_archived: true,
              archived_at: now,
              updated_at: now
            })
            .in('id', followUpIds);

          if (followUpArchiveError) {
            console.error("Error archiving follow-up steps:", followUpArchiveError);
            wallsToast.error("Warning", "Failed to archive some follow-up steps");
          }
        }
      }

      // Archive the main step
      const now = new Date().toISOString();
      const { error: archiveError } = await supabase
        .from('sequence_steps_join')
        .update({ 
          is_archived: true,
          archived_at: now,
          updated_at: now
        })
        .eq('id', stepId);

      if (archiveError) {
        console.error("Error archiving step:", archiveError);
        wallsToast.error("Error", "Failed to archive step");
        return;
      }

      // Refetch remaining steps
      const { data: remainingSteps, error: fetchError } = await supabase
        .from('sequence_steps_join')
        .select('id, step_index')
        .eq('sequence_id', sequenceId)
        .eq('is_archived', false)
        .order('step_index', { ascending: true });

      if (fetchError) {
        console.error("Error fetching remaining steps:", fetchError);
        wallsToast.error("Error", "Failed to reorder steps after archiving");
        // Still refetch the full list to update UI
        await handleStepAdded();
        return;
      }

      // Reorder step_index values to be sequential (0, 1, 2, 3, ...)
      if (remainingSteps && remainingSteps.length > 0) {
        const now = new Date().toISOString();
        const updatePromises = remainingSteps.map((step, newIndex) =>
          supabase
            .from('sequence_steps_join')
            .update({ 
              step_index: newIndex,
              updated_at: now
            })
            .eq('id', step.id)
        );

        const updateResults = await Promise.all(updatePromises);
        const hasUpdateError = updateResults.some(result => result.error);

        if (hasUpdateError) {
          console.error("Error reordering steps:", updateResults);
          wallsToast.error("Warning", "Step archived but failed to reorder remaining steps");
        }
      }

      // Refetch steps to get updated list with correct indices
      await handleStepAdded();

      console.log(`[Step Archive] Successfully archived step ${stepId}${isAutoEmail ? ' and all follow-up steps' : ''}`);
      
      wallsToast.success(
        "Success",
        isAutoEmail
          ? "Initial email and follow-up steps archived successfully"
          : "Step archived successfully"
      );
    } catch (error) {
      console.error("Error archiving step:", error);
      wallsToast.error("Error", "Failed to archive step");
    } finally {
      setIsArchiving(false);
    }
  };

  const MIN_EMAIL_DELAY_MINUTES = 3 * 1440; // 3 days

  const isShortEmailDelay = (step: SequenceStep, index: number): boolean => {
    if (step.step?.id !== AUTO_FOLLOW_UP_STEP_ID) return false;
    const prevStep = steps[index - 1];
    if (!prevStep) return false;
    const prevIsEmail = prevStep.step?.id === AUTO_EMAIL_STEP_ID || prevStep.step?.id === AUTO_FOLLOW_UP_STEP_ID;
    return prevIsEmail && step.delay_minutes < MIN_EMAIL_DELAY_MINUTES;
  };

  const totalSteps = steps.length;

  return (
    <div className="space-y-6">
      {/* Steps Header */}
      <div className="flex items-center">
        <h2 className="text-black font-black text-4xl">STEPS</h2>
        <div className="flex-1 border-t border-black h-[1px] mx-4" />
        <div className="flex items-center gap-3">
          <p className="text-black font-black text-4xl">{totalSteps}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleAddStepClick}
            disabled={addingStep}
            className="h-8 w-8 rounded-full hover:bg-gray-200 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Step Containers */}
      {steps.length === 0 ? (
        <div className="flex items-center justify-center min-h-[400px] py-12">
          <Button
            onClick={handleAddStepClick}
            variant="ghost"
            className="relative hover:bg-transparent p-0"
          >
            <motion.div
              className="relative z-10 p-3 bg-gray-50 backdrop-blur-md rounded-full border-0 px-6"
              whileHover={{
                backgroundColor: "rgb(249 250 251)",
                boxShadow: "inset 0 3px 6px rgba(0, 0, 0, 0.25)",
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              style={{
                boxShadow: "none",
                y: 0,
              }}
            >
              <span className="font-light text-slate-600">+ Add step</span>
            </motion.div>
          </Button>
        </div>
      ) : (
        steps.map((step, index) => (
          <div key={step.id || index} className="space-y-2">
            {/* Delay Container - Above step */}
            <div className="flex justify-center items-center mb-6">
              <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center mr-1">
                  <AnimatePresence>
                    {isShortEmailDelay(step, index) && (
                      <motion.div
                        key={`delay-warning-${step.id}`}
                        initial={{ opacity: 0, x: -12, scale: 0.85 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.9, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
                        transition={{ type: "spring", stiffness: 480, damping: 30, mass: 0.65, opacity: { duration: 0.22 } }}
                        className="shrink-0 origin-right"
                      >
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="shrink-0 rounded-full p-1 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                                aria-label="Delay is less than the recommended 3 days"
                              >
                                <AlertTriangle className="h-5 w-5" strokeWidth={2} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              align="center"
                              sideOffset={8}
                              className="max-w-[240px] text-left leading-snug"
                            >
                              A minimum 3 day delay is recommended for this step.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => handleDelayClick(step.id, step.delay_minutes)}
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-neutral-300/30 bg-white/60 backdrop-blur-sm backdrop-saturate-150 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_22px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out hover:border-white/55 hover:bg-gray-50/70 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99] cursor-pointer"
                >
                  <Clock className="h-3.5 w-3.5 text-neutral-700" strokeWidth={1.75} />
                  <span className="text-[11px] font-light text-neutral-800">
                    {formatDelayForDisplay(step.delay_minutes)}
                  </span>
                  <Pencil className="h-3.5 w-3.5 text-neutral-700" strokeWidth={1.75} />
                </button>

                <div className="w-8 h-8 ml-1" aria-hidden="true" />
              </div>
            </div>
            {/* Step Container */}
            <div className="flex items-center gap-3">
              {/* Step Content */}
              <div className="flex-1 bg-gray-50 rounded-[30px] p-6">
                <div className="flex items-center">
                <div className="flex items-center gap-3">
                {getChannelIcon(step.step?.channel)}
                <div className="flex flex-col">
                  <h3 className="text-black font-black text-4xl">STEP {step.step_index + 1}</h3>
                  {step.step?.name && (
                    <span className="text-[10px] text-neutral-500 font-light mt-0.5">
                      {step.step.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 border-t border-black h-[1px] mx-4" />
              {step.step?.slug !== 'clean-company-name' && (
                <button
                  onClick={() => toggleStep(index)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-transparent border border-transparent hover:bg-neutral-200 hover:border-neutral-200/50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="text-xs font-light text-foreground">Edit message</span>
                  {expandedSteps[index] ? (
                    <ChevronUp className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  )}
                </button>
              )}
            </div>
            {/* Keep email editor mounted to preserve unsaved changes */}
            {step.step?.channel === 'email' ? (
              <motion.div
                key={`editor-${step.id}`}
                initial={false}
                animate={{ 
                  height: expandedSteps[index] ? "auto" : 0,
                  opacity: expandedSteps[index] ? 1 : 0
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ overflow: 'hidden' }}
              >
                <div className="pt-6">
                  <EmailTemplateEditor 
                    ref={(ref) => {
                      if (ref) {
                        editorRefs.current[step.id] = ref;
                      } else {
                        delete editorRefs.current[step.id];
                      }
                    }}
                    stepJoinId={step.id} 
                    sequenceId={sequenceId}
                    stepSlug={step.step?.slug || null}
                    stepId={step.step?.id || null}
                    onChange={onTemplateChange}
                    getEditorRefs={() => editorRefs.current}
                  />
                </div>
              </motion.div>
            ) : (
              <AnimatePresence>
                {expandedSteps[index] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {/* Step details for non-auto_email steps */}
                    <div className="grid grid-cols-2 gap-4 pt-6">
                      {step.step && (
                        <div className="min-h-[48px] flex items-center">
                          <div className="border-0 rounded-full bg-transparent hover:bg-gray-100 px-4 py-2 w-full">
                            <div className="flex items-center">
                              <span className="text-sm font-bold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">Name:</span>
                              <span className="text-sm font-light ml-2">{step.step.name}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="min-h-[48px] flex items-center">
                        <div className="border-0 rounded-full bg-transparent hover:bg-gray-100 px-4 py-2 w-full">
                          <div className="flex items-center">
                            <span className="text-sm font-bold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">Delay:</span>
                            <span className="text-sm font-light ml-2">{formatDelay(step.delay_minutes)}</span>
                          </div>
                        </div>
                      </div>
                      {step.step?.slug && (
                        <div className="min-h-[48px] flex items-center">
                          <div className="border-0 rounded-full bg-transparent hover:bg-gray-100 px-4 py-2 w-full">
                            <div className="flex items-center">
                              <span className="text-sm font-bold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">Slug:</span>
                              <span className="text-sm font-light ml-2">{step.step.slug}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {step.step?.channel && (
                        <div className="min-h-[48px] flex items-center">
                          <div className="border-0 rounded-full bg-transparent hover:bg-gray-100 px-4 py-2 w-full">
                            <div className="flex items-center">
                              <span className="text-sm font-bold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">Channel:</span>
                              <span className="text-sm font-light ml-2 capitalize">{step.step.channel}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {step.step?.description && (
                        <div className="min-h-[48px] flex items-center col-span-2">
                          <div className="border-0 rounded-full bg-transparent hover:bg-gray-100 px-4 py-2 w-full">
                            <div className="flex items-center">
                              <span className="text-sm font-bold text-black bg-kenoo-yellow/70 px-2 py-1 rounded">Description:</span>
                              <span className="text-sm font-light ml-2">{step.step.description}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
              </div>
              {/* Control Buttons */}
              <div className="flex flex-col items-center gap-2">
                {steps.length > 1 && index > 0 && (() => {
                  const isAutoFollowUp = step.step?.id === AUTO_FOLLOW_UP_STEP_ID;
                  const autoEmailIndex = steps.findIndex(s => s.step?.id === AUTO_EMAIL_STEP_ID);
                  const canMoveUp = !isAutoFollowUp || (autoEmailIndex !== -1 && index > autoEmailIndex + 1);
                  
                  // Only show the button if it can be moved up
                  if (!canMoveUp) return null;
                  
                  return (
                    <button
                      onClick={() => handleMoveStep(step.id, index, 'up')}
                      className="relative group"
                    >
                      <div className="
                        relative z-10 p-3 
                        bg-neutral-100/80 backdrop-blur-md 
                        rounded-full shadow-inner border border-neutral-200/50
                        transition-all duration-300 ease-in-out
                        group-hover:bg-kenoo-yellow/60
                        group-hover:shadow-inner group-hover:border-neutral-200
                        group-hover:scale-95
                        group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]
                      ">
                        <ChevronUp className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                      </div>
                    </button>
                  );
                })()}
                <button
                  onClick={() => handleDeleteStep(step.id)}
                  className="relative group"
                >
                  <div className="
                    relative z-10 p-3 
                    bg-neutral-100/80 backdrop-blur-md 
                    rounded-full shadow-inner border border-neutral-200/50
                    transition-all duration-300 ease-in-out
                    group-hover:bg-red-100
                    group-hover:shadow-inner group-hover:border-red-200
                    group-hover:scale-95
                    group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]
                  ">
                    <Trash2 className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600 group-hover:text-red-600" />
                  </div>
                </button>
                {steps.length > 1 && index < steps.length - 1 && (() => {
                  const isAutoEmail = step.step?.id === AUTO_EMAIL_STEP_ID;
                  const nextStep = steps[index + 1];
                  const nextIsAutoFollowUp = nextStep?.step?.id === AUTO_FOLLOW_UP_STEP_ID;
                  
                  // Don't show down button if auto_email is above an auto_follow_up
                  if (isAutoEmail && nextIsAutoFollowUp) {
                    return null;
                  }
                  
                  return (
                    <button
                      onClick={() => handleMoveStep(step.id, index, 'down')}
                      className="relative group"
                    >
                      <div className="
                        relative z-10 p-3 
                        bg-neutral-100/80 backdrop-blur-md 
                        rounded-full shadow-inner border border-neutral-200/50
                        transition-all duration-300 ease-in-out
                        group-hover:bg-kenoo-yellow/60
                        group-hover:shadow-inner group-hover:border-neutral-200
                        group-hover:scale-95
                        group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]
                      ">
                        <ChevronDown className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600" />
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Step Delay Popup */}
      {selectedStepForDelay && (
        <StepDelayPopup
          isOpen={delayPopupOpen}
          onClose={() => {
            setDelayPopupOpen(false);
            setSelectedStepForDelay(null);
          }}
          onSave={handleDelaySave}
          currentDelayMinutes={selectedStepForDelay.delayMinutes}
          stepJoinId={selectedStepForDelay.id}
        />
      )}

      {/* Add Step Popup */}
      <AddStepPopup
        isOpen={addStepPopupOpen}
        onClose={() => setAddStepPopupOpen(false)}
        sequenceId={sequenceId}
        currentStepCount={steps.length}
        lastStepDelay={steps.length > 0 ? steps[steps.length - 1].delay_minutes : 0}
        onStepAdded={handleStepAdded}
      />

      {/* Archive Step Popup */}
      <ArchiveStepPopup
        isOpen={archivePopupOpen}
        onClose={() => {
          setArchivePopupOpen(false);
          setSelectedStepForArchive(null);
        }}
        onArchive={handleArchiveStep}
        isArchiving={isArchiving}
      />
    </div>
  );
});

Steps.displayName = 'Steps';

export default Steps;

