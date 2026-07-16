"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@walls/utils";

import { useAppHeaderVisible } from "./app-header-context";
import UserProfileButton, {
  type UserProfileButtonProps,
} from "./user-profile-button";

const WALLS_LOGO_URL =
  "https://assets.wallsentertainment.com/logo-variations/black-logo.png";

export interface AppHeaderProps extends UserProfileButtonProps {
  logoHref?: string;
  hidden?: boolean;
  className?: string;
  leftContent?: React.ReactNode;
}

export default function AppHeader({
  logoHref,
  hidden = false,
  leftContent,
  className,
  dashboardPath = "/",
  ...profileProps
}: AppHeaderProps) {
  const homeHref = logoHref ?? dashboardPath;
  const headerVisible = useAppHeaderVisible();
  const isHidden = hidden || !headerVisible;

  const leading = leftContent ?? (
    <Link
      href={homeHref}
      className="flex items-center"
      aria-label="WALLS home"
    >
      <Image
        src={WALLS_LOGO_URL}
        alt="WALLS Entertainment logo"
        width={48}
        height={48}
        className="h-10 w-10 flex-none"
        priority
      />
    </Link>
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] flex h-16 items-center justify-between bg-kenoo-white px-4 transition-transform duration-300 sm:px-6",
        isHidden ? "-translate-y-full" : "translate-y-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{leading}</div>

      <UserProfileButton dashboardPath={dashboardPath} {...profileProps} />
    </header>
  );
}
