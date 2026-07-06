"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

interface FooterProps {
  inView?: boolean;
}

export default function Footer({ inView = true }: FooterProps) {
    const currentYear = new Date().getFullYear();
  
    return (
      <footer className={cn(
        "fixed w-screen bottom-0 left-0 flex flex-none py-5 justify-between items-center z-40 px-20",
        "transition-all duration-700",
        inView ? "translate-y-0" : "translate-y-[200px]"
      )}>
        <p className="text-xs text-black">
            &copy; {currentYear} WALLS Entertainment Group Inc., All rights reserved.
        </p>
        <div className="flex gap-8 text-[10px] text-muted-foreground">
          <Link href="/terms-and-conditions" className="hover:underline">
            Terms and Conditions
          </Link>
          <Link href="/privacy-policy" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </footer>
    );
}