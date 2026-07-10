"use client";

import React, { ReactNode } from "react";
import { PaymentDetails } from "@/types/payment.types";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface PaymentTemplateProps {
  paymentDetails: PaymentDetails;
  title: string;
  subtitle: string;
  flagCode: string;
  icon: LucideIcon;
  children: ReactNode;
}

export default function PaymentTemplate({
  title,
  subtitle,
  flagCode,
  icon: Icon,
  children
}: PaymentTemplateProps) {
  return (
    <div className="space-y-6">
      <div className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-[30px] p-6 flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-20 h-20 overflow-hidden rounded-full flex items-center justify-center bg-muted mr-6">
            <img 
              src={`https://flagcdn.com/${flagCode}.svg`} 
              alt={`${title} Flag`} 
              className="w-20 h-20 object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black uppercase">{title}</span>
            <span className="text-sm font-light text-muted-foreground">{subtitle}</span>
          </div>
        </div>
        <div className="w-14 h-14 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-full flex items-center justify-center">
          <Icon className="h-6 w-6 text-neutral-600" />
        </div>
      </div>
      
      <motion.div
        className="px-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1]
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
