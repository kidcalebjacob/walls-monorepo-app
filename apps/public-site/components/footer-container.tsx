import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";

const navRow1 = [
    { href: "/", label: "The WALLS Way" },
    { href: "/work", label: "Work" },
    { href: "/careers", label: "Careers" },
    { href: "/about", label: "About" },
];
const navRow2 = [
    { href: "/capabilities", label: "Capabilities" },
    { href: "/about", label: "Our Story" },
    { href: "/contact", label: "Contact" },
];

const legalCol1: Array<{ href: string; label: string }> = [
    { href: "/about", label: "WEG" },
];
const legalCol2 = [
    { href: "mailto:info@wallsentertainment.com", label: "Say Hello" },
    { href: "/terms-and-conditions", label: "Terms" },
];
const legalCol3 = [
    { href: "mailto:press@wallsentertainment.com", label: "Press" },
    { href: "/privacy-policy", label: "Privacy Policy" },
];

const chevronLinkClass =
    "text-neutral-800 hover:text-neutral-600 transition-colors text-base md:text-lg inline-flex items-center gap-1 group cursor-pointer";

function LegalLink({ item }: { item: { href: string; label: string } }) {
    return (
        <div
            className="w-fit md:transition-transform md:duration-200 md:hover:translate-x-[5px]"
        >
            <Link href={item.href} className={`${chevronLinkClass} md:text-lg`}>
                <span>{item.label}</span>
                <ChevronRight className="w-5 h-5 opacity-0 -ml-4 md:group-hover:opacity-100 md:group-hover:ml-2 transition-all duration-300 shrink-0" />
            </Link>
        </div>
    );
}

export default function FooterContainer() {
    return (
        <footer className="bg-gray-50 text-neutral-900 relative z-50">
            <div className="max-w-4xl mx-auto px-6 pt-12 md:pt-14 pb-4 md:pb-6">
                {/* Two rows of nav links – centered; on mobile only: two columns */}
                <div className="flex flex-col items-center gap-3 md:gap-4 text-center">
                    {/* Mobile: two columns (col1 = row1 items, col2 = row2 items) */}
                    <div className="grid grid-cols-2 gap-x-12 w-full max-w-xs md:hidden justify-items-center">
                        <div className="flex flex-col gap-6 items-center">
                            {navRow1.map((item) => (
                                <div
                                    key={item.href + item.label}
                                    className="w-fit md:transition-transform md:duration-200 md:hover:translate-x-[5px]"
                                >
                                    <Link
                                        href={item.href}
                                        className="text-neutral-800 hover:text-neutral-600 transition-colors text-base flex items-center justify-center gap-1 group cursor-pointer"
                                    >
                                        <span>{item.label}</span>
                                        <ChevronRight className="w-5 h-5 opacity-0 -ml-4 md:group-hover:opacity-100 md:group-hover:ml-2 transition-all duration-300" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-6 items-center">
                            {navRow2.map((item) => (
                                <div
                                    key={item.href + item.label}
                                    className="w-fit md:transition-transform md:duration-200 md:hover:translate-x-[5px]"
                                >
                                    <Link
                                        href={item.href}
                                        className="text-neutral-800 hover:text-neutral-600 transition-colors text-base flex items-center justify-center gap-1 group cursor-pointer"
                                    >
                                        <span>{item.label}</span>
                                        <ChevronRight className="w-5 h-5 opacity-0 -ml-4 md:group-hover:opacity-100 md:group-hover:ml-2 transition-all duration-300" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Desktop: two rows as before */}
                    <div className="hidden md:flex flex-wrap justify-center gap-x-10 md:gap-x-14 gap-y-2">
                        {navRow1.map((item) => (
                            <div
                                key={item.href + item.label}
                                className="w-fit md:transition-transform md:duration-200 md:hover:translate-x-[5px]"
                            >
                                <Link
                                    href={item.href}
                                    className="text-neutral-800 hover:text-neutral-600 transition-colors text-base md:text-lg flex items-center justify-center gap-1 group cursor-pointer"
                                >
                                    <span>{item.label}</span>
                                    <ChevronRight className="w-5 h-5 opacity-0 -ml-4 md:group-hover:opacity-100 md:group-hover:ml-2 transition-all duration-300" />
                                </Link>
                            </div>
                        ))}
                    </div>
                    <div className="hidden md:flex flex-wrap justify-center gap-x-10 md:gap-x-14 gap-y-2">
                        {navRow2.map((item) => (
                            <div
                                key={item.href + item.label}
                                className="w-fit md:transition-transform md:duration-200 md:hover:translate-x-[5px]"
                            >
                                <Link
                                    href={item.href}
                                    className="text-neutral-800 hover:text-neutral-600 transition-colors text-base md:text-lg flex items-center justify-center gap-1 group cursor-pointer"
                                >
                                    <span>{item.label}</span>
                                    <ChevronRight className="w-5 h-5 opacity-0 -ml-4 md:group-hover:opacity-100 md:group-hover:ml-2 transition-all duration-300" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main branding – WALLS logo + text (same as public header) */}
                <div className="flex justify-center mt-6 md:mt-8">
                    <Link href="/" className="flex items-center gap-3">
                        <Image
                            src="/images/WBlack.svg"
                            alt="WALLS ENT."
                            width={180}
                            height={118}
                            className="h-16 w-auto md:h-12 lg:h-14 object-contain shrink-0"
                        />
                        <span className="flex flex-col leading-tight text-neutral-800/90">
                            <span className="text-xs font-light tracking-wide">WALLS</span>
                            <span className="text-xs font-light tracking-wide">ENTERTAINMENT</span>
                            <span className="text-xs font-light tracking-wide">GROUP</span>
                        </span>
                    </Link>
                </div>

                {/* Legal / info links – two columns on mobile, centered row on desktop */}
                <div className="mt-6 md:mt-8 max-w-2xl mx-auto">
                    {/* Mobile: two columns */}
                    <div className="grid grid-cols-2 gap-x-12 w-full max-w-xs mx-auto md:hidden justify-items-center">
                        <div className="flex flex-col gap-6 items-center">
                            {legalCol1.map((item) => (
                                <LegalLink key={item.label} item={item} />
                            ))}
                            <LegalLink item={legalCol2[0]} />
                        </div>
                        <div className="flex flex-col gap-6 items-center">
                            <LegalLink item={legalCol2[1]} />
                            {legalCol3.map((item) => (
                                <LegalLink key={item.label} item={item} />
                            ))}
                        </div>
                    </div>
                    {/* Desktop: top row WEG | Say Hello | Press — Terms + Privacy centered below */}
                    <div className="hidden md:flex flex-col items-center gap-3">
                        <div className="grid grid-cols-3 gap-x-12 lg:gap-x-16 w-full max-w-lg mx-auto">
                            <div className="flex justify-center">
                                <LegalLink item={legalCol1[0]} />
                            </div>
                            <div className="flex justify-center">
                                <LegalLink item={legalCol2[0]} />
                            </div>
                            <div className="flex justify-center">
                                <LegalLink item={legalCol3[0]} />
                            </div>
                        </div>
                        <div className="flex gap-x-10 lg:gap-x-12 items-center justify-center">
                            <LegalLink item={legalCol2[1]} />
                            <LegalLink item={legalCol3[1]} />
                        </div>
                    </div>
                </div>

                {/* Copyright – center aligned at bottom */}
                <div className="mt-4 md:mt-6 pt-4 text-center">
                    <p className="text-neutral-500 font-extralight text-xs md:text-base">
                        © 2026 WALLS Entertainment Group Inc. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
