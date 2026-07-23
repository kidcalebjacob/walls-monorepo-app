"use client";

import { FloatingLabelInput } from "@/components/ui/floating-label-input";

interface AutocompleteComponentProps {
  setAddressNew: (address: string) => void;
  existingAddress?: string;
  inputClassName?: string;
  label?: string;
  placeholder?: string;
}

export function AutocompleteComponent({
  setAddressNew,
  existingAddress = "",
  inputClassName,
  label = "Address",
}: AutocompleteComponentProps) {
  return (
    <FloatingLabelInput
      label={label}
      defaultValue={existingAddress}
      className={inputClassName}
      onChange={(event) => setAddressNew(event.target.value)}
    />
  );
}
