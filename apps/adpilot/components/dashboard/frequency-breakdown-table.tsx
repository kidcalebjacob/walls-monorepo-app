"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@walls/utils";

import {
  formatFrequencyPercent,
  formatFrequencyReach,
  type FrequencyBreakdownsAnalytics,
} from "@/lib/frequency-breakdowns";

import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value";
import { SectionLabel } from "./dashboard-metrics";

type FrequencyBreakdownTableProps = {
  data: FrequencyBreakdownsAnalytics;
  className?: string;
};

export function FrequencyBreakdownTable({
  data,
  className,
}: FrequencyBreakdownTableProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <SectionLabel>Frequency breakdown</SectionLabel>
        <p className="mt-1 text-xs font-light text-neutral-500">
          Number of times people have seen your ads — reach and share of total
          reach by bucket.
        </p>
      </div>

      {!data.hasData || data.buckets.length === 0 ? (
        <p className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-4 py-10 text-center text-sm font-light text-neutral-400">
          No frequency distribution yet. Sync Meta to pull Ads Manager–style
          frequency buckets for the selected range.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200/80">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-neutral-50/95 px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-neutral-500 backdrop-blur-sm"
                >
                  Number of times people have seen your ads
                </th>
                {data.buckets.map((bucket) => (
                  <th
                    key={bucket.frequencyValue}
                    scope="col"
                    className="px-3 py-2.5 text-center text-[11px] font-medium tracking-wide text-neutral-600"
                  >
                    <span className="inline-flex whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                      {bucket.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <motion.tr
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-neutral-100"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-kenoo-white px-4 py-3 text-left text-sm font-medium text-neutral-900"
                >
                  Reach
                </th>
                {data.buckets.map((bucket) => (
                  <td
                    key={bucket.frequencyValue}
                    className="px-3 py-3 text-center text-sm font-light tabular-nums text-neutral-700"
                  >
                    <AnimatedMetricValue
                      value={formatFrequencyReach(bucket.reach)}
                    />
                  </td>
                ))}
              </motion.tr>
              <motion.tr
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 }}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-kenoo-white px-4 py-3 text-left text-sm font-medium text-neutral-900"
                >
                  % of Total Reach
                </th>
                {data.buckets.map((bucket) => (
                  <td
                    key={bucket.frequencyValue}
                    className="px-3 py-3 text-center text-sm font-light tabular-nums text-neutral-700"
                  >
                    <AnimatedMetricValue
                      value={formatFrequencyPercent(bucket.percentOfTotal)}
                    />
                  </td>
                ))}
              </motion.tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
