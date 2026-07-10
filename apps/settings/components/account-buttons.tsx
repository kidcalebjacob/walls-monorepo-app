"use client";

import { Button } from "@/components/ui/button";

interface SaveAccountProps {
  clickable?: boolean;
  handleSave?: () => void | Promise<boolean>;
  buttonClassName?: string;
}

export function SaveAccount({
  clickable = false,
  handleSave,
  buttonClassName,
}: SaveAccountProps) {
  return (
    <Button
      type="button"
      disabled={!clickable}
      className={buttonClassName}
      onClick={() => {
        void handleSave?.();
      }}
    >
      Save
    </Button>
  );
}
