"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

interface ValuesMobileProps {
    isMobileView: boolean;
}

export function ValuesMobile({ isMobileView }: ValuesMobileProps) {
    return (
        <section 
            className={cn(
                "relative w-full py-2",
                isMobileView ? "px-4" : "px-8"
            )}
        >
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-center">
                    <div className="relative group w-full max-w-7xl mx-auto">
                        <div className="relative w-full bg-neutral-200 rounded-3xl overflow-hidden" style={{ paddingBottom: '140%' }}>
                            <div className="absolute inset-0 z-0 flex items-end justify-center">
                                <div className="w-[600px] h-[600px] bg-walls-yellow rounded-full"></div>
                            </div>
                            <div className="absolute inset-0 flex items-start justify-center -pt-32 z-10">
                                <span className="text-[150px] font-black text-neutral-800 select-none">
                                    TEAM
                                </span>
                            </div>
                            
                            <Image
                                src="https://oehqusxpbwtbeenzixjh.supabase.co/storage/v1/object/public/web-ui-elements/murphslife-values.png"
                                alt="WALLS Entertainment Core Values"
                                fill
                                className="object-cover relative z-20"
                                priority
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                            />
                            
                            {/* Community Text Card */}
                            <div className="absolute bottom-8 left-4 z-30 max-w-52">
                                <h3 className="text-3xl font-medium tracking-tight text-black mb-1 uppercase bg-walls-yellow px-2 py-1 rounded">
                                    It takes a
                                </h3>
                                <h3 className="text-4xl font-black tracking-tight text-walls-yellow mb-3 uppercase bg-black px-2 py-1 rounded">
                                    Village
                                </h3>

                                <Link href="/about" className="bg-walls-yellow text-black uppercase px-8 py-4 rounded-full font-medium hover:bg-black hover:text-walls-yellow transition-all duration-500 ease-in-out flex items-center gap-2 inline-block text-lg">
                                    Our values
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                                    </svg>
                                </Link>
                            </div>


                        </div>
                    </div>
                </div>
                
                {/* Bottom spacing */}
                <div className="h-20"></div>
            </div>
        </section>
    );
}
