"use client";

import React, { ReactNode, useState } from "react";
import { PaymentDetails } from "@/types/payment.types";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentDisplayTemplateProps {
  paymentDetails: PaymentDetails;
  title: string;
  subtitle: string;
  flagCode: string;
  children: ReactNode;
  onDelete: () => void;
}

export default function PaymentDisplayTemplate({
  title,
  subtitle,
  flagCode,
  children,
  onDelete
}: PaymentDisplayTemplateProps) {
  const [isHoveringDelete, setIsHoveringDelete] = useState(false);

  return (
    <div className="bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-[30px] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-20 h-20 overflow-hidden rounded-full flex items-center justify-center bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 mr-6">
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
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 rounded-lg">
          <img
            src="https://d21buns5ku92am.cloudfront.net/69645/images/470451-Frame%2039321-0745ed-original-1677657684.png"
            alt="Wise Verified"
            className="h-6 w-auto"
          />
          <span className="text-sm font-light text-neutral-700">Verified</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {children}
      </div>
      
      <div className="mt-8 flex justify-center">
        <Button
          onClick={onDelete}
          variant="ghost"
          onMouseEnter={() => setIsHoveringDelete(true)}
          onMouseLeave={() => setIsHoveringDelete(false)}
          className="relative bg-red-200 backdrop-blur-md border border-red-500 text-red-500 font-normal text-sm px-5 py-3 rounded-none hover:bg-red-200 hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] hover:text-red-500 transition-all overflow-hidden"
        >
          <AnimatePresence>
            {isHoveringDelete && (
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
                className="absolute left-3 flex items-center pointer-events-none"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.span 
            className="inline-block"
            animate={{
              x: isHoveringDelete ? 8 : 0,
              transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
            }}
          >
            Delete account
          </motion.span>
        </Button>
      </div>
    </div>
  );
}
