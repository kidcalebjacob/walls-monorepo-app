"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getFirestore, collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { getFirebaseApp } from "@/app/auth/firebase";

interface NewsProps {
    isMobileView: boolean;
}

interface NewsArticle {
    id: string;
    title: string;
    content: string;
    imageUrl: string;
    createdAt: Timestamp;
}

export function News({ isMobileView }: NewsProps) {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
    const [isHotTopic, setIsHotTopic] = useState(false);

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const app = getFirebaseApp();
                const db = getFirestore(app);
                const articlesRef = collection(db, 'news');
                const q = query(articlesRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);

                const articlesData: NewsArticle[] = [];
                snapshot.forEach((doc) => {
                    articlesData.push({
                        id: doc.id,
                        ...doc.data() as Omit<NewsArticle, 'id'>
                    });
                });

                setArticles(articlesData);
                // Set the first article as hot topic if it exists
                if (articlesData.length > 0) {
                    setIsHotTopic(true);
                }
            } catch (error) {
                console.error("Error fetching articles:", error);
            }
        };

        fetchArticles();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentArticleIndex((current) => 
                current === articles.length - 1 ? 0 : current + 1
            );
        }, 10000);

        return () => clearInterval(timer);
    }, [articles.length]);

    if (articles.length === 0) {
        return null;
    }

    const currentArticle = articles[currentArticleIndex];

    return (
        <section id="news" className={cn(
            "relative min-h-screen bg-[#2F3336] flex flex-col items-stretch justify-start overflow-hidden",
            isMobileView && "-mt-1"
        )}>
            {/* Main Article */}
            <div className="relative w-full h-screen">
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 z-0">
                    {currentArticle.imageUrl && (
                        <Image
                            src={currentArticle.imageUrl}
                            alt={currentArticle.title}
                            fill
                            className="object-cover brightness-50"
                        />
                    )}
                    <div className="absolute inset-0 bg-black/50" />
                </div>

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col">
                    {/* Top Bar */}
                    <div className="w-full flex items-center justify-between px-2 md:px-4 py-2 md:py-3 bg-transparent">
                        <div className="flex items-center gap-2">
                            <Image
                                src="/images/WWhite.svg"
                                alt="WALLS Logo"
                                width={isMobileView ? 30 : 40}
                                height={isMobileView ? 22 : 30}
                                className="object-contain"
                            />
                        </div>
                        <div className="flex items-center gap-2 md:gap-4">
                            <span className="text-white/80 text-xs md:text-base hidden sm:inline">{new Date().toLocaleDateString('en-US', { weekday: 'long' })} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            <button className="bg-[#E54D2E] text-white px-2 md:px-4 py-1 md:py-1.5 text-xs md:text-sm whitespace-nowrap">
                                Today magazine
                            </button>
                        </div>
                    </div>

                    {/* Navigation Bar */}
                    <div className="w-full overflow-x-auto scrollbar-hide">
                        <div className="flex items-center gap-4 md:gap-8 px-2 md:px-4 py-2 md:py-3 bg-transparent border-y border-white/20 whitespace-nowrap">
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Talent</span>
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Business</span>
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Partnerships</span>
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Comedy</span>
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Music</span>
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Sports</span>
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Tech</span>
                            <span className="text-sm md:text-base text-white/80 hover:text-white cursor-pointer">Trends</span>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex items-center px-4 md:px-8 py-6 md:py-12">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentArticleIndex}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.6 }}
                                className="max-w-4xl"
                            >
                                {isHotTopic && (
                                    <div className="flex items-center gap-2 mb-2 md:mb-4">
                                        <span className="text-[#E54D2E] text-xs md:text-sm font-medium">HOT TOPIC</span>
                                        <span className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-[#E54D2E] animate-pulse" />
                                    </div>
                                )}
                                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl text-white font-bold mb-4 md:mb-6">
                                    {currentArticle.title}
                                </h1>
                                <div className="flex items-center gap-4 text-white/60 text-xs md:text-sm">
                                    <time>
                                        {currentArticle.createdAt?.toDate().toLocaleDateString('en-US', {
                                            minute: '2-digit',
                                            hour: '2-digit',
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </time>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Breaking News Bar */}
                    <div className="bg-[#E54D2E] text-white px-2 md:px-4 py-1.5 md:py-2 overflow-hidden">
                        <div className="flex items-center gap-2 md:gap-4">
                            <span className="text-xs md:text-base font-bold whitespace-nowrap">BREAKING NEWS</span>
                            <div className="overflow-hidden">
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={currentArticleIndex}
                                        initial={{ x: "0%" }}
                                        animate={{ 
                                            x: "-100%",
                                            transition: {
                                                duration: 45,
                                                ease: "linear",
                                                repeat: Infinity
                                            }
                                        }}
                                        className="text-xs md:text-sm whitespace-nowrap"
                                    >
                                        {currentArticle.content}
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dots navigation */}
            {articles.length > 1 && (
                <div className="absolute bottom-20 md:bottom-28 right-4 md:right-8 flex flex-col gap-1.5 md:gap-2">
                    {articles.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentArticleIndex(index)}
                            className={cn(
                                "w-1.5 md:w-2 h-1.5 md:h-2 rounded-full transition-all duration-300",
                                currentArticleIndex === index 
                                    ? "bg-white scale-125" 
                                    : "bg-white/30 hover:bg-white/50"
                            )}
                            aria-label={`Go to article ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
} 