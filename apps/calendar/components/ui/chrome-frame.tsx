import { cn } from "@/lib/utils";

type ChromeFrameProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

/** AdPilot-style chrome glow rim around interactive surfaces. */
export function ChromeFrame({
  children,
  className,
  contentClassName,
}: ChromeFrameProps) {
  return (
    <div
      className={cn(
        "relative inline-flex overflow-hidden rounded-xl p-[1.5px]",
        className
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-[-60%]">
        <span className="kenoo-chrome-orbit absolute inset-0" />
      </span>
      <div className={cn("relative w-full", contentClassName)}>{children}</div>
    </div>
  );
}
