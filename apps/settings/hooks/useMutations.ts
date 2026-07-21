"use client";

import { useCallback } from "react";

import { wallsToast } from "@/components/ui/walls-toast";
import {
  useUploadProfilePicture as useR2UploadProfilePicture,
} from "@walls/storage/react";

export function useUploadProfilePicture() {
  const { mutate: uploadProfilePicture, isUploading } = useR2UploadProfilePicture({
    onSuccess: () => {
      wallsToast.success(
        "Profile picture updated",
        "Your avatar has been saved",
      );
    },
    onError: () => {
      wallsToast.error("Upload failed", "Could not update profile picture");
    },
  });

  const mutate = useCallback(
    async (file: File) => {
      try {
        await uploadProfilePicture(file);
      } catch {
        // Toast handled in onError.
      }
    },
    [uploadProfilePicture],
  );

  return { mutate, isUploading };
}

export function useUploadTimezone() {
  const mutate = useCallback(async (_timezone: string) => {
    // Stub — timezone form handles persistence directly for now.
  }, []);

  return { mutate };
}
