"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface EmailListLoaderProps {
    isLoading: boolean;
}

export function EmailListLoader({ isLoading }: EmailListLoaderProps) {
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
            "absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-700",
            !isLoading && "opacity-0"
        )}>
            <div className="relative w-24 h-24 flex items-center justify-center">
                <div 
                    className={cn(
                        "absolute w-[40px] h-[40px] rounded-[20px] transition-colors duration-300",
                        shouldExpand && "animate-expand",
                        !shouldExpand && "scale-1",
                        isLoading && !isAnimating && !shouldExpand && "bg-kenoo-yellow scale-[100]"
                    )}
                    style={{
                        backgroundColor: !shouldExpand ? 'transparent' : undefined
                    }}
                />
                <Image
                    src="/images/WBlack.svg"
                    alt="WALLS Logo"
                    width={80}
                    height={80}
                    priority
                    className="relative z-10"
                />
            </div>
        </div>
    );
} 