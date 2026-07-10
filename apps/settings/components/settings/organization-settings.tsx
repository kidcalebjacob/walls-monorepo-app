"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Plus } from "lucide-react";

import { wallsToast } from "@/components/ui/walls-toast";
import { Button } from "@/components/ui/button";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import type { OrganizationRecord } from "@/lib/organizations";

const fieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--walls-sky)] bg-transparent w-full placeholder:text-neutral-300";
const labelClass =
  "text-xs font-normal text-neutral-400 tracking-wide block mb-1";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function OrganizationAvatar({
  name,
  iconUrl,
}: {
  name: string;
  iconUrl: string | null;
}) {
  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        alt={`${name} icon`}
        width={64}
        height={64}
        className="h-16 w-16 rounded-2xl object-cover"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-lg font-semibold text-neutral-700">
      {initials || <Building2 className="h-6 w-6" />}
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    iconUrl: "",
    website: "",
    description: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    countryCode: "",
  });

  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    website: "",
    iconUrl: "",
  });

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedId) ?? null,
    [organizations, selectedId],
  );

  const canEdit = selectedOrganization
    ? selectedOrganization.role === "owner" ||
      selectedOrganization.role === "admin"
    : false;

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/organizations", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        organizations?: OrganizationRecord[];
      };

      const next = payload.organizations ?? [];
      setOrganizations(next);
      setSelectedId((current) => {
        if (current && next.some((organization) => organization.id === current)) {
          return current;
        }
        return next[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedOrganization) {
      setForm({
        name: "",
        slug: "",
        iconUrl: "",
        website: "",
        description: "",
        email: "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        stateProvince: "",
        postalCode: "",
        countryCode: "",
      });
      return;
    }

    setForm({
      name: selectedOrganization.name,
      slug: selectedOrganization.slug,
      iconUrl: selectedOrganization.iconUrl ?? "",
      website: selectedOrganization.website ?? "",
      description: selectedOrganization.description ?? "",
      email: selectedOrganization.email ?? "",
      phone: selectedOrganization.phone ?? "",
      addressLine1: selectedOrganization.addressLine1 ?? "",
      addressLine2: selectedOrganization.addressLine2 ?? "",
      city: selectedOrganization.city ?? "",
      stateProvince: selectedOrganization.stateProvince ?? "",
      postalCode: selectedOrganization.postalCode ?? "",
      countryCode: selectedOrganization.countryCode ?? "",
    });
  }, [selectedOrganization]);

  async function handleSave() {
    if (!selectedId || !canEdit) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/organizations/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          iconUrl: form.iconUrl.trim() || null,
          website: form.website.trim() || null,
          description: form.description.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          addressLine1: form.addressLine1.trim() || null,
          addressLine2: form.addressLine2.trim() || null,
          city: form.city.trim() || null,
          stateProvince: form.stateProvince.trim() || null,
          postalCode: form.postalCode.trim() || null,
          countryCode: form.countryCode.trim() || null,
        }),
      });

      if (!response.ok) {
        wallsToast.error("Error", "Failed to save organization settings");
        return;
      }

      const payload = (await response.json()) as {
        organization?: OrganizationRecord;
      };

      if (payload.organization) {
        setOrganizations((current) =>
          current.map((organization) =>
            organization.id === payload.organization!.id
              ? payload.organization!
              : organization,
          ),
        );
      }

      wallsToast.success("Saved", "Organization settings updated");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      wallsToast.error("Missing fields", "Organization name and slug are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          slug: createForm.slug.trim(),
          website: createForm.website.trim() || null,
          iconUrl: createForm.iconUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        wallsToast.error("Error", "Failed to create organization");
        return;
      }

      const payload = (await response.json()) as {
        organization?: OrganizationRecord;
      };

      if (payload.organization) {
        setOrganizations((current) => [...current, payload.organization!]);
        setSelectedId(payload.organization.id);
        setShowCreateForm(false);
        setCreateForm({ name: "", slug: "", website: "", iconUrl: "" });
        wallsToast.success("Created", "Organization created successfully");
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="mb-4 h-12 w-full" />
        <Skeleton className="mb-4 h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <Toaster />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Organization
          </h1>
          <p className="mt-1 text-sm font-light text-neutral-500">
            Manage organization profile, branding, and contact details shared
            across AdPilot and other WALLS apps.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full border border-neutral-200 bg-white px-4"
          onClick={() => setShowCreateForm((value) => !value)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New organization
        </Button>
      </div>

      {showCreateForm ? (
        <section className="mb-10 rounded-[24px] border border-neutral-200/70 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-neutral-500">
            Create organization
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>Name</label>
              <BorderlessInput
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug:
                      current.slug || slugify(event.target.value),
                  }))
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <BorderlessInput
                value={createForm.slug}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    slug: slugify(event.target.value),
                  }))
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <BorderlessInput
                value={createForm.website}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    website: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Icon URL</label>
              <BorderlessInput
                value={createForm.iconUrl}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    iconUrl: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={creating}
              className="rounded-full bg-walls-yellow text-black hover:bg-walls-yellow"
              onClick={() => void handleCreate()}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create organization
            </Button>
          </div>
        </section>
      ) : null}

      {organizations.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-neutral-300 bg-white p-10 text-center">
          <Building2 className="mx-auto mb-4 h-10 w-10 text-neutral-300" />
          <p className="text-sm font-light text-neutral-500">
            You are not part of an organization yet. Create one to share AdPilot
            data with your team.
          </p>
        </div>
      ) : (
        <>
          {organizations.length > 1 ? (
            <div className="mb-6 flex flex-wrap gap-2">
              {organizations.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  onClick={() => setSelectedId(organization.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    selectedId === organization.id
                      ? "border-walls-blue bg-walls-blue/10 text-walls-blue"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {organization.name}
                </button>
              ))}
            </div>
          ) : null}

          {selectedOrganization ? (
            <section className="rounded-[24px] border border-neutral-200/70 bg-white p-6 shadow-sm">
              <div className="mb-8 flex items-center gap-4">
                <OrganizationAvatar
                  name={form.name || selectedOrganization.name}
                  iconUrl={form.iconUrl.trim() || null}
                />
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {selectedOrganization.name}
                  </p>
                  <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">
                    {selectedOrganization.role}
                    {selectedOrganization.isDefault ? " · Default" : ""}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass}>Organization name</label>
                  <BorderlessInput
                    value={form.name}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Slug</label>
                  <BorderlessInput
                    value={form.slug}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        slug: slugify(event.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Website</label>
                  <BorderlessInput
                    value={form.website}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        website: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Icon URL</label>
                  <BorderlessInput
                    value={form.iconUrl}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        iconUrl: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Description</label>
                  <BorderlessInput
                    value={form.description}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <BorderlessInput
                    value={form.email}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <BorderlessInput
                    value={form.phone}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Address line 1</label>
                  <BorderlessInput
                    value={form.addressLine1}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressLine1: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Address line 2</label>
                  <BorderlessInput
                    value={form.addressLine2}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressLine2: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <BorderlessInput
                    value={form.city}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>State / Province</label>
                  <BorderlessInput
                    value={form.stateProvince}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        stateProvince: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Postal code</label>
                  <BorderlessInput
                    value={form.postalCode}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        postalCode: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Country code</label>
                  <BorderlessInput
                    value={form.countryCode}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countryCode: event.target.value.toUpperCase(),
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              {canEdit ? (
                <div className="mt-8 flex justify-end">
                  <Button
                    type="button"
                    disabled={saving}
                    className="rounded-full bg-walls-yellow px-6 text-black hover:bg-walls-yellow"
                    onClick={() => void handleSave()}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Save organization
                  </Button>
                </div>
              ) : (
                <p className="mt-8 text-sm font-light text-neutral-500">
                  You have member access to this organization. Contact an owner
                  or admin to update settings.
                </p>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
