"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { cn } from '@walls/utils';
import type { ForecastPoint } from "./agents-ledger-forecast";

type ForecastMetric = "net" | "incomeAndExpenses";

interface ForecastChartProps {
  forecastPoints: ForecastPoint[];
}

export function ForecastChart({ forecastPoints }: ForecastChartProps) {
  const [metric, setMetric] = useState<ForecastMetric>("incomeAndExpenses");

  // Find the index where projections start (actual becomes null)
  const dividerIndex = forecastPoints.findIndex((p) => p.actual === null);
  const dividerMonth = dividerIndex > 0 ? forecastPoints[dividerIndex]?.month : undefined;

  return (
    <div>
      {/* Metric tabs */}
      <div className="flex items-center gap-2 mb-2 -ml-2">
        {(["incomeAndExpenses", "net"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            className={cn(
              "relative px-4 py-2 group hover:bg-transparent font-light text-xs uppercase tracking-wider transition-colors",
              metric === key
                ? "text-neutral-800"
                : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            {key === "incomeAndExpenses" ? "Income & expenses" : "Net"}
            <div
              className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-neutral-800 transition-all duration-300",
                metric === key
                  ? "w-4/5 mx-auto right-0"
                  : "w-0 group-hover:w-4/5 group-hover:mx-auto group-hover:right-0"
              )}
            />
          </button>
        ))}
        <span className="ml-2 text-xs text-neutral-400 font-light">
          — projected
        </span>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={forecastPoints}
            margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="forecastFillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--kenoo-lime)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--kenoo-lime)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastFillExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff1744" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#ff1744" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastFillNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--kenoo-lime)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--kenoo-lime)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastFillProjected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(148 163 184)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="rgb(148 163 184)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgb(212 212 212)"
              vertical={true}
              horizontal={true}
            />

            {/* Vertical divider line where projections begin */}
            {dividerMonth && (
              <ReferenceLine
                x={dividerMonth}
                stroke="rgb(163 163 163)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}

            <XAxis
              dataKey="month"
              axisLine={{ stroke: "rgb(212 212 212)" }}
              tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgb(115 115 115)", fontSize: 11 }}
              tickFormatter={(v) =>
                v >= 1000
                  ? `$${(v / 1000).toFixed(1)}k`
                  : `$${Number(v).toFixed(0)}`
              }
              domain={["auto", "auto"]}
              width={44}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgb(38 38 38)",
                border: "1px solid rgb(64 64 64)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "rgb(212 212 216)" }}
              itemStyle={{ color: "rgb(212 212 216)" }}
              formatter={(value: number, name: string) => {
                const labelMap: Record<string, string> = {
                  income: "Income",
                  expenses: "Expenses",
                  actual: "Net (actual)",
                  projected: "Net (projected)",
                  projectedIncome: "Income (projected)",
                  projectedExpenses: "Expenses (projected)",
                  probableIncomeFromDeals: "Probable income (deals)",
                };
                const label = labelMap[name] ?? name;
                const display =
                  typeof value === "number" && value >= 1000
                    ? `$${(value / 1000).toFixed(2)}k`
                    : `$${Number(value).toFixed(2)}`;
                return [display, label];
              }}
              labelFormatter={(label) => label}
            />

            {metric === "incomeAndExpenses" ? (
              <>
                {/* Actual income */}
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="var(--kenoo-lime)"
                  strokeWidth={2.5}
                  fill="url(#forecastFillIncome)"
                  name="income"
                  connectNulls={false}
                />
                {/* Actual expenses */}
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ff1744"
                  strokeWidth={2.5}
                  fill="url(#forecastFillExpenses)"
                  name="expenses"
                  connectNulls={false}
                />
                {/* Projected income (dashed) */}
                <Area
                  type="monotone"
                  dataKey="projectedIncome"
                  stroke="var(--kenoo-lime)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  fill="url(#forecastFillIncome)"
                  fillOpacity={0.5}
                  name="projectedIncome"
                  connectNulls={false}
                />
                {/* Projected expenses (dashed) */}
                <Area
                  type="monotone"
                  dataKey="projectedExpenses"
                  stroke="#ff1744"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  fill="url(#forecastFillExpenses)"
                  fillOpacity={0.5}
                  name="projectedExpenses"
                  connectNulls={false}
                />
                {/* Probable income from deals (pipeline), dashed line */}
                <Area
                  type="monotone"
                  dataKey="probableIncomeFromDeals"
                  stroke="#6366f1"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  fill="transparent"
                  name="probableIncomeFromDeals"
                  connectNulls={false}
                />
              </>
            ) : (
              <>
                {/* Actual net */}
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--kenoo-lime)"
                  strokeWidth={2.5}
                  fill="url(#forecastFillNet)"
                  name="actual"
                  connectNulls={false}
                />
                {/* Projected net (dashed) */}
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="rgb(148 163 184)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  fill="url(#forecastFillProjected)"
                  name="projected"
                  connectNulls={false}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
