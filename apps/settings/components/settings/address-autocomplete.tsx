"use client";

import { Input } from "@/components/ui/input";

interface AutocompleteComponentProps {
  setAddressNew: (address: string) => void;
  existingAddress?: string;
  inputClassName?: string;
  placeholder?: string;
}

export function AutocompleteComponent({
  setAddressNew,
  existingAddress = "",
  inputClassName,
  placeholder = "Enter address",
}: AutocompleteComponentProps) {
  return (
    <Input
      defaultValue={existingAddress}
      placeholder={placeholder}
      className={inputClassName}
      onChange={(event) => setAddressNew(event.target.value)}
    />
  );
}
