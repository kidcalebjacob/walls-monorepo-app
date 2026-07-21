"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { FIELD_CLASS } from "@/components/console/adminTeams/create-member/sections/field-styles";

type Item = { value: string; label: string };

interface BorderlessSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  items: Item[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function BorderlessSelect({
  value,
  onValueChange,
  items,
  placeholder = "Select",
  disabled,
  className,
}: BorderlessSelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          FIELD_CLASS,
          "flex h-10 w-full items-center justify-between text-left outline-none",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-1">
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-neutral-100"
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
