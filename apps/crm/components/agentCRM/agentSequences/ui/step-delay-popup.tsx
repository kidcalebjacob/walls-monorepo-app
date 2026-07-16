"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StepDelayPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (delayMinutes: number) => void;
  currentDelayMinutes: number;
  stepJoinId: string;
}

export function StepDelayPopup({
  isOpen,
  onClose,
  onSave,
  currentDelayMinutes,
  stepJoinId,
}: StepDelayPopupProps) {
  const [timingOption, setTimingOption] = useState<"immediately" | "after">(
    currentDelayMinutes === 0 ? "immediately" : "after"
  );
  const [delayValue, setDelayValue] = useState<number>(
    currentDelayMinutes === 0 ? 0 : Math.floor(currentDelayMinutes / 1440)
  );
  const [timeUnit, setTimeUnit] = useState<"days" | "hours" | "minutes" | "weeks">("days");

  // Update state when currentDelayMinutes changes
  useEffect(() => {
    if (currentDelayMinutes === 0) {
      setTimingOption("immediately");
      setDelayValue(0);
      setTimeUnit("days");
    } else {
      setTimingOption("after");
      // Try to find the best unit to display
      if (currentDelayMinutes % 10080 === 0) {
        // Divisible by weeks
        setDelayValue(currentDelayMinutes / 10080);
        setTimeUnit("weeks");
      } else if (currentDelayMinutes % 1440 === 0) {
        // Divisible by days
        setDelayValue(currentDelayMinutes / 1440);
        setTimeUnit("days");
      } else if (currentDelayMinutes % 60 === 0) {
        // Divisible by hours
        setDelayValue(currentDelayMinutes / 60);
        setTimeUnit("hours");
      } else {
        // Use minutes
        setDelayValue(currentDelayMinutes);
        setTimeUnit("minutes");
      }
    }
  }, [currentDelayMinutes]);

  const handleSave = () => {
    let finalDelayMinutes = 0;
    
    if (timingOption === "after") {
      // Convert to minutes based on time unit
      switch (timeUnit) {
        case "minutes":
          finalDelayMinutes = delayValue;
          break;
        case "hours":
          finalDelayMinutes = delayValue * 60;
          break;
        case "days":
          finalDelayMinutes = delayValue * 1440;
          break;
        case "weeks":
          finalDelayMinutes = delayValue * 10080; // 7 * 24 * 60
          break;
      }
    }

    onSave(finalDelayMinutes);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[500px] w-full bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl" 
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-800">
            When to start this step
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={timingOption} onValueChange={(value) => setTimingOption(value as "immediately" | "after")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="immediately"
                id="immediately"
                className="border-neutral-500"
                indicatorClassName="bg-kenoo-sky"
              />
              <Label htmlFor="immediately" className="text-sm font-normal text-gray-700 cursor-pointer">
                Immediately after contact is added
              </Label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="after"
                  id="after"
                  className="border-neutral-500"
                  indicatorClassName="bg-kenoo-sky"
                />
                <Label htmlFor="after" className="text-sm font-normal text-gray-700 cursor-pointer">
                  Execute step after
                </Label>
              </div>

              {timingOption === "after" && (
                <div className="flex items-center gap-2 pl-6">
                  <Input
                    type="number"
                    min="0"
                    value={delayValue}
                    onChange={(e) => setDelayValue(parseInt(e.target.value) || 0)}
                    className="w-20 h-9 bg-gray-100 border-gray-200 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                  <Select value={timeUnit} onValueChange={(value) => setTimeUnit(value as "days" | "hours" | "minutes" | "weeks")}>
                    <SelectTrigger className="w-24 h-9 bg-gray-100 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">minutes</SelectItem>
                      <SelectItem value="hours">hours</SelectItem>
                      <SelectItem value="days">days</SelectItem>
                      <SelectItem value="weeks">weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="!bg-transparent backdrop-blur-none !border-0 shadow-none text-gray-800 text-sm font-normal hover:bg-gray-50/70 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99] transition-all duration-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="!bg-transparent backdrop-blur-none !border-0 shadow-none text-gray-800 text-sm font-normal hover:bg-gray-50/70 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)] hover:scale-[0.99] transition-all duration-300"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

