"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Command, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { PersonalSection } from "./sections/personal-section";
import { ProfilePictureSection } from "./sections/profile-picture-section";
import { TeamRoleSection } from "./sections/team-role-section";
import {
  initialTeamMemberFormData,
  type TeamMemberFormData,
} from "./sections/types";

export type { TeamMemberFormData } from "./sections/types";

const TOOLBAR_HOVER_RING =
  "relative z-10 box-border border border-transparent px-4 py-2 rounded-full transition-all duration-300 ease-in-out " +
  "group-hover:bg-gray-50 group-hover:border-neutral-200 " +
  "group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95";

interface CreateTeamMemberProps {
  teamGroupId: string;
}

export function CreateTeamMember({ teamGroupId }: CreateTeamMemberProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<TeamMemberFormData>(
    initialTeamMemberFormData,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const agencyDomains = useMemo(
    () => ["@wallsentertainment.com", "@walls.agency"],
    [],
  );
  const [agencyEmailLocal, setAgencyEmailLocal] = useState("");
  const [agencyEmailDomain, setAgencyEmailDomain] = useState<string>(
    agencyDomains[0],
  );

  useEffect(() => {
    const current = (formData.email || "").trim().toLowerCase();
    const matchedDomain = agencyDomains.find((d) => current.endsWith(d));
    if (matchedDomain) {
      setAgencyEmailDomain(matchedDomain);
      setAgencyEmailLocal(current.slice(0, -matchedDomain.length));
      return;
    }

    if (current.includes("@")) {
      const [local, domain] = current.split("@");
      const normalizedDomain = domain ? `@${domain}` : agencyDomains[0];
      setAgencyEmailLocal(local || "");
      setAgencyEmailDomain(
        agencyDomains.includes(normalizedDomain)
          ? normalizedDomain
          : agencyDomains[0],
      );
      return;
    }

    setAgencyEmailLocal(current);
    setAgencyEmailDomain(agencyDomains[0]);
  }, [agencyDomains, formData.email]);

  const stepConfig = useMemo(
    () => [
      { id: "personal", title: "Personal information" },
      { id: "avatar", title: "Profile picture" },
      { id: "team", title: "Role & contact" },
    ],
    [],
  );
  const totalSteps = stepConfig.length;
  const isLastStep = stepIdx === totalSteps - 1;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFormData((prev) => ({ ...prev, profilePicture: file }));
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    }
  };

  const syncAgencyEmailFromBuilder = useCallback(() => {
    const local = (agencyEmailLocal || "").trim();
    const nextEmail = local ? `${local}${agencyEmailDomain}` : "";
    setFormData((prev) => ({ ...prev, email: nextEmail }));
  }, [agencyEmailDomain, agencyEmailLocal]);

  const canGoNext = useMemo(() => {
    const step = stepConfig[stepIdx]?.id;
    if (step === "personal") {
      const firstOk = (formData.firstName || "").trim().length > 0;
      const localOk = (agencyEmailLocal || "").trim().length > 0;
      const email = `${(agencyEmailLocal || "").trim()}${agencyEmailDomain}`;
      const domainOk = agencyDomains.some((d) => email.endsWith(d));
      return firstOk && localOk && domainOk;
    }
    if (step === "avatar") return true;
    if (step === "team") {
      return (formData.title || "").trim().length > 0;
    }
    return true;
  }, [
    agencyDomains,
    agencyEmailDomain,
    agencyEmailLocal,
    formData.firstName,
    formData.title,
    stepConfig,
    stepIdx,
  ]);

  const goNext = useCallback(() => {
    if (!canGoNext) {
      wallsToast.error("Missing required fields", "Add first name and a valid agency email to continue.");
      return;
    }
    syncAgencyEmailFromBuilder();
    setStepIdx((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [canGoNext, syncAgencyEmailFromBuilder, totalSteps]);

  const goBack = useCallback(() => {
    if (stepIdx === 0) {
      router.push(`/teams/${teamGroupId}`);
      return;
    }
    syncAgencyEmailFromBuilder();
    setStepIdx((prev) => Math.max(prev - 1, 0));
  }, [router, stepIdx, syncAgencyEmailFromBuilder, teamGroupId]);

  const handleSave = useCallback(async () => {
    if (!(formData.title || "").trim()) {
      wallsToast.error("Title required", "Add a job title before saving.");
      return;
    }
    setIsSubmitting(true);
    try {
      syncAgencyEmailFromBuilder();
      const local = (agencyEmailLocal || "").trim();
      const agencyEmail = local ? `${local}${agencyEmailDomain}` : formData.email.trim();

      if (!agencyEmail) {
        throw new Error("Agency email is required");
      }

      const res = await fetch("/api/admin/create-team-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamGroupId,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim() || null,
          email: agencyEmail,
          personalEmail: formData.personalEmail.trim() || null,
          phoneNumber: formData.phoneNumber.trim() || null,
          title: formData.title.trim(),
          linkedinUrl: formData.linkedinUrl.trim() || null,
          teamEmail: agencyEmail,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        userId?: string;
        tempPassword?: string;
        phoneExtension?: number;
      };

      if (!res.ok) {
        throw new Error(json.error || "Failed to create team member");
      }

      const userId = json.userId;
      if (formData.profilePicture && userId) {
        const uploadForm = new FormData();
        uploadForm.append("file", formData.profilePicture);
        uploadForm.append("userId", userId);
        const uploadRes = await fetch("/api/upload-team-member-avatar", {
          method: "POST",
          body: uploadForm,
        });
        if (!uploadRes.ok) {
          const u = (await uploadRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(u.error || "User created but avatar upload failed");
        }
      }

      const ext =
        json.phoneExtension != null ? `Extension ${json.phoneExtension}. ` : "";
      wallsToast.success("Team member added", json.tempPassword);

      router.push(`/teams/${teamGroupId}`);
    } catch (e) {
      wallsToast.error("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    agencyEmailDomain,
    agencyEmailLocal,
    formData,
    router,
    syncAgencyEmailFromBuilder,
    teamGroupId,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isSubmitting && isLastStep) void handleSave();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        router.push(`/teams/${teamGroupId}`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, isLastStep, isSubmitting, router, teamGroupId]);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-gray-50">
      <div
        key={stepConfig[stepIdx]?.id}
        className="animate-in fade-in-0 slide-in-from-right-2 flex min-h-0 flex-1 flex-col duration-200"
      >
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center overflow-y-auto px-6 py-8">
          <div className="w-full space-y-8">
            {stepConfig[stepIdx]?.id === "personal" ? (
              <PersonalSection
                formData={formData}
                setFormData={setFormData}
                agencyEmailLocal={agencyEmailLocal}
                setAgencyEmailLocal={setAgencyEmailLocal}
                agencyEmailDomain={agencyEmailDomain}
                setAgencyEmailDomain={setAgencyEmailDomain}
                agencyDomains={agencyDomains}
              />
            ) : null}

            {stepConfig[stepIdx]?.id === "avatar" ? (
              <ProfilePictureSection
                previewUrl={previewUrl}
                handleProfilePictureChange={handleProfilePictureChange}
              />
            ) : null}

            {stepConfig[stepIdx]?.id === "team" ? (
              <TeamRoleSection formData={formData} setFormData={setFormData} />
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-8 right-8 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="pointer-events-auto relative h-10 bg-transparent p-0 shadow-none hover:bg-transparent group disabled:pointer-events-auto disabled:opacity-50"
          onClick={goBack}
          disabled={isSubmitting}
        >
          <div className={TOOLBAR_HOVER_RING}>
            <div className="flex items-center gap-2 text-neutral-600">
              <ArrowLeft className="h-4 w-4 stroke-[1.5] text-neutral-500" />
              <span className="text-sm font-light">Back</span>
            </div>
          </div>
        </Button>

        {!isLastStep ? (
          <Button
            type="button"
            variant="ghost"
            className="pointer-events-auto relative h-10 bg-transparent p-0 shadow-none hover:bg-transparent group disabled:pointer-events-auto disabled:opacity-50"
            onClick={goNext}
            disabled={isSubmitting || !canGoNext}
          >
            <div className={TOOLBAR_HOVER_RING}>
              <div className="flex items-center gap-2 text-neutral-600">
                <span className="text-sm font-light">Next</span>
                <ArrowRight className="h-4 w-4 stroke-[1.5] text-neutral-500" />
              </div>
            </div>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="pointer-events-auto relative h-10 bg-transparent p-0 shadow-none hover:bg-transparent group disabled:pointer-events-auto disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className={TOOLBAR_HOVER_RING}>
                <div className="flex items-center gap-2 text-neutral-600">
                  <Loader2 className="h-4 w-4 animate-spin stroke-[1.5] text-neutral-500" />
                  <span className="text-sm font-light">Saving…</span>
                </div>
              </div>
            ) : (
              <div className={TOOLBAR_HOVER_RING}>
                <div className="flex items-center gap-2 text-neutral-600">
                  <span className="text-sm font-light">Save</span>
                  <div className="flex items-center gap-1 bg-transparent text-xs text-neutral-500">
                    <Command className="h-3 w-3" />
                    <span>S</span>
                  </div>
                </div>
              </div>
            )}
          </Button>
        )}
      </div>

      <Toaster />
    </div>
  );
}
