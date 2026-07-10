import { cn } from "@/lib/utils";
import Link from "next/link";

interface SettingsFooterProps {
  inView?: boolean;
}

export default function SettingsFooter({ inView = true }: SettingsFooterProps) {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className={cn(
      "w-full bottom-0 left-0 flex flex-none py-1 justify-between items-center z-40 pl-72 pr-6",
      "transition-all duration-700",
      inView ? "translate-y-0" : "translate-y-[200px]"
    )}>
      <div className="rounded-full bg-background px-6 py-3">
        <p className="text-xs text-muted-foreground">
          &copy; {currentYear} WALLS Entertainment Group Inc., All rights reserved.
        </p>
      </div>
      <div className="flex gap-4">
        <div className="rounded-full bg-background px-6 py-3">
          <Link href="/terms-and-conditions" className="text-[10px] text-muted-foreground hover:underline">
            Terms and Conditions
          </Link>
        </div>
        <div className="rounded-full bg-background px-6 py-3">
          <Link href="/privacy-policy" className="text-[10px] text-muted-foreground hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
} 