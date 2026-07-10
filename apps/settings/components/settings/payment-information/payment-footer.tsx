"use client";

import { useSidebar } from "../sidebar-context";
import { cn } from "@/lib/utils";

export default function PaymentFooter() {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "border-t border-neutral-200 fixed bottom-0 right-0 left-0 z-10 py-3 backdrop-blur-md bg-white transition-all duration-300 ease-in-out",
        isCollapsed ? "md:left-14" : "md:left-52"
      )}
    >
      <div className="max-w-4xl mx-auto px-8">
        <div className="flex items-center justify-center gap-2 text-xs text-black">
          <span>Powered by</span>
          <img
            src="https://d21buns5ku92am.cloudfront.net/69645/images/470452-Frame%2039322-23bbb3-original-1677657684.png"
            alt="Wise"
            className="h-5 w-auto"
          />
        </div>
      </div>
    </div>
  );
}
