"use client";

import React from 'react';
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";

interface NoContactsToastProps {
  companyName?: string;
  message?: "No ideal candidates" | "No contacts found";
}

export const NoContactsToast = ({ companyName, message = "No ideal candidates" }: NoContactsToastProps) => {
  return (
    <div className="flex items-center gap-3 relative">
      {/* Animated Building Icon Container */}
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ 
          scale: [0, 1.2, 1],
          rotate: [-45, 10, 0]
        }}
        transition={{ 
          duration: 0.6,
          times: [0, 0.6, 1],
          ease: "easeOut"
        }}
        className="relative flex items-center justify-center"
      >
        {/* Ripple effect */}
        <motion.div
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ 
            scale: [1, 2.5],
            opacity: [0.5, 0]
          }}
          transition={{ 
            duration: 0.8,
            ease: "easeOut"
          }}
          className="absolute inset-0 rounded-full bg-kenoo-yellow"
        />
        
        {/* Main icon with glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="relative z-10 bg-kenoo-yellow rounded-full p-2"
        >
          <Building2 className="h-4 w-4 text-neutral-800" />
        </motion.div>
      </motion.div>

      {/* Text content with slide-in animation */}
      <div className="flex flex-col flex-1">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="font-semibold text-sm text-neutral-900"
        >
          {message}
        </motion.span>
        {companyName && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-xs text-neutral-600"
          >
            {companyName}
          </motion.span>
        )}
      </div>

      {/* Trailing sparkle effect */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: [0, 1, 0],
          scale: [0, 1, 0],
          rotate: [0, 180]
        }}
        transition={{ 
          delay: 0.5,
          duration: 0.6,
          ease: "easeOut"
        }}
        className="absolute right-2 pointer-events-none z-10"
      >
        <div className="text-kenoo-yellow text-lg">✨</div>
      </motion.div>
    </div>
  );
};
