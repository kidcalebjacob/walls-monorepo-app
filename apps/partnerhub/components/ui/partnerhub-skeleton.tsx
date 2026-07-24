"use client";

import React from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { motion } from 'framer-motion';

interface PartnerHubSkeletonProps {
  count?: number;
  onRef?: (el: HTMLDivElement | null, index: number) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>, index: number) => void;
  nameColumnWidth?: number;
}

export function PartnerHubSkeleton({
  count = 12,
}: PartnerHubSkeletonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-0 pt-16">
      <Image
        src={FALLBACK_ICON_URL}
        alt="Loading"
        width={180}
        height={180}
        className="rounded-full object-cover aspect-square"
      />
      <div className="w-48 h-1 bg-neutral-200 rounded-full overflow-hidden -mt-9">
        <motion.div
          className="h-full bg-[#e2f85c] rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{
            duration: 1.5,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      </div>
    </div>
  );
}
