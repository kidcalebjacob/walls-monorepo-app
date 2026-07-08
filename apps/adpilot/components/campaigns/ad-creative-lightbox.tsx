"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";

import type { AdCreativePreview } from "@/lib/meta-creatives";

type AdCreativeLightboxProps = {
  open: boolean;
  onClose: () => void;
  adName: string;
  adId?: string | null;
  preview: AdCreativePreview | null;
};

export function AdCreativeLightbox({
  open,
  onClose,
  adName,
  adId,
  preview,
}: AdCreativeLightboxProps) {
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [previewState, setPreviewState] = React.useState<
    "loading" | "ready" | "error"
  >("loading");

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;

    if (!adId) {
      setPreviewState("error");
      return;
    }

    setPreviewHtml(null);
    setPreviewState("loading");

    (async () => {
      try {
        const response = await fetch(`/api/campaigns/ads/${adId}/preview`);
        if (!response.ok) throw new Error("preview failed");
        const data = (await response.json()) as { html?: string };
        if (!data.html) throw new Error("no html");
        if (cancelled) return;
        setPreviewHtml(data.html);
        setPreviewState("ready");
      } catch {
        if (!cancelled) setPreviewState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, adId]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && preview ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Creative preview for ${adName}`}
        >
          <button
            type="button"
            onClick={onClose}
            className="fixed right-5 top-5 z-[210] rounded-full bg-white/10 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[92vh] items-center justify-center overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            {previewState === "ready" && previewHtml ? (
              <div
                className="[&_iframe]:max-w-full [&_iframe]:rounded-lg"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : previewState === "loading" ? (
              <div className="flex flex-col items-center gap-3 text-white/70">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs font-light">Loading preview…</span>
              </div>
            ) : (
              <p className="max-w-xs text-center text-sm font-light text-white/70">
                Preview isn&apos;t available for this ad right now.
              </p>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
