"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface SquareImageCropProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onCropComplete: (file: File) => void;
}

export function SquareImageCrop({
  open,
  onOpenChange,
  imageUrl,
  onCropComplete,
}: SquareImageCropProps) {
  const handleConfirm = async () => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], "avatar.jpg", {
      type: blob.type || "image/jpeg",
    });
    onCropComplete(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Profile preview"
            className="mx-auto max-h-64 w-full rounded-lg object-cover"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Use image</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
