"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowUpRight, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";



function RevealButton({ bgColor, textColor }: { bgColor: string; textColor: string }) {
    return (
        <button
            className={cn(
                "group relative flex items-center justify-center rounded-full overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
                bgColor,
                textColor
            )}
        >
            {/* Expanding container */}
            <div
                className="
                    relative flex items-center w-12 h-12
                    group-hover:w-[100px] transition-all duration-300 ease-out
                    px-0 group-hover:px-4
                "
            >
                {/* Text (hidden until hover) */}
                <span
                    className="
                        absolute left-4 opacity-0 whitespace-nowrap
                        transition-all duration-200 delay-100
                        group-hover:opacity-100
                    "
                >
                    Visit
                </span>

                {/* Arrow */}
                <ArrowUpRight
                    size={18}
                    className="
                        absolute left-1/2 -translate-x-1/2
                        transform-gpu transition-all duration-300 ease-out
                        group-hover:left-auto group-hover:right-4 group-hover:translate-x-0
                        group-hover:rotate-[45deg]
                    "
                />
            </div>
        </button>
    );
}

interface ServicesProps {
    isMobileView: boolean;
}

export function Services({ isMobileView }: ServicesProps) {
    const router = useRouter();

    return (
        <section className={cn(
            "relative w-full pb-8 bg-transparent",
            isMobileView ? "px-4" : "px-8"
        )}>
            <div className="max-w-7xl mx-auto">


                {/* Services Grid */}
                <div className={cn(
                    "grid gap-8",
                    isMobileView ? "grid-cols-1" : "grid-cols-2"
                )}>
                    {/* Representation Card */}
                    <div className="relative">
                        <div 
                            className="group relative aspect-square overflow-hidden rounded-3xl bg-neutral-200"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                router.push('/talent');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    router.push('/talent');
                                }
                            }}
                        >
                            {/* IMAGE */}
                            <img 
                                src="https://oehqusxpbwtbeenzixjh.supabase.co/storage/v1/object/public/web-ui-elements/REPRESENTATION.svg"
                                alt="Representation"
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                            />

                            {/* CONTENT ABOVE IMAGE */}
                            <div className="absolute inset-0 z-10 flex flex-col justify-between p-8">
                                <h3 className="text-4xl font-bold tracking-tight text-black drop-shadow-lg">
                                    Representation
                                </h3>

                                <div className="mt-auto">
                                    <RevealButton 
                                        bgColor="bg-neutral-800"
                                        textColor="text-neutral-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Capabilities Card */}
                    <div className="relative">
                        <div 
                            className="group relative aspect-square overflow-hidden rounded-3xl bg-neutral-800"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                router.push('/capabilities');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    router.push('/capabilities');
                                }
                            }}
                        >
                            {/* IMAGE */}
                            <img 
                                src="https://oehqusxpbwtbeenzixjh.supabase.co/storage/v1/object/public/web-ui-elements/CAPABILITIES.svg"
                                alt="Capabilities"
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                            />

                            {/* CONTENT ABOVE IMAGE */}
                            <div className="absolute inset-0 z-10 flex flex-col justify-between p-8">
                                <h3 className="text-4xl font-bold tracking-tight text-neutral-200 drop-shadow-lg">
                                    Capabilities
                                </h3>

                                <div className="mt-auto">
                                    <RevealButton 
                                        bgColor="bg-neutral-200"
                                        textColor="text-neutral-800"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
} 