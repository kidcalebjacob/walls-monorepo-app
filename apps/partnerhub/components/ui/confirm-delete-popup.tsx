"use client";

import { X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface ConfirmDeletePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isSubmitting?: boolean;
  title?: string;
}

export function ConfirmDeletePopup({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  title = "Delete Creator?",
}: ConfirmDeletePopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="animate-in fade-in-0 zoom-in-95 duration-300 bg-gradient-to-br from-gray-50 via-gray-50/95 to-gray-50/90 rounded-[50px] p-8 w-full max-w-2xl relative z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <h2 className="text-4xl font-black text-gray-500 pl-16 mb-8">{title}</h2>
        <div className="grid grid-cols-2 gap-8">
          <Card 
            className="cursor-pointer hover:bg-walls-gray transition-all duration-300 rounded-2xl border-2 border-transparent group bg-gray-50"
            onClick={onClose}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <X className="h-28 w-28 text-gray-500 relative z-10 group-hover:scale-110 group-hover:text-red-400 transition-all duration-300" />
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="font-light text-lg text-gray-700">No, Cancel</span>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-walls-gray transition-all duration-300 rounded-2xl border-2 border-transparent group bg-gray-50"
            onClick={onConfirm}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Check className="h-28 w-28 text-gray-500 relative z-10 group-hover:scale-110 group-hover:text-green-500 transition-all duration-300" />
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="font-light text-lg text-gray-700">
                  Yes, Delete
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 