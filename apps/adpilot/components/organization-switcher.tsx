"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@walls/ui/dropdown-menu";
import { cn } from "@walls/utils";

import {
  useOrganizationContext,
  type OrganizationOption,
} from "./organization-provider";

const WALLS_LOGO_URL =
  "https://assets.wallsentertainment.com/logo-variations/black-logo.png";

function OrganizationAvatar({
  organization,
  className,
}: {
  organization: OrganizationOption;
  className?: string;
}) {
  const initials = organization.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  if (organization.iconUrl) {
    return (
      <Image
        src={organization.iconUrl}
        alt={`${organization.name} icon`}
        width={40}
        height={40}
        className={cn("h-10 w-10 rounded-xl object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-700",
        className,
      )}
    >
      {initials || <Building2 className="h-4 w-4" />}
    </div>
  );
}

export function OrganizationSwitcher() {
  const router = useRouter();
  const {
    organizations,
    activeOrganization,
    activeOrganizationId,
    loading,
    setActiveOrganizationId,
  } = useOrganizationContext();

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-100" />
        <div className="hidden h-4 w-28 animate-pulse rounded bg-neutral-100 sm:block" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <Image
        src={WALLS_LOGO_URL}
        alt="WALLS Entertainment logo"
        width={48}
        height={48}
        className="h-10 w-10 flex-none"
        priority
      />
    );
  }

  const currentLabel = activeOrganization?.name ?? "Personal workspace";

  async function handleSelect(organizationId: string | null) {
    await setActiveOrganizationId(organizationId);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex max-w-[min(100vw-8rem,18rem)] items-center gap-3 rounded-2xl border border-transparent px-1 py-1 text-left outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-walls-blue/30"
          aria-label="Switch organization"
        >
          {activeOrganization ? (
            <OrganizationAvatar organization={activeOrganization} />
          ) : (
            <Image
              src={WALLS_LOGO_URL}
              alt="WALLS Entertainment logo"
              width={40}
              height={40}
              className="h-10 w-10 flex-none rounded-xl object-contain"
            />
          )}
          <span className="hidden min-w-0 flex-1 sm:block">
            <span className="block truncate text-sm font-semibold text-neutral-900">
              {currentLabel}
            </span>
            <span className="block truncate text-xs font-light text-neutral-500">
              {activeOrganization ? "Organization workspace" : "Personal workspace"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem
          onSelect={() => void handleSelect(null)}
          className="flex items-center gap-3"
        >
          <Image
            src={WALLS_LOGO_URL}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">
              Personal workspace
            </p>
            <p className="truncate text-xs text-neutral-500">Your individual AdPilot data</p>
          </div>
          {activeOrganizationId === null ? (
            <Check className="h-4 w-4 text-walls-blue" />
          ) : null}
        </DropdownMenuItem>

        {organizations.length > 0 ? <DropdownMenuSeparator /> : null}

        {organizations.map((organization) => (
          <DropdownMenuItem
            key={organization.id}
            onSelect={() => void handleSelect(organization.id)}
            className="flex items-center gap-3"
          >
            <OrganizationAvatar organization={organization} className="h-8 w-8 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">
                {organization.name}
              </p>
              {organization.website ? (
                <p className="truncate text-xs text-neutral-500">{organization.website}</p>
              ) : (
                <p className="truncate text-xs capitalize text-neutral-500">
                  {organization.role}
                </p>
              )}
            </div>
            {activeOrganizationId === organization.id ? (
              <Check className="h-4 w-4 text-walls-blue" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
