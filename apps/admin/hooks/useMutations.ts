"use client";

import { useCallback } from "react";

import { wallsToast } from "@/components/ui/walls-toast";
import { useUploadOrganizationIcon as useR2UploadOrganizationIcon } from "@walls/storage/react";

export function useUploadOrganizationIcon(organizationId: string | null) {
  const { mutate: uploadOrganizationIcon, isUploading } =
    useR2UploadOrganizationIcon(organizationId, {
      onSuccess: () => {
        wallsToast.success("Icon updated", "Organization icon has been saved");
      },
      onError: () => {
        wallsToast.error("Upload failed", "Could not update organization icon");
      },
    });

  const mutate = useCallback(
    async (file: File) => {
      try {
        return await uploadOrganizationIcon(file);
      } catch {
        return null;
      }
    },
    [uploadOrganizationIcon],
  );

  return { mutate, isUploading };
}
