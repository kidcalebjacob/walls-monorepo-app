"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useInView } from "react-intersection-observer";

/** Browser picks the right file from HTML (no JS), so mobile avoids a desktop-video flash. */
const HERO_VIDEO_MOBILE =
    "https://assets.wallsentertainment.com/hero-video-mobile-v2.mp4";
const HERO_VIDEO_DESKTOP =
    "https://assets.wallsentertainment.com/hero-video-v5.mp4";

interface HeroProps {
    isMobileView: boolean;
    inView: boolean;
}

export function Hero({ isMobileView, inView }: HeroProps) {
    const [hasScrolledToServices, setHasScrolledToServices] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const { ref: bottomRef, inView: isBottomVisible } = useInView({
        threshold: 0,
        rootMargin: "-20% 0px 0px 0px",
    });

    useEffect(() => {
        if (!isBottomVisible && !hasScrolledToServices) {
            setHasScrolledToServices(true);
        }
    }, [isBottomVisible]);

    // `<source media>` is evaluated at parse time; after crossing 768px we must reload
    // so the engine re-picks the correct `<source>`.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const reselectSource = () => {
            video.load();
            void video.play().catch(() => {});
        };

        window.addEventListener("resize", reselectSource);
        return () => window.removeEventListener("resize", reselectSource);
    }, []);



    return (
        <section className={cn(
            "relative min-h-screen w-full overflow-hidden"
        )}>
            {/* Background layer - visible while video loads and in letterboxing */}
            <div
                className="absolute inset-0 w-full h-full z-0"
                style={{ backgroundColor: "#e2f85c" }}
                aria-hidden
            />
            <motion.div 
                className="absolute inset-0 w-full h-full z-10"
            >
                <div className="absolute inset-0 w-full h-full">
                    {/* Video with Dynamic Source */}
                    <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover object-center"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                    >
                        <source
                            src={HERO_VIDEO_MOBILE}
                            type="video/mp4"
                            media="(max-width: 767px)"
                        />
                        <source src={HERO_VIDEO_DESKTOP} type="video/mp4" />
                    </video>
                </div>
            </motion.div>

            {/* Bottom observer */}
            <div ref={bottomRef} className="absolute bottom-0 w-full h-20" />

            {/* Add keyframes for scroll indicator animation */}
            <style jsx>{`
                @keyframes scroll-indicator {
                    0% {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    15% {
                        transform: translateY(0);
                        opacity: 1;
                    }
                    85% {
                        transform: translateY(100%);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(200%);
                        opacity: 0;
                    }
                }
                
                @keyframes scroll-line {
                    0% {
                        transform: translateY(-100%);
                    }
                    100% {
                        transform: translateY(100%);
                    }
                }
                
                .animate-scroll-line {
                    animation: scroll-line 1.5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
                }
                
                .animate-scroll-indicator {
                    animation: scroll-indicator 2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
                }
            `}</style>
        </section>
    );
} 