import React from "react";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { Play } from "lucide-react";
import { PartnershipContent } from "../../types";

const ensureHttps = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getPlatformIcon = (platform: string | null | undefined) => {
  if (!platform) return null;
  switch (platform.toLowerCase()) {
    case 'instagram':
      return <FaInstagram className="w-4 h-4 text-pink-500 flex-shrink-0" />;
    case 'youtube':
      return <FaYoutube className="w-4 h-4 text-red-500 flex-shrink-0" />;
    case 'tiktok':
      return <FaTiktok className="w-4 h-4 text-black flex-shrink-0" />;
    default:
      return null;
  }
};

const formatPlatform = (platform: string | null | undefined) => {
  if (!platform) return '—';
  switch (platform.toLowerCase()) {
    case 'instagram':
      return 'Instagram';
    case 'youtube':
      return 'YouTube';
    case 'tiktok':
      return 'TikTok';
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
  }
};

interface ContentTabProps {
  contentItems: PartnershipContent[];
}

export default function ContentTab({ contentItems }: ContentTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white/50 backdrop-blur-sm shadow-sm rounded-[30px] p-6">
        <div className="flex items-center mb-6">
          <h2 className="text-black font-black text-4xl">POSTS</h2>
          <div className="flex-1 border-t border-black h-[1px] mx-4" />
        </div>

        {contentItems.length === 0 ? (
          <p className="text-sm text-muted-foreground font-light text-center py-8">
            No posts recorded for this partnership yet.
          </p>
        ) : (
          <div className="space-y-3">
            {contentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-100 shadow-inner border border-neutral-200/50"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                  {getPlatformIcon(item.platform)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {formatPlatform(item.platform)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-light mt-1">
                    {formatDate(item.postedAt)}
                  </p>
                </div>
                {item.contentUrl && (
                  <a
                    href={ensureHttps(item.contentUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-[0.5px] border-solid border-neutral-300 bg-gray-50 shadow-none transition-all duration-300 hover:border-neutral-200/80 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.14)] hover:scale-[0.98] cursor-pointer flex-shrink-0"
                  >
                    <Play className="w-4 h-4 flex-shrink-0 text-neutral-700" />
                    <span className="text-sm font-light text-neutral-700 whitespace-nowrap">View Post</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
