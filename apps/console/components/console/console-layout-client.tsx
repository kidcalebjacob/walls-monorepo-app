"use client";

import { usePathname } from "next/navigation";

/** Full-bleed console pages (no sidebar / header), e.g. team create-member wizard */
function isChromelessConsolePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes("/teams/") &&
    pathname.endsWith("/create-member")
  );
}

export function ConsoleLayoutClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const chromeless = isChromelessConsolePath(pathname);

  if (chromeless) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return <>{children}</>;
}
