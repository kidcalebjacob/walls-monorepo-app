"use client";

import React from 'react';
import { motion } from "framer-motion";
import { MailOpen, Loader2 } from "lucide-react";

interface AnimatedEmailToastProps {
  count: number;
  action: 'read' | 'unread' | 'archived' | 'deleted';
}

export const AnimatedEmailToast = ({ count, action }: AnimatedEmailToastProps) => {
  const actionText = {
    read: 'marked as read',
    unread: 'marked as unread',
    archived: 'archived',
    deleted: 'deleted'
  };

  return (
    <div className="flex items-center gap-3">
      {/* Animated Icon Container */}
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
          <MailOpen className="h-4 w-4 text-neutral-800" />
        </motion.div>
      </motion.div>

      {/* Text content with slide-in animation */}
      <div className="flex flex-col">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="font-semibold text-sm text-neutral-900"
        >
          {count} {count === 1 ? 'email' : 'emails'} {actionText[action]}
        </motion.span>
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
        className="absolute right-2"
      >
        <div className="text-kenoo-yellow text-lg">✨</div>
      </motion.div>
    </div>
  );
};

interface AnimatedEmailLoadingToastProps {
  count: number;
  action: 'read' | 'unread' | 'archived' | 'deleted';
}

export const AnimatedEmailLoadingToast = ({ count, action }: AnimatedEmailLoadingToastProps) => {
  const actionText = {
    read: 'marking as read',
    unread: 'marking as unread',
    archived: 'archiving',
    deleted: 'deleting'
  };

  return (
    <div className="flex items-center gap-3">
      {/* Loading Icon Container */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative flex items-center justify-center"
      >
        {/* Main icon with kenoo-sky background */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 bg-kenoo-sky rounded-full p-2"
        >
          <Loader2 className="h-4 w-4 text-kenoo-yellow animate-spin" />
        </motion.div>
      </motion.div>

      {/* Text content */}
      <div className="flex flex-col">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="font-semibold text-sm text-neutral-900"
        >
          {count} {count === 1 ? 'email' : 'emails'} {actionText[action]}...
        </motion.span>
      </div>
    </div>
  );
};

export default { AnimatedEmailToast, AnimatedEmailLoadingToast };
