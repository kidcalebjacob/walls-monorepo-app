import { cn } from "@/lib/utils";
import { useState } from "react";
import Image from "next/image";
import { formatDetailedDate } from "@/utils/format-utils";
import { decodeHtmlEntities } from "@/utils/email-utils";
import { FallbackEmailAvatar } from "./ui/fallback-email-avatar";

interface CollapsedEmailProps {
  senderName: string;
  senderEmail: string;
  snippet: string;
  date: string;
  avatarUrl?: string | null;
  isFromCurrentUser: boolean;
  isHovering: boolean;
  onReply: (replyAll: boolean) => void;
  onForward: () => void;
  onClick: () => void;
}

export function CollapsedEmail({
  senderName,
  senderEmail,
  snippet,
  date,
  avatarUrl,
  isFromCurrentUser,
  isHovering,
  onReply,
  onForward,
  onClick
}: CollapsedEmailProps) {
  const [avatarImgError, setAvatarImgError] = useState(false);
  const showAvatarImg = !!avatarUrl && !avatarImgError;

  const handleReplyClick = (replyAll: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply(replyAll);
  };

  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-3 hover:bg-accent/5 cursor-pointer select-none"
    >
      {/* Sender Avatar - match preview header styling */}
      <div className={cn(
        "w-11 h-11 rounded-full shrink-0 overflow-hidden"
      )}>
        {showAvatarImg ? (
          <Image
            src={avatarUrl}
            alt={senderName}
            width={44}
            height={44}
            className="w-full h-full object-cover"
            onError={() => setAvatarImgError(true)}
          />
        ) : (
          <FallbackEmailAvatar name={senderName} />
        )}
      </div>

      {/* Content - allow clicks anywhere inside to bubble to parent */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-normal text-neutral-500 truncate"
            onClick={onClick}
          >
            {isFromCurrentUser ? 'me' : senderName}
          </span>
        </div>
        <div className="text-xs text-neutral-400 truncate leading-relaxed min-h-[20px]">
          {snippet ? (
            <span onClick={onClick}>{decodeHtmlEntities(snippet)}</span>
          ) : (
            <span className="text-neutral-400 italic" onClick={onClick}>
              No content
            </span>
          )}
        </div>
      </div>

      {/* Date/time on far right (always visible) */}
      <span className="w-32 text-right text-xs font-light text-muted-foreground">
        {formatDetailedDate(date)}
      </span>

    </div>
  );
} 