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
import {
  getApolloCompanyPreview,
  runApolloCompanySync,
  type CompanySyncPreview,
} from "@/components/agentCRM/agentCompanies/lib/apollo-company-sync";

export type CreateCompanyAnchorRect = { top: number; left: number; width: number; height: number } | null;

interface CreateCompanyPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onManualAdd?: () => void;
  /** Called when a company is successfully added (e.g. Apollo sync). Use to refresh the companies list. */
  onCompanyAdded?: () => void;
  /** When set, popup renders as a dropdown under this rect. When null, centered dialog. */
  anchorRect?: CreateCompanyAnchorRect;
  /** Ref to the trigger element. Clicks on this won't close the dropdown. */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const AnimatedSuccessToast = ({ companyName, message }: { companyName?: string | null; message?: string }) => (
  <div className="flex items-center gap-3">
    <motion.div
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: [0, 1.2, 1], rotate: [-45, 10, 0] }}
      transition={{ duration: 0.6, times: [0, 0.6, 1], ease: "easeOut" }}
      className="relative flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0, opacity: 0.5 }}
        animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0 rounded-full bg-kenoo-yellow"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="relative z-10 bg-kenoo-yellow rounded-full p-2"
      >
        <Check className="h-4 w-4 text-neutral-800" />
      </motion.div>
    </motion.div>
    <div className="flex flex-col">
      <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="font-semibold text-sm text-neutral-900">
        {message || "Company synced successfully"}
      </motion.span>
      {companyName && (
        <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="text-xs text-neutral-600">
          {companyName}
        </motion.span>
      )}
    </div>
  </div>
);

const DROPDOWN_OFFSET = 8;
const DROPDOWN_WIDTH = 240;

export function CreateCompanyPopup({
  isOpen,
  onClose,
  onManualAdd,
  onCompanyAdded,
  anchorRect = null,
  triggerRef,
}: CreateCompanyPopupProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showApolloUrlInput, setShowApolloUrlInput] = useState(false);
  const [apolloUrl, setApolloUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showParsedResult, setShowParsedResult] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const preview: CompanySyncPreview | null = React.useMemo(
    () => getApolloCompanyPreview(apolloUrl),
    [apolloUrl]
  );

  useEffect(() => {
    if (preview) {
      setShowParsedResult(false);
      const t = setTimeout(() => setShowParsedResult(true), 420);
      return () => clearTimeout(t);
    } else {
      setShowParsedResult(false);
    }
  }, [preview]);

  useEffect(() => {
    if (!isOpen || !anchorRect || !isMounted) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef?.current?.contains(target)) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) onClose();
    };
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [isOpen, anchorRect, onClose, isMounted, triggerRef]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && isMounted) setIsDialogOpen(true);
    else setIsDialogOpen(false);
  }, [isOpen, isMounted]);

  const handleClose = () => {
    if (!isDialogOpen) return;
    setIsDialogOpen(false);
    setTimeout(() => onClose(), 300);
  };

  const handleSyncApolloUrl = async () => {
    if (!preview) {
      wallsToast.error("Please enter a valid Apollo URL or company domain");
      return;
    }

    setIsSyncing(true);
    try {
      const result = await runApolloCompanySync(apolloUrl);
      if (result.ok === false) {
        wallsToast.error(result.error);
        return;
      }

      wallsToast.success(result.message ?? "Company saved", result.companyName ?? undefined);

      setShowApolloUrlInput(false);
      setApolloUrl("");
      onCompanyAdded?.();
      setTimeout(() => onClose(), 300);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isMounted) return null;

  const buttonClass =
    "w-full text-left p-3 rounded-lg border border-neutral-200/50 bg-neutral-100 backdrop-blur-md shadow-inner hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-colors duration-200";

  const dropdownContainerVariants = {
    hidden: { opacity: 0, scale: 0.96, y: -6 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const } },
  };

  const dropdownListVariants = {
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
    exit: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
  };

  const dropdownItemVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, y: -4, scale: 0.95, transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as const } },
  };

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
                <motion.div className="space-y-3" variants={dropdownListVariants} initial="hidden" animate="visible" exit="exit">
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
                          <span className="text-xs text-gray-600 mt-0.5 font-light">Manually create company</span>
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
                          alt="Apollo"
                          width={16}
                          height={16}
                          className="h-4 w-4 object-contain shrink-0"
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium text-gray-800 text-sm">Apollo Sync</span>
                          <span className="text-xs text-gray-600 mt-0.5 font-light">Create via URL</span>
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
            <DialogContent showCloseButton={false} className="sm:max-w-[400px] w-full bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
              <div className="relative">
                <div className="mt-2 space-y-4">
                  <div>
                    <div className="rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-2 pl-4 py-2">
                      <div className="relative w-full flex items-center gap-2">
                        {preview ? (
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
                                  <span className="font-normal capitalize mr-1">{preview.label}:</span>
                                  <span className="font-mono text-neutral-400" title={preview.value}>
                                    {preview.value}
                                  </span>
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
                              Invalid URL — paste an Apollo URL or a company domain
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
                            placeholder="Paste Apollo URL"
                            className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full placeholder:text-neutral-400/80"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && apolloUrl.trim() && !isSyncing) handleSyncApolloUrl();
                              else if (e.key === "Escape") {
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
                      disabled={isSyncing || !preview}
                      className="w-8 h-8 rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 flex items-center justify-center hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? (
                        <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 text-gray-700 group-hover:text-kenoo-yellow transition-colors" />
                      )}
                    </button>
                  </div>
                  {isSyncing && (
                    <p className="text-xs text-neutral-500 pt-1">
                      Syncing can take 1–2 minutes. You can close this and refresh the companies list when it’s done.
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent showCloseButton={false} className="w-full max-w-[240px] bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden p-4">
          <div className="space-y-3">
            <button
              onClick={() => {
                handleClose();
                if (onManualAdd) setTimeout(() => onManualAdd(), 300);
              }}
              className={buttonClass}
            >
              <div className="flex items-center gap-3">
                <Plus className="h-4 w-4 text-gray-700 shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-gray-800 text-sm">Manual Add</span>
                  <span className="text-xs text-gray-600 mt-0.5 font-light">Manually create company</span>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                handleClose();
                setTimeout(() => setShowApolloUrlInput(true), 300);
              }}
              className={buttonClass}
            >
              <div className="flex items-center gap-3">
                <Image
                  src="https://assets.wallsentertainment.com/apollo-logo-v2.png"
                  alt="Apollo"
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain shrink-0"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-gray-800 text-sm">Apollo Sync</span>
                  <span className="text-xs text-gray-600 mt-0.5 font-light">Create via URL</span>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
          <DialogContent showCloseButton={false} className="sm:max-w-[400px] w-full bg-white/80 backdrop-blur-xl border border-white/30 shadow-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
            <div className="relative">
              <div className="mt-2 space-y-4">
                <div>
                  <div className="rounded-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-2 pl-4 py-2">
                    <div className="relative w-full flex items-center gap-2">
                      {preview ? (
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
                              <span className="font-normal capitalize mr-1">{preview.label}:</span>
                              <span className="font-mono text-neutral-400" title={preview.value}>
                                {preview.value}
                              </span>
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
                            Invalid URL — paste an Apollo URL or a company domain
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
                          placeholder="Paste Apollo URL"
                          className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full placeholder:text-neutral-400/80"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && apolloUrl.trim() && !isSyncing) handleSyncApolloUrl();
                            else if (e.key === "Escape") {
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
                    disabled={isSyncing || !preview}
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
