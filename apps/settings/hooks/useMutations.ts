"use client";

import { useCallback } from "react";

import { wallsToast } from "@/components/ui/walls-toast";
import { getSupabaseClient, useAuth } from "@/lib/auth";

export function useUploadProfilePicture() {
  const { user } = useAuth();

  const mutate = useCallback(
    async (file: File) => {
      if (!user?.id) {
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const extension = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);

        const { error: updateError } = await supabase
          .from("users")
          .update({ avatar_url: publicUrlData.publicUrl })
          .eq("id", user.id);

        if (updateError) {
          throw updateError;
        }

        wallsToast.success(
          "Profile picture updated",
          "Your avatar has been saved",
        );
      } catch (error) {
        console.error("Error uploading profile picture:", error);
        wallsToast.error(
          "Upload failed",
          "Could not update profile picture",
        );
      }
    },
    [user?.id],
  );

  return { mutate };
}

export function useUploadTimezone() {
  const mutate = useCallback(async (_timezone: string) => {
    // Stub — timezone form handles persistence directly for now.
  }, []);

  return { mutate };
}
