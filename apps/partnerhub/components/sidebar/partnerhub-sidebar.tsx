'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState } from "react";

const navItems = [
  {
    id: 'overview',
    name: 'Overview',
    href: '/',
  },
  {
    id: 'deal-board',
    name: 'DealBoard',
    href: '/deal-board',
  },
  {
    id: 'companies',
    name: 'Companies',
    href: '/companies',
  },
];

function isNavItemActive(pathname: string, item: (typeof navItems)[number]) {
  if (item.id === 'overview') {
    return pathname === item.href || pathname === `${item.href}/`;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  className,
}: {
  item: (typeof navItems)[number];
  pathname: string;
  className?: string;
}) {
  const isActive = isNavItemActive(pathname, item);
  const [isHovered, setIsHovered] = useState(false);
  const showIndicator = isActive || isHovered;

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative block text-[13px] font-normal uppercase tracking-[0.14em] text-black transition-colors",
        !isActive && "hover:text-neutral-700",
        className
      )}
    >
      <motion.span
        className="absolute left-0 top-1/2 w-[2px] -translate-y-1/2 bg-[#6eadc0]"
        aria-hidden
        initial={false}
        animate={{
          height: showIndicator ? (isHovered && !isActive ? 24 : 16) : 0,
          opacity: showIndicator ? 1 : 0,
        }}
        transition={{
          height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.2, ease: "easeOut" },
        }}
      />
      {item.name}
    </Link>
  );
}

function MobileNavLink({
  item,
  pathname,
}: {
  item: (typeof navItems)[number];
  pathname: string;
}) {
  const isActive = isNavItemActive(pathname, item);
  const [isHovered, setIsHovered] = useState(false);
  const showIndicator = isActive || isHovered;

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative text-[12px] font-normal uppercase tracking-[0.14em] text-black transition-colors",
        !isActive && "hover:text-neutral-700"
      )}
    >
      <motion.span
        className="absolute -bottom-4 left-0 right-0 h-[2px] bg-[#6eadc0] origin-center"
        aria-hidden
        initial={false}
        animate={{
          scaleX: showIndicator ? 1 : 0,
          opacity: showIndicator ? 1 : 0,
        }}
        transition={{
          scaleX: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.2, ease: "easeOut" },
        }}
      />
      {item.name}
    </Link>
  );
}

export default function PartnerHubSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-neutral-200 bg-gray-50">
        <nav className="flex flex-col px-8 pt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              pathname={pathname}
              className="py-4 pl-4"
            />
          ))}
        </nav>
      </aside>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-6 border-b border-neutral-200 bg-gray-50 px-6 py-4">
        {navItems.map((item) => (
          <MobileNavLink key={item.id} item={item} pathname={pathname} />
        ))}
      </nav>
    </>
  );
}
