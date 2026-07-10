"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { wallsToast } from "@/components/ui/walls-toast";
import { Button } from "@/components/ui/button";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SquareImageCrop } from "@/components/ui/square-image-crop";
import { Toaster } from "@/components/ui/toaster";
import { useUploadOrganizationIcon } from "@/hooks/useMutations";
import {
  slugifyOrganizationName,
  type OrganizationRecord,
} from "@/lib/organizations-shared";

const fieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--walls-sky)] bg-transparent w-full placeholder:text-neutral-300";
const labelClass =
  "text-xs font-normal text-neutral-400 tracking-wide block mb-1";
const readonlyFieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light bg-transparent w-full text-neutral-400 placeholder:text-neutral-300 cursor-not-allowed";

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-8 mt-8 flex items-center first:mt-0">
      <span className="mr-4 text-4xl font-black text-black">{title}</span>
      <div className="h-px flex-1 border-t border-black" />
    </div>
  );
}

type SlugCheckStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function SlugFieldHint({ status }: { status: SlugCheckStatus }) {
  if (status === "idle" || status === "checking") {
    return null;
  }

  if (status === "available") {
    return (
      <p className="mt-1 text-xs font-light text-emerald-600">
        This slug is available
      </p>
    );
  }

  if (status === "taken") {
    return (
      <p className="mt-1 text-xs font-light text-red-600">
        This slug is already taken
      </p>
    );
  }

  return (
    <p className="mt-1 text-xs font-light text-red-600">
      Slug must be at least 2 characters (letters and numbers only)
    </p>
  );
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
        width={120}
        height={120}
        className="h-[120px] w-[120px] rounded-2xl object-cover"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex h-[120px] w-[120px] items-center justify-center rounded-2xl bg-neutral-100 text-2xl font-semibold text-neutral-700">
      {initials || <Building2 className="h-8 w-8" />}
    </div>
  );
}

function OrganizationIconUpload({
  name,
  iconUrl,
  canEdit,
  isUploading,
  onSelectFile,
}: {
  name: string;
  iconUrl: string | null;
  canEdit: boolean;
  isUploading: boolean;
  onSelectFile: (file: File) => void;
}) {
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setTempImage(reader.result as string);
        setShowCropDialog(true);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const avatar = (
    <OrganizationAvatar name={name} iconUrl={iconUrl} />
  );

  if (!canEdit) {
    return avatar;
  }

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="organization-icon-upload"
        disabled={isUploading}
      />
      <label
        htmlFor="organization-icon-upload"
        className={`relative block cursor-pointer group ${isUploading ? "pointer-events-none opacity-70" : ""}`}
      >
        {avatar}
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </div>
      </label>

      {tempImage ? (
        <SquareImageCrop
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageUrl={tempImage}
          onCropComplete={(file) => {
            onSelectFile(file);
            setTempImage(null);
          }}
        />
      ) : null}
    </>
  );
}

export default function OrganizationSettingsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [isHoveringSave, setIsHoveringSave] = useState(false);
  const [isHoveringCancel, setIsHoveringCancel] = useState(false);
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [editSlugTouched, setEditSlugTouched] = useState(false);
  const [createSlugStatus, setCreateSlugStatus] =
    useState<SlugCheckStatus>("idle");
  const [editSlugStatus, setEditSlugStatus] = useState<SlugCheckStatus>("idle");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { mutate: uploadOrganizationIcon, isUploading: isUploadingIcon } =
    useUploadOrganizationIcon(selectedId);

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
  });

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedId) ?? null,
    [organizations, selectedId],
  );

  const canEdit = selectedOrganization
    ? selectedOrganization.role === "owner" ||
      selectedOrganization.role === "admin"
    : false;

  const canDelete = selectedOrganization?.role === "owner";

  const displayIconUrl =
    iconPreviewUrl || form.iconUrl.trim() || selectedOrganization?.iconUrl || null;

  const handleIconUpload = useCallback(
    async (file: File) => {
      setIconPreviewUrl(URL.createObjectURL(file));

      const result = await uploadOrganizationIcon(file);
      if (!result?.url || !selectedId) {
        return;
      }

      setForm((current) => ({ ...current, iconUrl: result.url }));
      setIconPreviewUrl(result.url);
      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === selectedId
            ? { ...organization, iconUrl: result.url }
            : organization,
        ),
      );
    },
    [selectedId, uploadOrganizationIcon],
  );

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
    setIconPreviewUrl(null);
    setEditSlugTouched(false);
    setEditSlugStatus("idle");
  }, [selectedOrganization?.id]);

  useEffect(() => {
    if (!showCreateForm) {
      setCreateSlugTouched(false);
      setCreateSlugStatus("idle");
    }
  }, [showCreateForm]);

  useEffect(() => {
    const slug = createForm.slug.trim();
    if (!slug) {
      setCreateSlugStatus("idle");
      return;
    }

    const timer = window.setTimeout(async () => {
      setCreateSlugStatus("checking");
      try {
        const response = await fetch(
          `/api/organizations/check-slug?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          setCreateSlugStatus("invalid");
          return;
        }
        const payload = (await response.json()) as {
          available?: boolean;
          reason?: string | null;
        };
        if (payload.reason === "invalid") {
          setCreateSlugStatus("invalid");
        } else {
          setCreateSlugStatus(payload.available ? "available" : "taken");
        }
      } catch {
        setCreateSlugStatus("idle");
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [createForm.slug]);

  useEffect(() => {
    const slug = form.slug.trim();
    if (!slug || !selectedId) {
      setEditSlugStatus("idle");
      return;
    }

    const timer = window.setTimeout(async () => {
      setEditSlugStatus("checking");
      try {
        const response = await fetch(
          `/api/organizations/check-slug?slug=${encodeURIComponent(slug)}&excludeOrganizationId=${encodeURIComponent(selectedId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          setEditSlugStatus("invalid");
          return;
        }
        const payload = (await response.json()) as {
          available?: boolean;
          reason?: string | null;
        };
        if (payload.reason === "invalid") {
          setEditSlugStatus("invalid");
        } else {
          setEditSlugStatus(payload.available ? "available" : "taken");
        }
      } catch {
        setEditSlugStatus("idle");
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [form.slug, selectedId]);

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

    if (isEditSlugBlocking) {
      wallsToast.error("Invalid slug", "Choose a different organization slug");
      return;
    }

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
        const payload = (await response.json()) as { error?: string };
        wallsToast.error("Error", payload.error || "Failed to save organization settings");
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

  function handleRevert() {
    if (!selectedOrganization) return;

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
    setIconPreviewUrl(null);
    setEditSlugTouched(false);
    setEditSlugStatus("idle");
    wallsToast.success("Changes reverted", "All changes have been discarded");
  }

  async function handleDelete() {
    if (!selectedId || !canDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/organizations/${selectedId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error(
          "Error",
          payload.error || "Failed to delete organization",
        );
        return;
      }

      const deletedId = selectedId;
      const remaining = organizations.filter(
        (organization) => organization.id !== deletedId,
      );

      setOrganizations(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setShowDeleteDialog(false);
      wallsToast.success(
        "Organization deleted",
        "The organization has been permanently removed",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const isFormChanged = selectedOrganization
    ? form.name !== selectedOrganization.name ||
      form.slug !== selectedOrganization.slug ||
      form.website !== (selectedOrganization.website ?? "") ||
      form.description !== (selectedOrganization.description ?? "") ||
      form.email !== (selectedOrganization.email ?? "") ||
      form.phone !== (selectedOrganization.phone ?? "") ||
      form.addressLine1 !== (selectedOrganization.addressLine1 ?? "") ||
      form.addressLine2 !== (selectedOrganization.addressLine2 ?? "") ||
      form.city !== (selectedOrganization.city ?? "") ||
      form.stateProvince !== (selectedOrganization.stateProvince ?? "") ||
      form.postalCode !== (selectedOrganization.postalCode ?? "") ||
      form.countryCode !== (selectedOrganization.countryCode ?? "")
    : false;

  const isEditSlugBlocking =
    editSlugStatus === "taken" || editSlugStatus === "invalid";
  const isCreateSlugBlocking =
    createSlugStatus === "taken" || createSlugStatus === "invalid";

  async function handleCreate() {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      wallsToast.error("Missing fields", "Organization name and slug are required");
      return;
    }

    if (isCreateSlugBlocking) {
      wallsToast.error("Invalid slug", "Choose a different organization slug");
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
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error("Error", payload.error || "Failed to create organization");
        return;
      }

      const payload = (await response.json()) as {
        organization?: OrganizationRecord;
      };

      if (payload.organization) {
        setOrganizations((current) => [...current, payload.organization!]);
        setSelectedId(payload.organization.id);
        setShowCreateForm(false);
        setCreateForm({ name: "", slug: "", website: "" });
        wallsToast.success("Created", "Organization created successfully");
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-y-auto overscroll-none bg-gray-50">
        <div className="mx-auto w-full max-w-5xl px-8 pb-8">
          <Skeleton className="mb-8 mt-8 h-10 w-64" />
          <Skeleton className="mb-4 h-[120px] w-[120px] rounded-2xl" />
          <Skeleton className="mb-4 h-12 w-full" />
          <Skeleton className="mb-4 h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  const inputClass = (editable: boolean) =>
    editable ? fieldClass : readonlyFieldClass;

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-none bg-gray-50">
      <div className="mx-auto w-full max-w-5xl px-8 pb-8">
        <Toaster />

        <div className="mb-8 pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Organization</h1>
              <p className="text-sm font-light text-neutral-500">
                Manage organization profile, branding, and contact details shared
                across AdPilot and other WALLS apps.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="rounded-none border border-neutral-200/50 bg-background px-6 py-6 font-normal hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
              onClick={() => setShowCreateForm((value) => !value)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New organization
            </Button>
          </div>
        </div>

        {organizations.length > 1 ? (
          <div className="mb-8 flex flex-wrap gap-2">
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

        {showCreateForm ? (
          <div className="space-y-8">
            <SectionDivider title="Create organization" />
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Organization name</label>
                <BorderlessInput
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: createSlugTouched
                        ? current.slug
                        : slugifyOrganizationName(event.target.value),
                    }))
                  }
                  className={fieldClass}
                  placeholder="Organization name"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Slug</label>
                  <BorderlessInput
                    value={createForm.slug}
                    onChange={(event) => {
                      setCreateSlugTouched(true);
                      setCreateForm((current) => ({
                        ...current,
                        slug: slugifyOrganizationName(event.target.value),
                      }));
                    }}
                    className={fieldClass}
                    placeholder="organization-slug"
                  />
                  <SlugFieldHint status={createSlugStatus} />
                </div>
                <div className="flex-1">
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
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <p className="text-xs font-light text-neutral-400">
                You can upload an organization icon after it is created.
              </p>
            </div>
            <div className="flex justify-start gap-3 pb-8">
              <Button
                type="button"
                variant="ghost"
                className="rounded-none border border-neutral-200/50 bg-background px-8 py-6 font-normal"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={creating || isCreateSlugBlocking}
                className="rounded-none border border-neutral-200/50 bg-walls-yellow px-8 py-6 font-normal text-black hover:bg-walls-yellow"
                onClick={() => void handleCreate()}
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create organization
              </Button>
            </div>
          </div>
        ) : null}

        {organizations.length === 0 && !showCreateForm ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
            <p className="text-sm font-light text-neutral-500">
              You are not part of an organization yet. Create one to share AdPilot
              data with your team.
            </p>
          </div>
        ) : null}

        {selectedOrganization && !showCreateForm ? (
          <div className="space-y-8">
            <SectionDivider title="Organization profile" />

            <div className="flex gap-8">
              <div className="flex-shrink-0">
                <OrganizationIconUpload
                  name={form.name || selectedOrganization.name}
                  iconUrl={displayIconUrl}
                  canEdit={canEdit}
                  isUploading={isUploadingIcon}
                  onSelectFile={(file) => void handleIconUpload(file)}
                />
                <p className="mt-3 max-w-[120px] text-center text-[10px] font-light uppercase tracking-wide text-neutral-400">
                  {selectedOrganization.role}
                  {selectedOrganization.isDefault ? " · Default" : ""}
                </p>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className={labelClass}>Organization name</label>
                  <BorderlessInput
                    value={form.name}
                    readOnly={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                        slug: editSlugTouched
                          ? current.slug
                          : slugifyOrganizationName(event.target.value),
                      }))
                    }
                    className={inputClass(canEdit)}
                    placeholder="Organization name"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={labelClass}>Slug</label>
                    <BorderlessInput
                      value={form.slug}
                      readOnly={!canEdit}
                      onChange={(event) => {
                        setEditSlugTouched(true);
                        setForm((current) => ({
                          ...current,
                          slug: slugifyOrganizationName(event.target.value),
                        }));
                      }}
                      className={inputClass(canEdit)}
                      placeholder="organization-slug"
                    />
                    {canEdit ? <SlugFieldHint status={editSlugStatus} /> : null}
                  </div>
                  <div className="flex-1">
                    <label className={labelClass}>Website</label>
                    <BorderlessInput
                      value={form.website}
                      readOnly={!canEdit}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          website: event.target.value,
                        }))
                      }
                      className={inputClass(canEdit)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <SectionDivider title="About" />
            <div>
              <label className={labelClass}>Description</label>
              <BorderlessInput
                value={form.description}
                readOnly={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className={inputClass(canEdit)}
                placeholder="What does your organization do?"
              />
            </div>

            <SectionDivider title="Contact information" />
            <div className="flex gap-4">
              <div className="flex-1">
                <label className={labelClass}>Email</label>
                <BorderlessInput
                  value={form.email}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className={inputClass(canEdit)}
                  placeholder="contact@organization.com"
                />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Phone</label>
                <BorderlessInput
                  value={form.phone}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className={inputClass(canEdit)}
                  placeholder="+13103878027"
                />
              </div>
            </div>

            <SectionDivider title="Location" />
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Address line 1</label>
                <BorderlessInput
                  value={form.addressLine1}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      addressLine1: event.target.value,
                    }))
                  }
                  className={inputClass(canEdit)}
                  placeholder="Street address"
                />
              </div>
              <div>
                <label className={labelClass}>Address line 2</label>
                <BorderlessInput
                  value={form.addressLine2}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      addressLine2: event.target.value,
                    }))
                  }
                  className={inputClass(canEdit)}
                  placeholder="Suite, unit, etc."
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>City</label>
                  <BorderlessInput
                    value={form.city}
                    readOnly={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    className={inputClass(canEdit)}
                    placeholder="City"
                  />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>State / Province</label>
                  <BorderlessInput
                    value={form.stateProvince}
                    readOnly={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        stateProvince: event.target.value,
                      }))
                    }
                    className={inputClass(canEdit)}
                    placeholder="State or province"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Postal code</label>
                  <BorderlessInput
                    value={form.postalCode}
                    readOnly={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        postalCode: event.target.value,
                      }))
                    }
                    className={inputClass(canEdit)}
                    placeholder="Postal code"
                  />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Country code</label>
                  <BorderlessInput
                    value={form.countryCode}
                    readOnly={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countryCode: event.target.value.toUpperCase(),
                      }))
                    }
                    className={inputClass(canEdit)}
                    placeholder="US"
                  />
                </div>
              </div>
            </div>

            {canEdit ? (
              <div className="flex justify-start gap-3 pb-8 pt-4">
                <Button
                  type="button"
                  disabled={!isFormChanged || saving || isEditSlugBlocking}
                  variant="ghost"
                  onMouseEnter={() => setIsHoveringSave(true)}
                  onMouseLeave={() => setIsHoveringSave(false)}
                  className="relative overflow-hidden rounded-none border border-neutral-200/50 bg-background px-8 py-6 font-normal text-foreground transition-all hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void handleSave()}
                >
                  <AnimatePresence>
                    {isHoveringSave && isFormChanged && !saving ? (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.8 }}
                        className="absolute left-4 flex items-center pointer-events-none"
                      >
                        <Check className="h-4 w-4 text-walls-yellow" />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <motion.span
                    className="inline-block"
                    animate={{ x: isHoveringSave && isFormChanged ? 8 : 0 }}
                  >
                    {saving ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save changes"
                    )}
                  </motion.span>
                </Button>

                <Button
                  type="button"
                  disabled={!isFormChanged || saving}
                  variant="ghost"
                  onMouseEnter={() => setIsHoveringCancel(true)}
                  onMouseLeave={() => setIsHoveringCancel(false)}
                  className="relative overflow-hidden rounded-none border border-neutral-200/50 bg-background px-8 py-6 font-normal text-foreground transition-all hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleRevert}
                >
                  <AnimatePresence>
                    {isHoveringCancel && isFormChanged ? (
                      <motion.div
                        initial={{ opacity: 0, x: -10, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.8 }}
                        className="absolute left-4 flex items-center pointer-events-none"
                      >
                        <RotateCcw className="h-4 w-4 text-neutral-500" />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <motion.span
                    className="inline-block"
                    animate={{ x: isHoveringCancel && isFormChanged ? 8 : 0 }}
                  >
                    Cancel
                  </motion.span>
                </Button>
              </div>
            ) : (
              <p className="pb-8 pt-4 text-sm font-light text-neutral-500">
                You have member access to this organization. Contact an owner or
                admin to update settings.
              </p>
            )}

            {canDelete && selectedOrganization ? (
              <>
                <SectionDivider title="Danger zone" />
                <div className="pb-8">
                  <p className="mb-4 max-w-2xl text-sm font-light text-neutral-500">
                    Permanently delete this organization and remove all members.
                    This action cannot be undone.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isDeleting || saving}
                    onClick={() => setShowDeleteDialog(true)}
                    className="rounded-none border border-red-200 bg-background px-8 py-6 font-normal text-red-600 transition-all hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete organization
                      </span>
                    )}
                  </Button>
                </div>

                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogContent showCloseButton={!isDeleting}>
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">
                          Delete organization?
                        </h2>
                        <p className="mt-2 text-sm font-light text-neutral-500">
                          Are you sure you want to delete{" "}
                          <span className="font-normal text-foreground">
                            {selectedOrganization.name}
                          </span>
                          ? This cannot be undone.
                        </p>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isDeleting}
                          onClick={() => setShowDeleteDialog(false)}
                          className="rounded-none border border-neutral-200/50 px-6 py-2 font-normal"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isDeleting}
                          onClick={() => void handleDelete()}
                          className="rounded-none border border-red-200 bg-red-50 px-6 py-2 font-normal text-red-600 hover:bg-red-100 hover:text-red-700"
                        >
                          {isDeleting ? (
                            <span className="flex items-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </span>
                          ) : (
                            "Delete organization"
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
