"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type PaymentStage = "currency" | "business-type" | "bank-details";

interface PaymentStagesHeaderProps {
  currentStage: PaymentStage;
  onStageChange?: (stage: PaymentStage) => void;
  completedStages: PaymentStage[];
}

export default function PaymentStagesHeader({
  currentStage,
  onStageChange,
  completedStages,
}: PaymentStagesHeaderProps) {
  const stages: { id: PaymentStage; label: string }[] = [
    { id: "currency", label: "Currency" },
    { id: "business-type", label: "Business Type" },
    { id: "bank-details", label: "Bank Details" },
  ];

  const getCurrentStageNumber = (stage: PaymentStage) => {
    return stages.findIndex((s) => s.id === stage) + 1;
  };

  const currentStageNumber = getCurrentStageNumber(currentStage);
  
  // Calculate fill percentage based on current stage (0-100%)
  // Stage 1 (currency) = 0%, Stage 2 (business-type) = 50%, Stage 3 (bank-details) = 100%
  // The line spans from 10% to 90% (80% of container width), so we calculate fill as percentage of that 80%
  const fillPercentage = ((currentStageNumber - 1) / (stages.length - 1)) * 80;

  const isClickable = (stageId: PaymentStage) => {
    // A stage is clickable if it's the current stage or a completed stage
    return stageId === currentStage || completedStages.includes(stageId);
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative mb-4 pt-4 pb-4">
      <div className="relative">
        {/* Background bar */}
        <div className="absolute left-[10%] right-[10%] top-[32px] h-1 bg-muted z-0" />
        
        {/* Animated fill bar */}
        <motion.div
          className="absolute left-[10%] top-[32px] h-1 bg-walls-yellow z-0"
          initial={{ width: "0%" }}
          animate={{ width: `${fillPercentage}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
        
        <div className="flex justify-between relative z-10">
          {stages.map((stage, index) => (
            <div 
              key={stage.id} 
              className={cn(
                "flex flex-col items-center w-32",
                isClickable(stage.id) && "cursor-pointer group"
              )}
              onClick={() => {
                if (isClickable(stage.id) && onStageChange) {
                  onStageChange(stage.id);
                }
              }}
            >
              <div className="mb-1 text-center">
                <span className={cn(
                  "text-sm transition-colors uppercase font-black whitespace-nowrap",
                  isClickable(stage.id) 
                    ? "text-foreground" 
                    : "text-muted-foreground"
                )}>
                  {stage.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
