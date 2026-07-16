"use client";

import * as React from "react";

import { Slider } from "@walls/ui/slider";
import { cn } from "@walls/utils";

type SliderEndLabels = {
  left: string;
  center?: string;
  right: string;
};

type SliderFieldProps = {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
  endLabels?: SliderEndLabels;
  showMarks?: boolean;
};

function buildMarks(min: number, max: number, step: number): number[] {
  const totalSteps = Math.round((max - min) / step);

  if (totalSteps <= 10) {
    return Array.from({ length: totalSteps + 1 }, (_, index) => min + index * step);
  }

  const markCount = 11;
  return Array.from({ length: markCount }, (_, index) => {
    if (index === 0) return min;
    if (index === markCount - 1) return max;
    return Math.round(min + ((max - min) * index) / (markCount - 1));
  });
}

function closestMark(marks: number[], value: number): number {
  return marks.reduce((closest, mark) =>
    Math.abs(mark - value) < Math.abs(closest - value) ? mark : closest,
  );
}

export function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  endLabels,
  showMarks = true,
}: SliderFieldProps) {
  const marks = React.useMemo(() => buildMarks(min, max, step), [min, max, step]);
  const activeMark = closestMark(marks, value);
  const valueLabel = `${value}${suffix ?? ""}`;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-1">
        <p className="text-[11px] font-normal uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </p>
        <p className="text-xl font-light tracking-tight text-neutral-900 transition-opacity duration-200 sm:text-2xl">
          {valueLabel}
        </p>
        {hint ? (
          <p className="text-xs font-light text-neutral-500">{hint}</p>
        ) : (
          <p className="text-xs font-light text-neutral-500">
            {min}
            {suffix ?? ""} – {max}
            {suffix ?? ""}
          </p>
        )}
      </div>

      <div className="pt-1">
        {showMarks ? (
          <div className="mb-3 flex justify-between px-0.5" aria-hidden>
            {marks.map((mark) => (
              <div
                key={mark}
                className={cn(
                  "h-3 w-px rounded-full transition-colors duration-200",
                  mark === activeMark ? "bg-[var(--kenoo-sky)]" : "bg-neutral-300/90",
                )}
              />
            ))}
          </div>
        ) : null}

        <Slider
          value={[value]}
          onValueChange={(next) => onChange(next[0] ?? value)}
          min={min}
          max={max}
          step={step}
          aria-label={label}
        />

        {endLabels ? (
          <div className="relative mt-6 w-full text-[10px] font-normal uppercase tracking-[0.12em] text-neutral-500 sm:text-[11px]">
            <span className="text-left">{endLabels.left}</span>
            {endLabels.center ? (
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
                {endLabels.center}
              </span>
            ) : null}
            <span className="absolute right-0 text-right">{endLabels.right}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
