"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
} from "./dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check } from "lucide-react";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";

export type CreatePersonAnchorRect = { top: number; left: number; width: number; height: number } | null;

interface CreatePersonPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onManualAdd?: () => void;
  /** Called when a person is successfully added (Apollo sync or other). Use to refresh the people list. */
  onPersonAdded?: () => void;
  /** When set, popup renders as a dropdown under this rect (e.g. under + button). When null, renders as centered dialog. */
  anchorRect?: CreatePersonAnchorRect;
  /** Ref to the trigger element (e.g. + button). Clicks on this won't close the dropdown so the trigger can toggle. */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/** Returns false if input is a full URL (has ://) and the host is not Apollo. */
function isApolloDomainOrRelative(raw: string): boolean {
  const s = raw.trim().split("?")[0].trim();
  if (!s.includes("://")) return true;
  try {
    const u = new URL(s);
    return u.hostname.toLowerCase().includes("apollo");
  } catch {
    return false;
  }
}

/** Check if input is a valid email address */
function isValidEmail(raw: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(raw.trim());
}

/** Parse Apollo URL/ID or email; only accepts people or contacts from Apollo. Rejects wrong domain, organization/account, and other URLs. */
function parseApolloUrl(raw: string): { type: "person"; cleanId: string } | { type: "contact"; cleanId: string } | { type: "email"; email: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  
  // Check if it's an email first
  if (isValidEmail(trimmed)) {
    return { type: "email", email: trimmed.toLowerCase() };
  }
  
  const url = trimmed.split("?")[0].trim();
  if (!isApolloDomainOrRelative(raw)) return null;
  const lower = url.toLowerCase();
  if (/\/(organizations?|accounts?)(\/|$)/.test(lower)) return null;
  const cleanId = (id: string) => id.trim().replace(/[^\w-]/g, "");
  const peopleMatch = url.match(/(?:#\/)?people\/([^\/\?]+)/);
  const personMatch = url.match(/(?:#\/)?person\/([^\/\?]+)/);
  const contactsMatch = url.match(/(?:#\/)?contacts\/([^\/\?]+)/);
  const contactMatch = url.match(/(?:#\/)?contact\/([^\/\?]+)/);
  if (peopleMatch?.[1]) return { type: "person", cleanId: cleanId(peopleMatch[1]) };
  if (personMatch?.[1]) return { type: "person", cleanId: cleanId(personMatch[1]) };
  if (contactsMatch?.[1]) return { type: "contact", cleanId: cleanId(contactsMatch[1]) };
  if (contactMatch?.[1]) return { type: "contact", cleanId: cleanId(contactMatch[1]) };
  const possibleId = url.split("/").pop()?.trim() ?? raw.trim();
  if (possibleId) {
    const id = cleanId(possibleId);
    if (id) return { type: "contact", cleanId: id };
  }
  return null;
}

// Custom animated toast component for person sync success
const AnimatedSuccessToast = ({ personName, message }: { personName?: string | null; message?: string }) => {
  return (
    <div className="flex items-center gap-3">
      {/* Animated Check Icon Container */}
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
          <Check className="h-4 w-4 text-neutral-800" />
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
          {message || 'Person synced successfully'}
        </motion.span>
        {personName && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-xs text-neutral-600"
          >
            {personName}
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
        className="absolute right-2"
      >
        <div className="text-kenoo-yellow text-lg">✨</div>
      </motion.div>
    </div>
  );
};

const DROPDOWN_OFFSET = 8;
const DROPDOWN_WIDTH = 240;

export function CreatePersonPopup({
  isOpen,
  onClose,
  onManualAdd,
  onPersonAdded,
  anchorRect = null,
  triggerRef,
}: CreatePersonPopupProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showApolloUrlInput, setShowApolloUrlInput] = useState(false);
  const [apolloUrl, setApolloUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showParsedResult, setShowParsedResult] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const apolloPreview = React.useMemo(() => parseApolloUrl(apolloUrl), [apolloUrl]);

  // Brief "parsing" loading state when URL is pasted so it feels like we're resolving the ID
  useEffect(() => {
    if (apolloPreview) {
      setShowParsedResult(false);
      const t = setTimeout(() => setShowParsedResult(true), 420);
      return () => clearTimeout(t);
    } else {
      setShowParsedResult(false);
    }
  }, [apolloPreview]);

  // Close dropdown when clicking outside (but not when clicking the trigger — let trigger handle toggle)
  useEffect(() => {
    if (!isOpen || !anchorRect || !isMounted) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const el = dropdownRef.current;
      if (triggerRef?.current?.contains(target)) return;
      if (el && !el.contains(target)) onClose();
    };
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [isOpen, anchorRect, onClose, isMounted, triggerRef]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen && isMounted) {
      setIsDialogOpen(true);
    } else {
      setIsDialogOpen(false);
    }
  }, [isOpen, isMounted]);

  const handleClose = () => {
    if (!isDialogOpen) return;
    setIsDialogOpen(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleSyncApolloUrl = async () => {
    const parsed = parseApolloUrl(apolloUrl);
    if (!parsed) {
      wallsToast.error("Please enter a valid Apollo URL, ID, or email");
      return;
    }

    setIsSyncing(true);
    try {
      const { type } = parsed;
      let url: string;
      let body: string;
      
      if (type === "email") {
        url = "/api/apollo/custom/apollo-person-id-supabase-sync";
        body = JSON.stringify({ email: parsed.email });
      } else if (type === "person") {
        url = "/api/apollo/custom/apollo-person-id-supabase-sync";
        body = JSON.stringify({ personId: parsed.cleanId });
      } else {
        url = "/api/apollo/custom/apollo-contact-id-supabase-sync";
        body = JSON.stringify({ contactId: parsed.cleanId });
      }

      if (process.env.NODE_ENV === "development") {
        const identifier = type === "email" ? parsed.email : parsed.cleanId;
        console.log("[Apollo sync] Request", { type, identifier, url });
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const responseText = await response.text();
      let data: { personName?: string; message?: string; error?: string; details?: string; code?: string };
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        const identifier = parsed.type === "email" ? parsed.email : parsed.cleanId;
        console.error("[Apollo sync] Response was not JSON (e.g. HTML error page)", {
          status: response.status,
          statusText: response.statusText,
          url,
          type: parsed.type,
          identifier,
          bodyPreview: responseText.slice(0, 200),
        });
        wallsToast.error(
          response.status === 404
            ? "Sync endpoint not found. Check server logs."
            : `Server error (${response.status}). Check console and server logs.`
        );
        return;
      }

      if (!response.ok) {
        const identifier = parsed.type === "email" ? parsed.email : parsed.cleanId;
        console.error("[Apollo sync] API error response", {
          status: response.status,
          url,
          type: parsed.type,
          identifier,
          error: data.error,
          details: data.details,
          code: data.code,
        });
        throw new Error(data.error || data.details || "Failed to sync from Apollo URL");
      }

      const personName = data.personName;
      const successMessage = data.message === "Person created" ? "Person created" : "Person updated";

      wallsToast.success(successMessage, personName);

      setShowApolloUrlInput(false);
      setApolloUrl("");
      onPersonAdded?.();

      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      const identifier = parsed?.type === "email" ? parsed?.email : parsed?.cleanId;
      console.error("[Apollo sync] Error", { error, type: parsed?.type, identifier });
      wallsToast.error(error instanceof Error ? error.message : "Failed to sync from Apollo URL");
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't render Dialog at all until mounted to avoid context issues
  if (!isMounted) {
    return null;
  }

  const buttonClass =
    "w-full text-left p-3 rounded-lg border border-neutral-200/50 bg-neutral-100 backdrop-blur-md shadow-inner hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-colors duration-200";

  const optionsContent = (
    <div className="space-y-3">
      <button
        onClick={() => {
          handleClose();
          if (onManualAdd) {
            setTimeout(() => {
              onManualAdd();
            }, 300);
          }
        }}
        className={buttonClass}
      >
        <div className="flex items-center gap-3">
          <Plus className="h-4 w-4 text-gray-700 shrink-0" />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-medium text-gray-800 text-sm">Manual Add</span>
            <span className="text-xs text-gray-600 mt-0.5 font-light">
              Manually create person
            </span>
          </div>
        </div>
      </button>

      <button
        onClick={() => {
          handleClose();
          setTimeout(() => {
            setShowApolloUrlInput(true);
          }, 300);
        }}
        className={buttonClass}
      >
        <div className="flex items-center gap-3">
          <Image
            src="https://assets.wallsentertainment.com/apollo-logo-v2.png"
            alt="Apollo Logo"
            width={16}
            height={16}
            className="h-4 w-4 object-contain shrink-0"
          />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-medium text-gray-800 text-sm">Apollo Sync</span>
            <span className="text-xs text-gray-600 mt-0.5 font-light">
              Create via URL
            </span>
          </div>
        </div>
      </button>
    </div>
  );

  const dropdownContainerVariants = {
    hidden: { opacity: 0, scale: 0.96, y: -6 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
    },
    exit: { 
      opacity: 0, 
      scale: 0.92, 
      y: -8,
      transition: { 
        duration: 0.2, 
        ease: [0.4, 0, 0.2, 1] as const,
        staggerChildren: 0.04,
        delayChildren: 0,
      } 
    },
  };

  const dropdownListVariants = {
    visible: {
      transition: { staggerChildren: 0.06, delayChildren: 0.04 },
    },
    exit: {
      transition: { staggerChildren: 0.04, staggerDirection: -1 },
    },
  };

  const dropdownItemVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1] as const,
      } 
    },
    exit: { 
      opacity: 0, 
      y: -4,
      scale: 0.95,
      transition: { 
        duration: 0.15,
        ease: [0.4, 0, 0.2, 1] as const,
      } 
    },
  };

  // Dropdown mode: render under anchor (e.g. + button), right-aligned with button
  if (anchorRect && isMounted && typeof document !== "undefined") {
    const style: React.CSSProperties = {
      position: "fixed",
      top: anchorRect.top + anchorRect.height + DROPDOWN_OFFSET,
      left: anchorRect.left - 12,
      width: DROPDOWN_WIDTH,
      zIndex: 9999,
    };
    return (
      <>
        {createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={dropdownRef}
                role="dialog"
                aria-modal="true"
                style={style}
                className="rounded-lg bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden p-3"
                variants={dropdownContainerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <motion.div 
                  className="space-y-3" 
                  variants={dropdownListVariants} 
                  initial="hidden" 
                  animate="visible"
                  exit="exit"
                >
                <motion.div variants={dropdownItemVariants} key="manual">
                  <motion.button
                    onClick={() => {
                      handleClose();
                      if (onManualAdd) setTimeout(() => onManualAdd(), 300);
                    }}
                    className={buttonClass}
                    variants={dropdownItemVariants}
                  >
                    <div className="flex items-center gap-3">
                      <Plus className="h-4 w-4 text-gray-700 shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium text-gray-800 text-sm">Manual Add</span>
                        <span className="text-xs text-gray-600 mt-0.5 font-light">
                          Manually create person
                        </span>
                      </div>
                    </div>
                  </motion.button>
                </motion.div>
                <motion.div variants={dropdownItemVariants} key="apollo">
                  <motion.button
                    onClick={() => {
                      handleClose();
                      setTimeout(() => setShowApolloUrlInput(true), 300);
                    }}
                    className={buttonClass}
                    variants={dropdownItemVariants}
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src="https://assets.wallsentertainment.com/apollo-logo-v2.png"
                        alt="Apollo Logo"
                        width={16}
                        height={16}
                        className="h-4 w-4 object-contain shrink-0"
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium text-gray-800 text-sm">Apollo Sync</span>
                        <span className="text-xs text-gray-600 mt-0.5 font-light">
                          Create via URL
                        </span>
                      </div>
                    </div>
                  </motion.button>
                </motion.div>
              </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
        {/* Apollo URL Input Dialog - same as below */}
        {showApolloUrlInput && (
          <Dialog
            open={showApolloUrlInput}
            onOpenChange={(open) => {
              if (!open) {
                setShowApolloUrlInput(false);
                setApolloUrl("");
              }
            }}
          >
            <DialogContent
              showCloseButton={false}
              className="sm:max-w-[400px] w-full bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl"
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              <div className="relative">
                <div className="mt-2 space-y-4">
                  <div>
                    <div className="rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-2 pl-4 py-2">
                      <div className="relative w-full flex items-center gap-2">
                        {apolloPreview ? (
                          <div className="flex items-center gap-2 min-h-9 w-full">
                            {showParsedResult ? (
                              <motion.div
                                key="parsed"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                className="flex items-center gap-2 min-h-9 w-full"
                              >
                                <span className="flex-1 min-w-0 text-sm text-neutral-700 truncate select-none flex items-center min-h-9">
                                  <span className="font-normal capitalize mr-1">{apolloPreview.type}:</span>
                                  {apolloPreview.type === "email" ? (
                                    <span className="text-neutral-600" title={apolloPreview.email}>
                                      {apolloPreview.email}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-neutral-400" title={apolloPreview.cleanId}>
                                      {apolloPreview.cleanId}
                                    </span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setApolloUrl("")}
                                  disabled={isSyncing}
                                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors disabled:opacity-50"
                                  aria-label="Clear and paste again"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            ) : (
                              <div className="flex-1 flex items-center justify-center min-h-9">
                                <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                        ) : apolloUrl.trim() ? (
                          <div className="flex items-center gap-2 min-h-9 w-full">
                            <span className="flex-1 min-w-0 text-sm text-red-600 truncate select-none flex items-center min-h-9 font-normal">
                              Invalid input — use a Person/Contact URL, ID, or email
                            </span>
                            <button
                              type="button"
                              onClick={() => setApolloUrl("")}
                              disabled={isSyncing}
                              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors disabled:opacity-50"
                              aria-label="Clear and try again"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <BorderlessInput
                            type="text"
                            value={apolloUrl}
                            onChange={(e) => setApolloUrl(e.target.value)}
                            placeholder="Paste Apollo URL or email"
                            className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full placeholder:text-neutral-400"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && apolloUrl.trim() && !isSyncing) {
                                handleSyncApolloUrl();
                              } else if (e.key === "Escape") {
                                setShowApolloUrlInput(false);
                                setApolloUrl("");
                              }
                            }}
                            disabled={isSyncing}
                            autoFocus
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowApolloUrlInput(false);
                        setApolloUrl("");
                      }}
                      disabled={isSyncing}
                      className="w-8 h-8 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4 text-gray-700 group-hover:text-red-600 transition-colors" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncApolloUrl}
                      disabled={isSyncing || !apolloPreview}
                      className="w-8 h-8 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? (
                        <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 text-gray-700 group-hover:text-kenoo-yellow transition-colors" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // Dialog mode (e.g. from Mobile FAB) — use isOpen so closing doesn't flash centered dialog
  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        showCloseButton={false}
        className="w-full max-w-[240px] bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden p-4"
      >
        {optionsContent}
      </DialogContent>
    </Dialog>

    {/* Apollo URL Input Dialog */}
    {showApolloUrlInput && (
      <Dialog 
        open={showApolloUrlInput} 
        onOpenChange={(open) => {
          if (!open) {
            setShowApolloUrlInput(false);
            setApolloUrl("");
          }
        }}
      >
        <DialogContent 
          showCloseButton={false}
          className="sm:max-w-[400px] w-full bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="relative">
            <div className="mt-2 space-y-4">
              <div>
                <div className="rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-2 pl-4 py-2">
                  <div className="relative w-full flex items-center gap-2">
                    {apolloPreview ? (
                      <div className="flex items-center gap-2 min-h-9 w-full">
                        {showParsedResult ? (
                          <motion.div
                            key="parsed"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            className="flex items-center gap-2 min-h-9 w-full"
                          >
                            <span className="flex-1 min-w-0 text-sm text-neutral-700 truncate select-none flex items-center min-h-9">
                              <span className="font-normal capitalize mr-1">{apolloPreview.type}:</span>
                              {apolloPreview.type === "email" ? (
                                <span className="text-neutral-600" title={apolloPreview.email}>
                                  {apolloPreview.email}
                                </span>
                              ) : (
                                <span className="font-mono text-neutral-400" title={apolloPreview.cleanId}>
                                  {apolloPreview.cleanId}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => setApolloUrl("")}
                              disabled={isSyncing}
                              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors disabled:opacity-50"
                              aria-label="Clear and paste again"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center min-h-9">
                            <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : apolloUrl.trim() ? (
                      <div className="flex items-center gap-2 min-h-9 w-full">
                        <span className="flex-1 min-w-0 text-sm text-red-600 truncate select-none flex items-center min-h-9 font-normal">
                          Invalid input — use a Person/Contact URL, ID, or email
                        </span>
                        <button
                          type="button"
                          onClick={() => setApolloUrl("")}
                          disabled={isSyncing}
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors disabled:opacity-50"
                          aria-label="Clear and try again"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <BorderlessInput
                        type="text"
                        value={apolloUrl}
                        onChange={(e) => setApolloUrl(e.target.value)}
                        placeholder="Paste Apollo URL or email"
                        className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full placeholder:text-neutral-400/80"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && apolloUrl.trim() && !isSyncing) {
                            handleSyncApolloUrl();
                          } else if (e.key === "Escape") {
                            setShowApolloUrlInput(false);
                            setApolloUrl("");
                          }
                        }}
                        disabled={isSyncing}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowApolloUrlInput(false);
                    setApolloUrl("");
                  }}
                  disabled={isSyncing}
                  className="w-8 h-8 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4 text-gray-700 group-hover:text-red-600 transition-colors" />
                </button>
                <button
                  type="button"
                  onClick={handleSyncApolloUrl}
                  disabled={isSyncing || !apolloPreview}
                  className="w-8 h-8 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-gray-700 group-hover:text-kenoo-yellow transition-colors" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

