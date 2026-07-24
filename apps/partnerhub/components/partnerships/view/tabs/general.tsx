import React from "react";
import { Input as BorderlessInput } from "@/components/ui/borderless-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AVATAR_FALLBACK_URL } from "@/lib/asset-urls";
import { Link2, User2, Building2 } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { getCountryCodeForDisplay, getCountryDisplayName } from "@/types/country.types";

const fieldWrapperClass = "rounded-2xl bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 px-3 py-1";
const inputInnerClass = "border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full min-w-0 placeholder:text-neutral-400";
const labelClass = "text-xs font-normal text-neutral-400 tracking-wide block mb-1";

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

interface GeneralTabProps {
  formData: any;
  handleInputChange: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export default function GeneralTab({ formData, handleInputChange }: GeneralTabProps) {
  const rawCountry = formData.talentHq || "";
  const countryDisplayName = getCountryDisplayName(rawCountry);
  const countryCode = rawCountry ? getCountryCodeForDisplay(rawCountry) : null;
  const showFlag = countryCode && countryCode !== "UN";

  return (
    <div className="space-y-6">
      {/* Talent & Company */}
      <div className="bg-white/50 backdrop-blur-sm shadow-sm rounded-[30px] p-6">
        <div className="flex items-center mb-6">
          <h2 className="text-black font-black text-4xl">PARTNERSHIP DETAILS</h2>
          <div className="flex-1 border-t border-black h-[1px] mx-4" />
        </div>

        <div className="grid grid-cols-2 gap-4 items-start">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Talent */}
            <div>
              <label className={labelClass}>Talent</label>
              <div className={`${fieldWrapperClass} pl-1.5 pr-3 flex items-center gap-3`}>
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={formData.talentAvatar || AVATAR_FALLBACK_URL} alt={formData.talentName} className="object-cover" />
                  <AvatarFallback className="bg-neutral-200">
                    <User2 className="h-3.5 w-3.5 text-neutral-400" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-light text-foreground flex-1 truncate py-2">
                  {formData.talentName || '—'}
                </span>
              </div>
            </div>

            {/* Talent HQ */}
            <div>
              <label className={labelClass}>Talent HQ</label>
              <div className={`${fieldWrapperClass} pl-1.5 pr-3 flex items-center gap-2`}>
                {showFlag && (
                  <div className="relative w-4 h-4 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center ml-1.5">
                    <ReactCountryFlag
                      countryCode={countryCode as string}
                      svg
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      title={countryDisplayName ? `${countryDisplayName} flag` : "Country flag"}
                    />
                  </div>
                )}
                <span className="text-sm font-light text-foreground flex-1 truncate py-2 px-2">
                  {countryDisplayName || '—'}
                </span>
              </div>
            </div>

            {/* Talent Category */}
            <div>
              <label className={labelClass}>Category</label>
              <div className={`${fieldWrapperClass} pl-1.5 pr-3`}>
                <span className="text-sm font-light text-foreground flex-1 truncate py-2 px-2 block">
                  {formData.talentCategory || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Company */}
            <div>
              <label className={labelClass}>Company</label>
              <div className={`${fieldWrapperClass} pl-1.5 pr-3 flex items-center gap-3`}>
                <Avatar className="h-7 w-7 flex-shrink-0 rounded-md">
                  <AvatarImage src={formData.companyLogo || undefined} alt={formData.company} className="object-cover" />
                  <AvatarFallback className="bg-neutral-200 rounded-md">
                    <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-light text-foreground flex-1 truncate py-2">
                  {formData.company || '—'}
                </span>
                {formData.companyWebsite && (
                  <a
                    href={ensureHttps(formData.companyWebsite)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Last Posted */}
            <div>
              <label className={labelClass}>Last Posted</label>
              <div className={`${fieldWrapperClass} pl-1.5 pr-3`}>
                <span className="text-sm font-light text-foreground py-2 px-2 block">
                  {formatDate(formData.postedAt)}
                </span>
              </div>
            </div>

            {/* Created At */}
            <div>
              <label className={labelClass}>Created At</label>
              <div className={`${fieldWrapperClass} pl-1.5 pr-3`}>
                <span className="text-sm font-light text-foreground py-2 px-2 block">
                  {formatDate(formData.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tagged Handle */}
        <div className="mt-4">
          <label className={labelClass}>Tagged Handle</label>
          <div className={`${fieldWrapperClass} pl-1.5 pr-3`}>
            <BorderlessInput
              type="text"
              value={formData.taggedHandle ?? ''}
              onChange={handleInputChange('taggedHandle')}
              placeholder="@handle"
              className={inputInnerClass}
            />
          </div>
        </div>

        {/* Partnership URL */}
        <div className="mt-4">
          <label className={labelClass}>Partnership URL</label>
          <div className={`${fieldWrapperClass} pl-1.5 pr-3 flex items-center gap-2`}>
            <BorderlessInput
              type="text"
              value={formData.partnershipUrl ?? ''}
              onChange={handleInputChange('partnershipUrl')}
              placeholder="https://..."
              className={inputInnerClass}
            />
            {formData.partnershipUrl && (
              <a
                href={ensureHttps(formData.partnershipUrl)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                <Link2 className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Hashtags */}
        <div className="mt-4">
          <label className={labelClass}>Hashtags</label>
          <div className={`${fieldWrapperClass} pl-1.5 pr-3 py-2 min-h-[2.5rem] flex items-center`}>
            {(formData.hashtags ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {formData.hashtags.map((tag: string, index: number) => (
                  <span
                    key={`${tag}-${index}`}
                    className="text-xs font-light text-neutral-600 bg-neutral-200/70 rounded-full px-2.5 py-1"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm font-light text-muted-foreground px-2">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
