"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface LoadingPageProps {
    isLoading: boolean;
}

export function LoadingPage({ isLoading }: LoadingPageProps) {
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldShow, setShouldShow] = useState(false);
    const [shouldExpand, setShouldExpand] = useState(false);

    useEffect(() => {
        let startTimer: NodeJS.Timeout;
        let animationTimer: NodeJS.Timeout;

        if (isLoading) {
            setShouldShow(true);
            // Delay the start of animation slightly
            startTimer = setTimeout(() => {
                setShouldExpand(true);
                setIsAnimating(true);
            }, 100);

            animationTimer = setTimeout(() => {
                setIsAnimating(false);
            }, 1300);
        } else {
            setShouldExpand(false);
            setIsAnimating(false);
            const hideTimer = setTimeout(() => {
                setShouldShow(false);
            }, 700);

            return () => clearTimeout(hideTimer);
        }

        return () => {
            clearTimeout(startTimer);
            clearTimeout(animationTimer);
        };
    }, [isLoading]);

    if (!shouldShow) return null;

    return (
        <div className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-700",
            !isLoading && "opacity-0"
        )}>
            <div className="relative w-32 h-32 flex items-center justify-center">
                <div 
                    className={cn(
                        "absolute w-[50px] h-[50px] rounded-[25px] transition-colors duration-300",
                        shouldExpand && "animate-expand",
                        !shouldExpand && "scale-1",
                        isLoading && !isAnimating && !shouldExpand && "bg-walls-yellow scale-[100]"
                    )}
                    style={{
                        backgroundColor: !shouldExpand ? 'transparent' : undefined
                    }}
                />
                <Image
                    src="/images/WBlack.svg"
                    alt="WALLS Logo"
                    width={100}
                    height={100}
                    priority
                    className="relative z-10"
                />
            </div>
        </div>
    );
} 