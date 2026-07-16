"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  Loader2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@walls/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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
import type { OrganizationRecord } from "@/lib/organizations-shared";
import { OrganizationMembers } from "@/components/settings/organization-members";

const fieldClass =
  "border-0 border-b border-neutral-200 rounded-none px-0 py-2 font-light focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 focus:border-b-[var(--kenoo-sky)] bg-transparent w-full placeholder:text-neutral-300";
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

function OrganizationSwitcherAvatar({
  organization,
}: {
  organization: OrganizationRecord;
}) {
  if (organization.iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote org icons
      <img
        src={organization.iconUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
      <Building2 className="h-5 w-5" />
    </span>
  );
}

function OrganizationSwitcher({
  organizations,
  selectedId,
  onSelect,
  onSetDefault,
  settingDefaultId,
}: {
  organizations: OrganizationRecord[];
  selectedId: string | null;
  onSelect: (organizationId: string) => void;
  onSetDefault: (organizationId: string) => void;
  settingDefaultId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const activeOrganization =
    organizations.find((organization) => organization.id === selectedId) ??
    organizations[0];

  if (!activeOrganization) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 max-w-[min(100vw-8rem,280px)] items-center gap-3 rounded-xl bg-kenoo-white px-3 py-2.5 text-left transition",
            "hover:bg-neutral-50",
            "focus:outline-none",
            open && "bg-neutral-50",
          )}
        >
          <OrganizationSwitcherAvatar organization={activeOrganization} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {activeOrganization.name}
            </span>
            <span className="mt-0.5 block text-xs capitalize text-neutral-500">
              {activeOrganization.role}
              {activeOrganization.isDefault ? " · Default" : ""}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-neutral-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="z-[110] w-[min(100vw-2rem,320px)] rounded-2xl border-0 bg-kenoo-white p-2 shadow-xl"
      >
        <p className="px-2 pb-1 pt-1 text-sm font-medium text-neutral-500">
          Choose an organization
        </p>

        <div className="mt-1 space-y-0.5">
          {organizations.map((organization) => {
            const isActive = organization.id === activeOrganization.id;
            const isSettingThis = settingDefaultId === organization.id;
            return (
              <DropdownMenuItem
                key={organization.id}
                onSelect={() => {
                  onSelect(organization.id);
                  setOpen(false);
                }}
                className={cn(
                  "cursor-pointer rounded-xl p-2 transition-colors focus:bg-transparent",
                  isActive ? "bg-neutral-100" : "hover:bg-neutral-50",
                )}
              >
                <div className="flex w-full items-center gap-3">
                  <OrganizationSwitcherAvatar organization={organization} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm text-foreground",
                        isActive ? "font-semibold" : "font-medium",
                      )}
                    >
                      {organization.name}
                    </p>
                    <span className="mt-0.5 block text-xs capitalize text-neutral-500">
                      {organization.role}
                      {organization.isDefault ? " · Default" : ""}
                    </span>
                  </div>
                  {organization.isDefault ? (
                    <Star
                      className="h-4 w-4 shrink-0 fill-[var(--kenoo-sky)] text-[var(--kenoo-sky)]"
                      strokeWidth={2}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={isSettingThis}
                      title="Set as default"
                      aria-label={`Set ${organization.name} as default`}
                      className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-foreground disabled:opacity-50"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSetDefault(organization.id);
                      }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      {isSettingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" strokeWidth={2} />
                      )}
                    </button>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const saveRequestIdRef = useRef(0);
  const formRef = useRef({
    name: "",
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

  const { mutate: uploadOrganizationIcon, isUploading: isUploadingIcon } =
    useUploadOrganizationIcon(selectedId);

  const [form, setForm] = useState({
    name: "",
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
  formRef.current = form;

  const [createForm, setCreateForm] = useState({
    name: "",
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
  }, [selectedOrganization?.id]);

  useEffect(() => {
    if (!selectedOrganization) {
      setForm({
        name: "",
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
    // Only rehydrate when switching organizations — autosave updates must not clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: selectedOrganization?.id
  }, [selectedOrganization?.id]);

  const isFormChanged = selectedOrganization
    ? form.name !== selectedOrganization.name ||
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

  useEffect(() => {
    if (!selectedId || !canEdit || !isFormChanged) return;

    const timeoutId = window.setTimeout(async () => {
      const snapshot = formRef.current;
      if (!snapshot.name.trim()) {
        wallsToast.error("Missing name", "Organization name is required");
        return;
      }

      const requestId = ++saveRequestIdRef.current;
      setSaving(true);

      try {
        const response = await fetch(`/api/organizations/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: snapshot.name.trim(),
            iconUrl: snapshot.iconUrl.trim() || null,
            website: snapshot.website.trim() || null,
            description: snapshot.description.trim() || null,
            email: snapshot.email.trim() || null,
            phone: snapshot.phone.trim() || null,
            addressLine1: snapshot.addressLine1.trim() || null,
            addressLine2: snapshot.addressLine2.trim() || null,
            city: snapshot.city.trim() || null,
            stateProvince: snapshot.stateProvince.trim() || null,
            postalCode: snapshot.postalCode.trim() || null,
            countryCode: snapshot.countryCode.trim() || null,
          }),
        });

        if (requestId !== saveRequestIdRef.current) return;

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          wallsToast.error(
            "Error",
            payload.error || "Failed to save organization settings",
          );
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
      } finally {
        if (requestId === saveRequestIdRef.current) {
          setSaving(false);
        }
      }
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [selectedId, canEdit, isFormChanged, form]);

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

  async function handleSetDefault(organizationId?: string) {
    const targetId = organizationId ?? selectedId;
    if (!targetId) return;

    const target = organizations.find((organization) => organization.id === targetId);
    if (!target || target.isDefault) return;

    setSettingDefaultId(targetId);
    try {
      const response = await fetch(
        `/api/organizations/${targetId}/set-default`,
        { method: "POST" },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        wallsToast.error(
          "Error",
          payload.error || "Failed to set default organization",
        );
        return;
      }

      setOrganizations((current) =>
        current.map((organization) => ({
          ...organization,
          isDefault: organization.id === targetId,
        })),
      );
      wallsToast.success(
        "Default updated",
        `${target.name} is now your default`,
      );
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleCreate() {
    if (!createForm.name.trim()) {
      wallsToast.error("Missing fields", "Organization name is required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
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
        setCreateForm({ name: "", website: "" });
        wallsToast.success("Created", "Organization created successfully");
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-y-auto overscroll-none bg-kenoo-white">
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
    <div className="flex h-full flex-col overflow-y-auto overscroll-none bg-kenoo-white">
      <div className="mx-auto w-full max-w-5xl px-8 pb-8">
        <Toaster />

        <div className="mb-8 pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Organization</h1>
              <p className="text-sm font-light text-neutral-500">
                Manage organization profile, branding, contact details, and team
                members shared across AdPilot and other WALLS apps.
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
          <div className="mb-8">
            <OrganizationSwitcher
              organizations={organizations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSetDefault={(organizationId) => {
                void handleSetDefault(organizationId);
              }}
              settingDefaultId={settingDefaultId}
            />
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
                    }))
                  }
                  className={fieldClass}
                  placeholder="Organization name"
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
                  placeholder="https://example.com"
                />
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
                disabled={creating}
                className="rounded-none border border-neutral-200/50 bg-kenoo-yellow px-8 py-6 font-normal text-black hover:bg-kenoo-yellow"
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
                </p>
                {!selectedOrganization.isDefault ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={settingDefaultId === selectedOrganization.id}
                    onClick={() => void handleSetDefault()}
                    className="mt-3 h-auto w-[120px] rounded-none border border-neutral-200/50 bg-background px-2 py-2 text-[10px] font-normal uppercase tracking-wide text-foreground hover:bg-background hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {settingDefaultId === selectedOrganization.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Set default
                      </span>
                    )}
                  </Button>
                ) : (
                  <p className="mt-3 inline-flex w-[120px] items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--kenoo-sky)]">
                    <Star className="h-3 w-3 fill-current" />
                    Default
                  </p>
                )}
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
                      }))
                    }
                    className={inputClass(canEdit)}
                    placeholder="Organization name"
                  />
                </div>
                <div>
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

            <SectionDivider title="Members" />
            <OrganizationMembers
              organizationId={selectedOrganization.id}
              actorRole={selectedOrganization.role}
              canEdit={canEdit}
            />

            {!canEdit ? (
              <p className="pb-8 pt-4 text-sm font-light text-neutral-500">
                You have member access to this organization. Contact an owner or
                admin to update settings.
              </p>
            ) : saving ? (
              <p className="flex items-center gap-2 pb-4 pt-2 text-xs font-light text-neutral-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </p>
            ) : (
              <div className="pb-4" />
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
