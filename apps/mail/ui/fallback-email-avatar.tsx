import { cn } from "@/lib/utils";

interface FallbackEmailAvatarProps {
  name: string;
  className?: string;
}

function getInitialsFromName(name: string): string {
  const safeName = name.trim();
  if (!safeName) return "U";

  const words = safeName
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }

  // For single-token values (including email-like strings), use first two letters.
  return safeName.slice(0, 2).toUpperCase();
}

export function FallbackEmailAvatar({ name, className }: FallbackEmailAvatarProps) {
  const safeName = name.trim() || "Unknown";
  const avatarInitials = getInitialsFromName(safeName);

  return (
    <div
      className={cn(
        "w-full h-full rounded-full flex items-center justify-center text-[13px] font-normal tracking-wide select-none",
        "bg-gray-50 text-neutral-300 border border-neutral-200 shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]",
        className
      )}
      aria-label={`${safeName} avatar`}
    >
      {avatarInitials}
    </div>
  );
}
