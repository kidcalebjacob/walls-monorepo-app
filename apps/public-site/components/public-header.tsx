"use client";

import { Menu, ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button } from "@walls/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@walls/ui/sheet-menu";
import { TextRoll } from "@walls/ui/text-roll";
import { WALLS_AGENCY_PORTAL_URL } from "@/lib/urls";
import { cn } from "@/lib/utils";

interface PublicHeaderProps {
  inView: boolean;
}

const navItems = [
  { href: "/representation", label: "Representation" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Connect" },
];

const getMobileNavLabel = (href: string, label: string) =>
  href === "/representation" ? "REP" : label;

export function PublicHeader({ inView }: PublicHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrollingUp, setIsScrollingUp] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollY.current) {
        setIsScrollingUp(true);
      } else if (currentScrollY > lastScrollY.current) {
        setIsScrollingUp(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAnchorScroll = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (href.startsWith("/#")) {
        e.preventDefault();
        const element = document.querySelector(href.substring(1));
        element?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [],
  );

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 w-full z-50 transition-all duration-700",
          inView || isScrollingUp ? "translate-y-0" : "-translate-y-[200px]",
        )}
      >
        <div
          className={cn(
            "w-full transition-all duration-500 rounded-none",
            inView ? "bg-transparent" : "bg-gray-50/50 backdrop-blur-xl",
          )}
        >
          <div className="h-24 px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="relative w-16 h-16 block shrink-0">
                <Image
                  src="https://assets.wallsentertainment.com/logo-variations/logo-white.png"
                  alt="WALLS Logo"
                  fill
                  className="object-contain invert"
                  sizes="72px"
                  priority
                />
              </Link>
              <Link
                href="/"
                className="flex flex-col leading-tight text-neutral-800/90"
              >
                <span className="text-xs font-light tracking-wide">WALLS</span>
                <span className="text-xs font-light tracking-wide">
                  ENTERTAINMENT
                </span>
                <span className="text-xs font-light tracking-wide">GROUP</span>
              </Link>
            </div>

            <div className="hidden md:flex flex-1 justify-center">
              <ul className="flex items-center gap-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <motion.button
                      layout
                      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                      className={cn(
                        "px-8 h-12 text-lg font-medium uppercase rounded-full transition-colors duration-300 flex items-center text-neutral-800/90",
                        pathname === item.href && "font-semibold",
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(item.href);
                      }}
                    >
                      {item.label}
                    </motion.button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden md:flex items-center justify-end relative min-w-[7.5rem]">
              <div className="filter-goo">
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="inline-flex items-center h-12 group/connect">
                    <div className="flex items-stretch h-12">
                      <Button
                        variant="secondary"
                        size="default"
                        asChild
                        className={cn(
                          "rounded-full bg-walls-yellow text-neutral-800/90 hover:bg-walls-yellow/90 shadow-none border-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-700 ease-walls-spring group-hover/connect:-translate-x-8 pl-7 pr-[2rem] text-sm font-medium uppercase h-12 min-h-12 py-0 leading-none flex items-center",
                        )}
                      >
                        <a href={WALLS_AGENCY_PORTAL_URL}>Portal</a>
                      </Button>
                      <a
                        href={WALLS_AGENCY_PORTAL_URL}
                        className="w-12 h-12 rounded-full bg-walls-yellow flex items-center justify-center cursor-pointer -ml-8 shrink-0 hover:bg-walls-yellow/90 shadow-none border-0 outline-none transition-all duration-700 ease-walls-spring no-underline"
                      >
                        <ArrowUpRight className="w-5 h-5 text-neutral-800/90 transform rotate-0 transition-transform duration-300 group-hover/connect:rotate-45" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-neutral-800/90 hover:bg-transparent hover:text-neutral-800/90"
                  >
                    <Menu className="h-7 w-7" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full h-full overflow-x-visible border-0 bg-gray-50 p-0 sm:max-w-none"
                >
                  <div className="absolute top-6 right-6 z-10">
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-black hover:bg-black/5 hover:text-black"
                      >
                        <X className="h-8 w-8" />
                      </Button>
                    </SheetTrigger>
                  </div>

                  <nav className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-x-visible px-6">
                    <Link href="/" className="flex w-full justify-center py-0.5">
                      <TextRoll
                        center
                        alignCenter
                        lineHeight={1}
                        className={cn(
                          "text-7xl font-black uppercase tracking-tight",
                          pathname === "/" ? "text-walls-yellow" : "text-black",
                        )}
                      >
                        Home
                      </TextRoll>
                    </Link>
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={(e) => handleAnchorScroll(e, item.href)}
                        className="flex w-full justify-center py-0.5"
                      >
                        <TextRoll
                          center
                          alignCenter
                          lineHeight={1}
                          className={cn(
                            "text-7xl font-black uppercase tracking-tight",
                            pathname === item.href
                              ? "text-walls-yellow"
                              : "text-black",
                          )}
                        >
                          {getMobileNavLabel(item.href, item.label)}
                        </TextRoll>
                      </Link>
                    ))}
                    <a
                      href={WALLS_AGENCY_PORTAL_URL}
                      className="flex w-full justify-center py-0.5"
                    >
                      <TextRoll
                        center
                        alignCenter
                        lineHeight={1}
                        className="text-7xl font-black uppercase tracking-tight text-black"
                      >
                        Portal
                      </TextRoll>
                    </a>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="goo">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="6"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <style jsx>{`
        .filter-goo {
          filter: url("#goo");
        }
      `}</style>
    </>
  );
}
