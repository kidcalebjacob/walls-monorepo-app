"use client";

import * as React from "react";
import { Input } from "@/components/ui/borderless-input";
import type { TeamMemberFormData } from "./types";
import { FIELD_CLASS } from "./field-styles";

export function TeamRoleSection({
  formData,
  setFormData,
}: {
  formData: TeamMemberFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberFormData>>;
}) {
  return (
    <div className="space-y-6">
      <Input
        value={formData.title}
        onChange={(e) =>
          setFormData((p) => ({ ...p, title: e.target.value }))
        }
        placeholder="Job title"
        className={FIELD_CLASS}
      />
      <Input
        value={formData.linkedinUrl}
        onChange={(e) =>
          setFormData((p) => ({ ...p, linkedinUrl: e.target.value }))
        }
        placeholder="LinkedIn URL (optional)"
        className={FIELD_CLASS}
      />
    </div>
  );
}
