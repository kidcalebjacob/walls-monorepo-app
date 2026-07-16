"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./add-step-dialog";
import { Loader2, Plus, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from '@supabase/supabase-js';
import { FaInstagram, FaLinkedin } from "react-icons/fa";
import Image from "next/image";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SequenceStep {
  id: string;
  slug: string;
  name: string;
  is_task: boolean;
  channel: string;
  description: string | null;
}

interface AddStepPopupProps {
  isOpen: boolean;
  onClose: () => void;
  sequenceId: string;
  currentStepCount: number;
  lastStepDelay: number;
  onStepAdded: () => void;
}

const AUTO_EMAIL_STEP_ID = '8e9856d1-9480-46bc-86d9-fa9653128a88';
const AUTO_FOLLOW_UP_STEP_ID = '663b6577-8256-419a-8888-f4fab2c16928';

export default function AddStepPopup({ 
  isOpen, 
  onClose, 
  sequenceId,
  currentStepCount,
  lastStepDelay,
  onStepAdded
}: AddStepPopupProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<string>("");
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasAutoEmail, setHasAutoEmail] = useState(false);

  const getChannelIcon = (channel: string | null | undefined) => {
    if (!channel) return null;
    
    const channelLower = channel.toLowerCase();
    
    if (channelLower === 'instagram') {
      return <FaInstagram className="h-5 w-5 text-black" />;
    } else if (channelLower === 'linkedin') {
      return <FaLinkedin className="h-5 w-5 text-black" />;
    } else if (channelLower === 'email') {
      return <Mail className="h-5 w-5 text-black" />;
    } else if (channelLower === 'walls') {
      return (
        <Image 
          src="/images/app-icons/crm.svg"
          alt="WALLS logo"
          width={20}
          height={20}
          className="h-5 w-5"
        />
      );
    }
    
    return null;
  };

  // Group steps by channel
  const groupStepsByChannel = (steps: SequenceStep[]) => {
    const grouped: { [key: string]: SequenceStep[] } = {};
    
    steps.forEach(step => {
      const channel = step.channel?.toLowerCase() || 'other';
      if (!grouped[channel]) {
        grouped[channel] = [];
      }
      grouped[channel].push(step);
    });
    
    // Sort channels in a specific order
    const channelOrder = ['email', 'linkedin', 'instagram', 'walls', 'other'];
    const sortedChannels = Object.keys(grouped).sort((a, b) => {
      const aIndex = channelOrder.indexOf(a);
      const bIndex = channelOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    
    return { grouped, sortedChannels };
  };

  const getChannelDisplayName = (channel: string) => {
    const channelLower = channel.toLowerCase();
    const channelMap: { [key: string]: string } = {
      'email': 'Email',
      'linkedin': 'LinkedIn',
      'instagram': 'Instagram',
      'walls': 'WALLS',
      'other': 'Other'
    };
    return channelMap[channelLower] || channel.charAt(0).toUpperCase() + channel.slice(1);
  };

  // Check if sequence already has an auto_email step
  const checkExistingSteps = useCallback(async () => {
    if (!sequenceId) return;

    try {
      const { data: existingSteps, error } = await supabase
        .from('sequence_steps_join')
        .select('step_id')
        .eq('sequence_id', sequenceId);

      if (error) {
        console.error('Error checking existing steps:', error);
        return;
      }

      // Check if auto_email exists in the sequence
      const hasAutoEmailStep = existingSteps?.some(
        (step: any) => step.step_id === AUTO_EMAIL_STEP_ID
      ) || false;

      setHasAutoEmail(hasAutoEmailStep);
    } catch (error) {
      console.error('Error checking existing steps:', error);
    }
  }, [sequenceId]);

  const fetchSteps = useCallback(async () => {
    setIsLoadingSteps(true);
    try {
      const { data: stepsData, error } = await supabase
        .from('sequence_steps')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching steps:', error);
        wallsToast.error("Error", "Failed to load steps");
        return;
      }

      setSteps(stepsData || []);
      
      // Check existing steps in sequence
      await checkExistingSteps();
    } catch (error) {
      console.error('Error fetching steps:', error);
      wallsToast.error("Error", "Failed to load steps");
    } finally {
      setIsLoadingSteps(false);
    }
  }, [checkExistingSteps]);

  // Sync internal dialog state with parent's isOpen prop
  React.useEffect(() => {
    console.log("AddStepPopup: isOpen changed to", isOpen);
    if (isOpen) {
      console.log("AddStepPopup: Opening dialog and fetching steps");
      setIsDialogOpen(true);
      fetchSteps();
      // Reset selected step when opening
      setSelectedStep("");
    } else {
      setIsDialogOpen(false);
    }
  }, [isOpen, fetchSteps]);

  const handleSubmit = async () => {
    if (!selectedStep) {
      wallsToast.error("No Step Selected", "Please select a step to continue");
      return;
    }

    // Validate that the selected step is not disabled
    const isAutoEmail = selectedStep === AUTO_EMAIL_STEP_ID;
    const isAutoFollowUp = selectedStep === AUTO_FOLLOW_UP_STEP_ID;
    
    if ((isAutoEmail && hasAutoEmail) || (isAutoFollowUp && !hasAutoEmail)) {
      const message =
        isAutoEmail && hasAutoEmail
          ? "Only one initial email can be added to a sequence"
          : "An initial email must be added before follow-up emails";
      wallsToast.error("Invalid Selection", message);
      return;
    }

    setIsSubmitting(true);

    try {
      // Automatic email as the first step runs immediately (0). Other new steps: 3 days after the last step.
      const delayMinutes = 3 * 24 * 60; // 3 days in minutes
      const isInitialAutomaticEmail =
        selectedStep === AUTO_EMAIL_STEP_ID && currentStepCount === 0;
      const newDelay = isInitialAutomaticEmail
        ? 0
        : lastStepDelay + delayMinutes;
      const newStepIndex = currentStepCount;

      // Create new step join entry
      // Set is_threaded_reply to true for auto follow-up steps
      const isAutoFollowUp = selectedStep === AUTO_FOLLOW_UP_STEP_ID;
      const { error: insertError } = await supabase
        .from('sequence_steps_join')
        .insert({
          sequence_id: sequenceId,
          step_id: selectedStep,
          step_index: newStepIndex,
          delay_minutes: newDelay,
          is_threaded_reply: isAutoFollowUp ? true : false
        });

      if (insertError) {
        console.error("Error adding step:", insertError);
        wallsToast.error("Error", "Failed to add step");
        setIsSubmitting(false);
        return;
      }

      // Call the parent handler to refresh the steps list
      onStepAdded();
      
      // Refresh the check for existing steps
      await checkExistingSteps();

      // Switch to animation mode
      setIsSent(true);
      setIsSubmitting(false);

      // Wait for "Added" animation to complete
      setTimeout(() => {
        // Close the dialog (triggers Radix exit animation)
        setIsDialogOpen(false);
        
        // After Radix animation completes, notify parent and reset
        setTimeout(() => {
          resetForm();
          onClose();
        }, 300); // Match Radix's exit animation duration
      }, 2000); // Time to show "Added" state
    } catch (error) {
      console.error("Error adding step:", error);
      wallsToast.error("Error", "Failed to add step");
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedStep("");
    setIsSent(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsDialogOpen(false);
      setTimeout(() => {
        resetForm();
        onClose();
      }, 300); // Match Radix exit animation
    }
  };

  // Show close button only after steps have loaded and we're not in loading or sent state
  const shouldShowCloseButton = !isLoadingSteps && !isSent && steps.length > 0;

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleClose}>
      <DialogContent 
        showCloseButton={shouldShowCloseButton}
        className="sm:max-w-[600px] w-full bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden"
      >
        <motion.div
          layout
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {isSent ? (
              <motion.div
                key="sent"
                initial={{ height: 300, opacity: 0 }}
                animate={{ height: 280, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex items-center justify-center py-12"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center gap-3"
                >
                  {/* Rotating circle + plus icon */}
                  <div className="relative flex items-center justify-center">
                    <Plus className="h-7 w-7 text-neutral-600" />
                    <motion.div
                      className="absolute inset-[-15px] rounded-full border-2 border-transparent"
                      style={{
                        background: `conic-gradient(from 0deg, transparent, #F59E0B, transparent)`,
                        WebkitMask:
                          "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        maskComposite: "exclude",
                      }}
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  </div>

                  {/* "Added" text fade-in after delay */}
                  <motion.span
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.4 }}
                    className="text-lg font-medium text-gray-800"
                  >
                    Step Added
                  </motion.span>
                </motion.div>
              </motion.div>
            ) : isLoadingSteps ? (
              // Keep height frozen, just fade the loader in
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center py-12 min-h-[240px]"
              >
                <div className="relative flex items-center justify-center">
                  <Plus className="h-7 w-7 text-neutral-600" />
                  <motion.div
                    className="absolute inset-[-15px] rounded-full border-2 border-transparent"
                    style={{
                      background: `conic-gradient(from 0deg, transparent, #F59E0B, transparent)`,
                      WebkitMask:
                        "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </div>
              </motion.div>
            ) : (
              // Animate full container height smoothly
              <motion.div
                key="loaded"
                initial={{ height: 240, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 240, opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="flex flex-col"
              >
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-xl font-semibold text-gray-800">
                    Add Step to Sequence
                  </DialogTitle>
                </DialogHeader>

                <div className="border-t border-neutral-300 -mx-6 mb-3" />

                {steps.length > 0 ? (
                  <motion.div
                    key="step-selection"
                    initial={{ height: 240, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 240, opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeInOut" }}
                    className="max-h-[28rem] overflow-y-auto scrollbar-hide bg-transparent space-y-4"
                  >
                    {(() => {
                      const { grouped, sortedChannels } = groupStepsByChannel(steps);
                      return sortedChannels.map((channel) => (
                        <div key={channel} className="space-y-2">
                          {/* Channel Header */}
                          <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-transparent backdrop-blur-none z-10 -mx-2 rounded-xl">
                            {getChannelIcon(channel)}
                            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                              {getChannelDisplayName(channel)}
                            </h3>
                            <div className="flex-1 border-t border-neutral-300 ml-2" />
                            <span className="text-xs text-gray-500">
                              {grouped[channel].length}
                            </span>
                          </div>
                          
                          {/* Steps for this channel */}
                          <div className="space-y-2 px-2">
                            {grouped[channel].map((step) => {
                              // Check if step should be disabled
                              const isAutoEmail = step.id === AUTO_EMAIL_STEP_ID;
                              const isAutoFollowUp = step.id === AUTO_FOLLOW_UP_STEP_ID;
                              
                              // Disable auto_email if one already exists
                              // Disable auto_follow_up if no auto_email exists
                              const isDisabled = 
                                (isAutoEmail && hasAutoEmail) ||
                                (isAutoFollowUp && !hasAutoEmail);
                              
                              const disabledReason = isAutoEmail && hasAutoEmail
                                ? "Only one initial email can be added to a sequence"
                                : isAutoFollowUp && !hasAutoEmail
                                ? "An initial email must be added before follow-up emails"
                                : null;

                              return (
                                <button
                                  key={step.id}
                                  onClick={() => {
                                    if (!isDisabled) {
                                      setSelectedStep(step.id);
                                    }
                                  }}
                                  disabled={isDisabled}
                                  className={`w-full text-left p-4 rounded-xl transition-all duration-300 ${
                                    isDisabled
                                      ? '!bg-transparent backdrop-blur-none opacity-50 cursor-not-allowed'
                                      : selectedStep === step.id
                                      ? 'ring-1 ring-kenoo-yellow bg-white/70 backdrop-blur-sm shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)]'
                                      : '!bg-transparent backdrop-blur-none hover:bg-gray-50/70 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-gray-800">{step.name}</span>
                                          {step.is_task && (
                                            <>
                                              <span className="text-gray-500">•</span>
                                              <span className="text-xs text-black font-light">Task</span>
                                            </>
                                          )}
                                        </div>
                                        {step.description && (
                                          <span className="text-sm text-gray-600 mt-1 font-light">{step.description}</span>
                                        )}
                                        {isDisabled && disabledReason && (
                                          <span className="text-xs text-gray-500 mt-1 font-light italic">{disabledReason}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </motion.div>
                ) : (
                  <div className="px-2 py-8 text-center text-gray-600">
                    <p>No steps available.</p>
                  </div>
                )}

                {steps.length > 0 && (
                  <div className="border-t border-neutral-300 -mx-6 mt-3" />
                )}

                <DialogFooter className="pt-4">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="!bg-transparent backdrop-blur-none !border-0 hover:bg-gray-50/70 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99] transition-all duration-300 font-normal"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedStep || isSubmitting}
                    className="!bg-transparent backdrop-blur-none !border-0 hover:bg-gray-50/70 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99] transition-all duration-300 text-gray-800 font-normal"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Step"
                    )}
                  </Button>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

