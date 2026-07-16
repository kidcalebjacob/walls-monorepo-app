"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { RiTimeZoneLine } from "react-icons/ri";
import { Card, CardContent } from "@/components/ui/card";

interface TimezoneAlertProps {
  isOpen: boolean;
  onClose: () => void;
  browserTimezone: string;
  userTimezone: string;
}

// Helper function to format timezone display
const formatTimezone = (timezone: string) => {
  return timezone.replace(/_/g, ' ');
};

export function TimezoneAlert({ isOpen, onClose, browserTimezone, userTimezone }: TimezoneAlertProps) {
  const router = useRouter();

  const handleChangeTimezone = () => {
    router.push("/agents/settings/timezone");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-in fade-in-0 zoom-in-95 duration-300 bg-gradient-to-br from-gray-50 via-gray-50/95 to-gray-50/90 backdrop-blur-sm rounded-[50px] shadow-2xl p-8 w-full max-w-2xl border border-border/50">
        <div className="grid grid-cols-2 gap-8">
          <Card 
            className="cursor-pointer hover:bg-walls-gray transition-all duration-300 rounded-2xl border-2 border-transparent group bg-gray-50"
            onClick={handleChangeTimezone}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <RiTimeZoneLine className="h-28 w-28 text-gray-500 relative z-10 group-hover:scale-110 group-hover:text-kenoo-light transition-all duration-300" />
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="font-light text-lg text-gray-500">Switch to</span>
                <span className="font-medium text-lg text-gray-700">{formatTimezone(browserTimezone)}</span>
                <span className="font-light text-lg text-gray-500">Timezone</span>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-walls-gray transition-all duration-300 rounded-2xl border-2 border-transparent group bg-gray-50"
            onClick={onClose}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <X className="h-28 w-28 text-gray-500 relative z-10 group-hover:scale-110 group-hover:text-red-400 transition-all duration-300" />
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="font-light text-lg text-gray-500">Keep</span>
                <span className="font-medium text-lg text-gray-700">{formatTimezone(userTimezone)}</span>
                <span className="font-light text-lg text-gray-500">Timezone</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 