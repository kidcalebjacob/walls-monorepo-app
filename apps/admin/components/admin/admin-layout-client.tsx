"use client";

import { usePathname } from "next/navigation";

/** Full-bleed admin pages (no sidebar / header), e.g. team create-member wizard */
function isChromelessAdminPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/teams/") &&
    pathname.endsWith("/create-member")
  );
}

export function AdminLayoutClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const chromeless = isChromelessAdminPath(pathname);

  if (chromeless) {
    return <div className="min-h-screen bg-kenoo-white">{children}</div>;
  }

  return <>{children}</>;
}
