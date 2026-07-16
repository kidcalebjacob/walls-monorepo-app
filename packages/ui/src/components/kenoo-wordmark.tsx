import Image from "next/image";

import { cn } from "@walls/utils";

import textOnlyLogo from "../assets/logos/text-only.png";

export type KenooWordmarkProps = {
  className?: string;
  /** `ink` for light backgrounds (logo file is white). Default: `ink`. */
  variant?: "ink" | "white";
  priority?: boolean;
};

/** Shared Kenoo text logo for headers and brand placements. */
export function KenooWordmark({
  className,
  variant = "ink",
  priority = false,
}: KenooWordmarkProps) {
  return (
    <Image
      src={textOnlyLogo}
      alt="Kenoo"
      width={160}
      height={40}
      className={cn(
        "h-7 w-auto",
        variant === "ink" && "brightness-0",
        className,
      )}
      priority={priority}
    />
  );
}
