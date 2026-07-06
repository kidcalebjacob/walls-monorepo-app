"use client";

import { type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useInView } from "react-intersection-observer";
import { PublicHeader } from "@/components/public-header";
import FooterContainer from "@/components/footer-container";
import { cn } from "@/lib/utils";
import { defaultAboutText } from "@/lib/representation/contract-type";
import { representationDisplayHandle } from "@/lib/representation/instagram-username";
import type { RelatedTalentCard, TalentDetail } from "@/lib/representation/types";

const platformConfig: Record<
  string,
  {
    icon: ComponentType<{ className?: string }>;
    label: string;
    iconClass: string;
  }
> = {
  instagram: {
    icon: FaInstagram,
    label: "Instagram",
    iconClass: "text-pink-600",
  },
  tiktok: {
    icon: FaTiktok,
    label: "TikTok",
    iconClass: "text-black",
  },
  youtube: {
    icon: FaYoutube,
    label: "YouTube",
    iconClass: "text-red-600",
  },
  twitter: {
    icon: FaXTwitter,
    label: "X",
    iconClass: "text-black",
  },
  x: {
    icon: FaXTwitter,
    label: "X",
    iconClass: "text-black",
  },
};

interface Props {
  talent: TalentDetail;
  canonicalHandle: string;
  relatedTalents: RelatedTalentCard[];
}

export default function TalentDetailPage({
  talent,
  canonicalHandle,
  relatedTalents,
}: Props) {
  const { ref, inView } = useInView({ threshold: 0, initialInView: true });

  const category = talent.category || "Content Creator";
  const bio =
    talent.about?.trim() ||
    defaultAboutText(talent.name, category, talent.contract_type);
  const displayHandle = representationDisplayHandle(talent.instagram_username);
  const socialPlatforms = talent.socialAccounts.filter(
    (s) => s.url && s.platform && platformConfig[s.platform.toLowerCase()]
  );

  return (
    <div className="min-h-screen w-full bg-gray-50 text-foreground">
      <div ref={ref} className="absolute top-0 h-1 w-full" aria-hidden />

      <PublicHeader inView={inView} />

      <section className="w-full bg-walls-yellow px-4 md:px-8 lg:px-12 pt-28 pb-8 md:pt-32 md:pb-10">
        <div className="max-w-screen-xl mx-auto">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-none text-black">
              {talent.name}
            </h1>
            {displayHandle && (
              <p className="-mt-1 text-xs md:text-sm font-light leading-none text-black/70">
                {displayHandle}
              </p>
            )}
            {socialPlatforms.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
                {socialPlatforms.map((s) => {
                  const cfg = platformConfig[s.platform.toLowerCase()];
                  const Icon = cfg.icon;
                  return (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer me"
                      aria-label={`${talent.name} on ${cfg.label}`}
                      className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10"
                    >
                      <Icon className={cn("h-6 w-6 md:h-7 md:w-7", cfg.iconClass)} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="w-full bg-gray-50 px-4 md:px-8 lg:px-12 py-10 md:py-14">
        <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
          <div className="relative w-full aspect-[3/4] max-w-md mx-auto md:mx-0 bg-neutral-100 overflow-hidden">
            {talent.avatar_url ? (
              <Image
                src={talent.avatar_url}
                alt={talent.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 400px"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
                <span className="text-6xl font-light text-neutral-300">
                  {talent.name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-light text-neutral-700 leading-relaxed whitespace-pre-line">
              {bio}
            </p>
          </div>
        </div>
      </section>

      {relatedTalents.length > 0 && (
        <section className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16 bg-gray-50">
          <div className="max-w-screen-xl mx-auto">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black mb-8">
              More WALLS Talent
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 md:gap-8">
              {relatedTalents.map((related) => (
                <Link
                  key={related.id}
                  href={`/representation/${related.representation_path}`}
                  className="group flex flex-col"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-neutral-200 mb-3">
                    {related.avatar_url ? (
                      <Image
                        src={related.avatar_url}
                        alt={related.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 45vw, 200px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-200">
                        <span className="text-2xl font-light text-neutral-400">
                          {related.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-black uppercase tracking-tight text-black leading-tight">
                    {related.name}
                  </p>
                  {related.instagram_username && (
                    <p className="text-xs font-light text-neutral-500 mt-0.5">
                      @{related.instagram_username}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="bg-gray-50 px-4 md:px-8 py-8">
        <p className="text-xs font-light text-neutral-500 text-center max-w-3xl mx-auto">
          Official WALLS Entertainment representation page for {talent.name}
          {displayHandle ? ` (${displayHandle})` : ""}.{" "}
          <Link
            href={`/representation/${canonicalHandle}`}
            className="text-walls-sky hover:underline"
          >
            wallsentertainment.com/representation/{canonicalHandle}
          </Link>
        </p>
      </footer>

      <FooterContainer />
    </div>
  );
}
