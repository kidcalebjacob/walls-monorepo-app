'use client';

import Image from 'next/image';
import Link from 'next/link';
import UserProfileButton from '@/components/user-profile-button';

export default function PartnerHubHeader() {
  return (
    <header className="flex-shrink-0 border-b border-neutral-200 bg-gray-50">
      <div className="flex h-[4.5rem] items-center justify-between gap-6 px-6 md:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <Image
            src="https://assets.wallsentertainment.com/logo-variations/black-gradient.png"
            alt="WALLS"
            width={72}
            height={28}
            className="h-7 w-auto object-contain flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <div className="hidden sm:flex flex-col gap-0.5 leading-none text-[11px] font-normal uppercase tracking-[0.14em] text-black">
            <span>Partner</span>
            <span>Hub</span>
          </div>
        </Link>

        <div className="shrink-0">
          <UserProfileButton />
        </div>
      </div>

      <div className="partnerhub-header-accent h-[2px] w-full" aria-hidden />
    </header>
  );
}
