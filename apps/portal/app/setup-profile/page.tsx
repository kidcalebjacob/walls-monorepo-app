"use client";

import * as React from "react";
import { Camera, Loader2, User } from "lucide-react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@walls/auth";
import { useUploadProfilePicture } from "@walls/storage/react";
import { Avatar, AvatarFallback, AvatarImage } from "@walls/ui/avatar";

import { AuthHeading, AuthShell } from "@/components/kenoo/auth-shell";

export default function SetupProfilePage() {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = React.useState(true);

  const { mutate: uploadProfilePicture, isUploading } = useUploadProfilePicture({
    onError: (uploadError) => {
      setError(uploadError.message || "Failed to upload profile picture");
    },
  });

  React.useEffect(() => {
    const checkSession = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setIsCheckingSession(false);
    };

    void checkSession();
  }, [router]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const goToApps = React.useCallback(() => {
    router.push("/login");
  }, [router]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    setError(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);

    try {
      await uploadProfilePicture(file);
      goToApps();
    } catch {
      // Error state is set via onError.
    }
  };

  if (isCheckingSession) {
    return (
      <AuthShell>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-kenoo-muted" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Add a profile picture"
        description="Help your team recognize you across Kenoo apps."
      />

      <div className="flex w-full flex-col items-center space-y-4">
        {error ? (
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Upload profile picture"
          className="group relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-kenoo-border bg-kenoo-subtle transition-colors hover:border-kenoo-sky hover:bg-kenoo-sky/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kenoo-sky/30 disabled:opacity-60"
        >
          <Avatar className="h-full w-full">
            {previewUrl ? (
              <AvatarImage src={previewUrl} alt="Profile preview" />
            ) : null}
            <AvatarFallback className="bg-transparent text-kenoo-muted">
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-kenoo-sky" />
              ) : (
                <User className="h-10 w-10 transition-colors group-hover:text-kenoo-sky" />
              )}
            </AvatarFallback>
          </Avatar>
          {!isUploading ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-kenoo-ink/0 opacity-0 transition-opacity group-hover:bg-kenoo-ink/40 group-hover:opacity-100">
              <Camera className="h-7 w-7 text-white" />
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-sm font-medium text-kenoo-ink transition-colors hover:text-kenoo-sky disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : "Upload profile picture"}
        </button>

        <button
          type="button"
          onClick={goToApps}
          disabled={isUploading}
          className="text-sm font-medium text-kenoo-sky transition-colors hover:text-kenoo-sky-hover disabled:opacity-60"
        >
          Skip
        </button>
      </div>
    </AuthShell>
  );
}
