"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Loader2,
  Plus,
  Settings,
  Trash2,
  Users,
} from "lucide-react";

import { wallsToast } from "@/components/ui/walls-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/borderless-input";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { SquareImageCrop } from "@/components/ui/square-image-crop";
import { Toaster } from "@/components/ui/toaster";
import { useUploadOrganizationIcon } from "@/hooks/useMutations";
import type { OrganizationRecord } from "@/lib/organizations-shared";
import { canEditOrganization } from "@/lib/organizations-shared";
import { useActiveAccount } from "@/components/active-account-context";
import { cn } from "@/lib/utils";

const labelClass =
  "mb-1 block text-xs font-medium tracking-wide text-[#5f6368]";
const fieldClass =
  "w-full rounded-lg border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#202124] placeholder:text-[#9aa0a6] focus:border-[#1967d2] focus:outline-none focus:ring-2 focus:ring-[#1967d2]/15";
const readonlyFieldClass =
  "w-full cursor-not-allowed rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2.5 text-sm text-[#5f6368]";

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
        width={88}
        height={88}
        className="h-[88px] w-[88px] rounded-2xl object-cover"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl bg-[#f1f3f4] text-xl font-medium text-[#5f6368]">
      {initials || <Building2 className="h-7 w-7" />}
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

  const avatar = <OrganizationAvatar name={name} iconUrl={iconUrl} />;

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
        className={`group relative block cursor-pointer ${isUploading ? "pointer-events-none opacity-70" : ""}`}
      >
        {avatar}
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Plus className="h-5 w-5 text-white" />
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

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-[#202124]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-[#5f6368]">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function OrganizationSettingsPage() {
  const { activeAccount, activeAccountId, loading: accountLoading } =
    useActiveAccount();
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
    () =>
      organizations.find((organization) => organization.id === selectedId) ??
      null,
    [organizations, selectedId],
  );

  const canEdit = selectedOrganization
    ? canEditOrganization(selectedOrganization.role)
    : false;

  const displayIconUrl =
    iconPreviewUrl ||
    form.iconUrl.trim() ||
    selectedOrganization?.iconUrl ||
    null;

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
    if (!activeAccountId || accountLoading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/organizations", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        organizations?: OrganizationRecord[];
        activeAccountId?: string | null;
        accountType?: "personal" | "organization";
      };

      const next = payload.organizations ?? [];
      setOrganizations(next);
      setSelectedId(
        payload.activeAccountId ?? activeAccountId ?? next[0]?.id ?? null,
      );
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, accountLoading]);

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
    if (!selectedId || !canEdit) return;

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
        wallsToast.error(
          "Error",
          payload.error || "Failed to create organization",
        );
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

  const inputClass = (editable: boolean) =>
    editable ? fieldClass : readonlyFieldClass;

  if (accountLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-4 py-2">
        <div className="h-8 w-48 rounded-lg bg-neutral-200/80" />
        <div className="h-4 w-72 rounded bg-neutral-100" />
        <div className="mt-6 h-56 rounded-2xl bg-white" />
        <div className="h-56 rounded-2xl bg-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <Toaster />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#5f6368]">
            <Settings className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Account
            </span>
          </div>
          <h1 className="text-2xl font-normal text-[#202124]">
            {activeAccount?.accountType === "organization"
              ? "Organization profile"
              : "Account settings"}
          </h1>
          <p className="text-sm text-[#5f6368]">
            Update the profile and contact details for{" "}
            {activeAccount?.name ?? "this account"}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saving ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#5f6368]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          ) : null}
          {activeAccount?.accountType === "organization" ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-[#dadce0] text-[#1967d2] hover:bg-[#e8f0fe]"
              onClick={() => setShowCreateForm((value) => !value)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {showCreateForm ? "Cancel" : "New organization"}
            </Button>
          ) : null}
        </div>
      </header>

      {activeAccount?.accountType === "personal" ? (
        <div className="rounded-2xl border border-[#e8eaed] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
          <Building2 className="mx-auto h-10 w-10 text-[#dadce0]" />
          <p className="mt-4 text-sm font-medium text-[#202124]">
            Personal account selected
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5f6368]">
            Switch to an organization in the header to edit its profile, or open
            account details for this personal account.
          </p>
          {activeAccountId ? (
            <Button
              asChild
              variant="outline"
              className="mt-5 rounded-full border-[#dadce0] text-[#1967d2] hover:bg-[#e8f0fe]"
            >
              <Link href={`/accounts/${activeAccountId}`}>
                Open account details
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {showCreateForm ? (
        <SectionCard
          title="Create organization"
          description="Start a new organization account"
          action={
            <Button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-full bg-[#1967d2] px-5 text-white hover:bg-[#1557b0] disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Organization name</label>
              <Input
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
            <div className="sm:col-span-2">
              <label className={labelClass}>Website</label>
              <Input
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
          <p className="mt-3 text-xs text-[#5f6368]">
            You can upload an icon after the organization is created.
          </p>
        </SectionCard>
      ) : null}

      {activeAccount?.accountType === "organization" &&
      organizations.length === 0 &&
      !showCreateForm ? (
        <div className="rounded-2xl border border-[#e8eaed] bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
          <Building2 className="mx-auto h-10 w-10 text-[#dadce0]" />
          <p className="mt-4 text-sm font-medium text-[#202124]">
            No organization profile found
          </p>
          <p className="mt-1 text-sm text-[#5f6368]">
            Create an organization to manage its profile here.
          </p>
        </div>
      ) : null}

      {activeAccount?.accountType === "organization" &&
      selectedOrganization &&
      !showCreateForm ? (
        <>
          <SectionCard
            title="Profile"
            description="Name, icon, and public details"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <OrganizationIconUpload
                  name={form.name || selectedOrganization.name}
                  iconUrl={displayIconUrl}
                  canEdit={canEdit}
                  isUploading={isUploadingIcon}
                  onSelectFile={(file) => void handleIconUpload(file)}
                />
                {canEdit ? (
                  <p className="text-center text-xs text-[#5f6368]">
                    Click to change icon
                  </p>
                ) : null}
              </div>

              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Organization name</label>
                  <Input
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
                <div className="sm:col-span-2">
                  <label className={labelClass}>Website</label>
                  <Input
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
                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <Input
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
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Contact"
            description="How people reach this organization"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Email</label>
                <Input
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
              <div>
                <label className={labelClass}>Phone</label>
                <Input
                  value={form.phone}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className={inputClass(canEdit)}
                  placeholder="+1 310 387 8027"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Location"
            description="Mailing and invoice address"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Address line 1</label>
                <Input
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
              <div className="sm:col-span-2">
                <label className={labelClass}>Address line 2</label>
                <Input
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
              <div>
                <label className={labelClass}>City</label>
                <Input
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
              <div>
                <label className={labelClass}>State / Province</label>
                <Input
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
              <div>
                <label className={labelClass}>Postal code</label>
                <Input
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
              <div>
                <label className={labelClass}>Country code</label>
                <Input
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
          </SectionCard>

          <section className="rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0fe]">
                  <Users className="h-5 w-5 text-[#1967d2]" />
                </div>
                <div>
                  <h2 className="text-base font-medium text-[#202124]">
                    Users &amp; app access
                  </h2>
                  <p className="mt-0.5 text-sm text-[#5f6368]">
                    Invite members and manage app permissions on the Users page.
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[#dadce0] text-[#1967d2] hover:bg-[#e8f0fe]"
              >
                <Link href="/users">Manage users</Link>
              </Button>
            </div>
          </section>

          {canEdit ? (
            <section
              className={cn(
                "rounded-2xl border bg-white p-6 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-8",
                "border-[#fce8e6]",
              )}
            >
              <h2 className="text-base font-medium text-[#202124]">
                Delete organization
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[#5f6368]">
                Permanently delete this organization and remove all members.
                This cannot be undone.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting || saving}
                onClick={() => setShowDeleteDialog(true)}
                className="mt-5 rounded-full border-[#f6aea9] text-[#d93025] hover:bg-[#fce8e6]"
              >
                {isDeleting ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete organization
                  </span>
                )}
              </Button>

              <Dialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
              >
                <DialogContent showCloseButton={!isDeleting}>
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-medium text-[#202124]">
                        Delete organization?
                      </h2>
                      <p className="mt-2 text-sm text-[#5f6368]">
                        Are you sure you want to delete{" "}
                        <span className="font-medium text-[#202124]">
                          {selectedOrganization.name}
                        </span>
                        ? This cannot be undone.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isDeleting}
                        onClick={() => setShowDeleteDialog(false)}
                        className="rounded-full border-[#dadce0]"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => void handleDelete()}
                        className="rounded-full bg-[#d93025] text-white hover:bg-[#b3261e]"
                      >
                        {isDeleting ? (
                          <span className="flex items-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting…
                          </span>
                        ) : (
                          "Delete organization"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
