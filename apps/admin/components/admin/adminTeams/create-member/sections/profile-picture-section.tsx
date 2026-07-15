"use client";

import * as React from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

export function ProfilePictureSection({
  previewUrl,
  handleProfilePictureChange,
}: {
  previewUrl: string | null;
  handleProfilePictureChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const hintWords = React.useMemo(() => ["Add", "profile", "photo"], []);
  const containerVariants = React.useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.08, delayChildren: 0.05 },
      },
    }),
    [],
  );

  const wordVariants = React.useMemo(
    () => ({
      hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
      visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      },
    }),
    [],
  );

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <input
        id="team-member-profile-upload"
        type="file"
        accept="image/*"
        onChange={handleProfilePictureChange}
        className="hidden"
      />

      <label
        htmlFor="team-member-profile-upload"
        className="group relative block cursor-pointer"
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Profile preview"
            width={160}
            height={160}
            className="rounded-full object-cover"
            style={{ width: "160px", height: "160px" }}
            unoptimized
          />
        ) : (
          <div className="flex h-[160px] w-[160px] items-center justify-center rounded-full border border-neutral-200/50 bg-neutral-100/80 shadow-inner backdrop-blur-md">
            <Plus className="h-9 w-9 text-neutral-500" strokeWidth={1.5} />
          </div>
        )}

        {previewUrl ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Plus className="h-9 w-9 text-white" strokeWidth={1.5} />
          </div>
        ) : null}
      </label>

      <div className="h-5">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="select-none text-sm font-light tracking-wide text-neutral-400"
        >
          {hintWords.map((w) => (
            <motion.span key={w} variants={wordVariants} className="inline-block">
              {w}
              <span className="inline-block w-1.5" />
            </motion.span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
