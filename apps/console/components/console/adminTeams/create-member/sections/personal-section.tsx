"use client";

import * as React from "react";
import { Input } from "@/components/ui/borderless-input";
import { BorderlessSelect } from "@/components/ui/borderless-select";
import type { TeamMemberFormData } from "./types";
import { FIELD_CLASS } from "./field-styles";

export function PersonalSection({
  formData,
  setFormData,
  agencyEmailLocal,
  setAgencyEmailLocal,
  agencyEmailDomain,
  setAgencyEmailDomain,
  agencyDomains,
}: {
  formData: TeamMemberFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberFormData>>;
  agencyEmailLocal: string;
  setAgencyEmailLocal: (value: string) => void;
  agencyEmailDomain: string;
  setAgencyEmailDomain: (value: string) => void;
  agencyDomains: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          value={formData.firstName}
          onChange={(e) =>
            setFormData((p) => ({ ...p, firstName: e.target.value }))
          }
          placeholder="First name"
          className={FIELD_CLASS}
        />
        <Input
          value={formData.lastName}
          onChange={(e) =>
            setFormData((p) => ({ ...p, lastName: e.target.value }))
          }
          placeholder="Last name"
          className={FIELD_CLASS}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px]">
        <Input
          value={agencyEmailLocal}
          onChange={(e) => {
            const nextLocal = e.target.value.trim().replace(/\s+/g, "");
            setAgencyEmailLocal(nextLocal);
            setFormData((prev) => ({
              ...prev,
              email: nextLocal ? `${nextLocal}${agencyEmailDomain}` : "",
            }));
          }}
          placeholder="Agency email"
          className={`${FIELD_CLASS} h-10`}
        />
        <BorderlessSelect
          value={agencyEmailDomain}
          onValueChange={(v) => {
            setAgencyEmailDomain(v);
            setFormData((prev) => ({
              ...prev,
              email: agencyEmailLocal.trim()
                ? `${agencyEmailLocal.trim()}${v}`
                : "",
            }));
          }}
          placeholder="Select domain"
          items={agencyDomains.map((d) => ({ value: d, label: d }))}
        />
      </div>

      <Input
        type="email"
        value={formData.personalEmail}
        onChange={(e) =>
          setFormData((p) => ({ ...p, personalEmail: e.target.value }))
        }
        placeholder="Personal email (optional)"
        className={FIELD_CLASS}
      />

      <Input
        value={formData.phoneNumber}
        onChange={(e) =>
          setFormData((p) => ({ ...p, phoneNumber: e.target.value }))
        }
        placeholder="Phone number (optional)"
        className={FIELD_CLASS}
      />
    </div>
  );
}
