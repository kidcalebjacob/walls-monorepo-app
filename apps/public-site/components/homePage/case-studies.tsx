"use client";

import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef } from "react";

interface CaseStudiesProps {
    isMobileView: boolean;
}

export function CaseStudies({ isMobileView }: CaseStudiesProps) {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Scroll progress for the entire section
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    // Enhanced scroll effects for individual elements - disabled on mobile
    const backgroundRotate = useTransform(scrollYProgress, [0, 1], isMobileView ? [0, 0] : [0, 360]);
    
    // Card movement effects - disabled on mobile
    const rawLeftY = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], isMobileView ? [0, 0, 0, 0] : [-80, 0, 0, 80]);
    const rawCenterY = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], isMobileView ? [0, 0, 0, 0] : [80, 0, 0, -80]);
    const rawRightY = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], isMobileView ? [0, 0, 0, 0] : [-80, 0, 0, 80]);

    // Spring lock-in for smooth settle
    const leftY = useSpring(rawLeftY, { stiffness: 120, damping: 20, mass: 0.5 });
    const centerY = useSpring(rawCenterY, { stiffness: 120, damping: 20, mass: 0.5 });
    const rightY = useSpring(rawRightY, { stiffness: 120, damping: 20, mass: 0.5 });

    // Container variants for staggered animations
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.1,
                duration: 0.8
            }
        }
    };

    // Individual case study variants - separate for each position
    const caseStudyVariantsLeft = {
        hidden: { 
            opacity: 0, 
            x: -150,
            y: 50,
            rotateY: -15,
            filter: "blur(8px)"
        },
        visible: { 
            opacity: 1, 
            x: 0,
            y: 0,
            rotateY: 0,
            filter: "blur(0px)",
            transition: {
                type: "spring",
                stiffness: 80,
                damping: 25,
                duration: 1
            }
        }
    };

    const caseStudyVariantsCenter = {
        hidden: { 
            opacity: 0, 
            x: 0,
            y: 50,
            rotateY: 0,
            filter: "blur(8px)"
        },
        visible: { 
            opacity: 1, 
            x: 0,
            y: 0,
            rotateY: 0,
            filter: "blur(0px)",
            transition: {
                type: "spring",
                stiffness: 80,
                damping: 25,
                duration: 1
            }
        }
    };

    const caseStudyVariantsRight = {
        hidden: { 
            opacity: 0, 
            x: 150,
            y: 50,
            rotateY: 15,
            filter: "blur(8px)"
        },
        visible: { 
            opacity: 1, 
            x: 0,
            y: 0,
            rotateY: 0,
            filter: "blur(0px)",
            transition: {
                type: "spring",
                stiffness: 80,
                damping: 25,
                duration: 1
            }
        }
    };

    // Text variants for staggered text animation
    const textVariants = {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 200,
                damping: 25,
                delay: 0.3
            }
        }
    };

    return (
        <motion.section 
            ref={containerRef}
            className={cn(
                "relative w-full bg-gray-50 overflow-hidden",
                isMobileView ? "px-4 pt-8 pb-10" : "px-8 pt-20 pb-10"
            )}
        >
            {/* Background decorative elements */}
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 0.03, scale: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                    rotate: backgroundRotate
                }}
            >
                <div className="w-[800px] h-[800px] rounded-full bg-gradient-to-r from-walls-yellow via-orange-300 to-pink-400 opacity-20 blur-3xl" />
            </motion.div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header with enhanced animations */}
                <div className="text-center mb-16 pt-10">
                    <h2 
                        className={cn(
                            "font-bold tracking-tighter text-black mb-4",
                            isMobileView ? "text-5xl" : "text-5xl md:text-6xl"
                        )}
                    >
                        From influence to impact.
                    </h2>
                    <p className="text-lg md:text-xl font-light tracking-wide text-neutral-600">
                        Connecting talent to opportunities.
                    </p>
                </div>

                {/* Case Study Containers with staggered animations */}
                <motion.div 
                    className={cn(
                        "grid gap-8",
                        isMobileView ? "grid-cols-1" : "grid-cols-3"
                    )}
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                >
                    {/* First Case Study Container */}
                    <motion.div
                        className="relative group"
                        style={{ y: leftY }}
                        whileHover={isMobileView ? {} : { 
                            scale: 1.05,
                            transition: { duration: 0.3, ease: "easeOut" }
                        }}
                    >
                        <div 
                            className={cn(
                                "h-[36rem] mx-auto bg-neutral-200 rounded-3xl overflow-hidden relative hover:bg-gradient-to-br hover:from-walls-yellow hover:to-walls-sky transition-all duration-700",
                                isMobileView ? "w-full" : "w-[26rem]"
                            )}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                router.push('/work/ted-zhar');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    router.push('/work/ted-zhar');
                                }
                            }}
                        >
                            <div className="absolute top-6 left-6 right-6 text-black transition-colors duration-500 group-hover:text-white z-20">
                                <h3 className="text-5xl font-bold tracking-tight">
                                    Ted Zhar says Meet Your Heros
                                </h3>
                            </div>
                            <div className="relative w-full h-full">
                                <Image
                                    src="https://oehqusxpbwtbeenzixjh.supabase.co/storage/v1/object/public/web-ui-elements/1.svg"
                                    alt="Case Study 1"
                                    fill
                                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Second Case Study Container */}
                    <motion.div
                        className="relative group"
                        style={{ y: centerY }}
                        whileHover={isMobileView ? {} : { 
                            scale: 1.05,
                            transition: { duration: 0.3, ease: "easeOut" }
                        }}
                    >
                        <div 
                            className={cn(
                                "h-[36rem] mx-auto bg-neutral-200 rounded-3xl overflow-hidden relative hover:bg-gradient-to-br hover:from-walls-yellow hover:to-walls-sky transition-all duration-700",
                                isMobileView ? "w-full" : "w-[26rem]"
                            )}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                router.push('/work/luke-davidson');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    router.push('/work/luke-davidson');
                                }
                            }}
                        >
                            <div className="absolute top-6 left-6 right-6 text-black transition-colors duration-500 group-hover:text-white z-20">
                                <h3 className="text-5xl font-bold tracking-tight">
                                    Luke Davidson + Music Virality
                                </h3>
                            </div>
                            <div className="relative w-full h-full">
                                <Image
                                    src="https://oehqusxpbwtbeenzixjh.supabase.co/storage/v1/object/public/web-ui-elements/2.svg"
                                    alt="Case Study 2"
                                    fill
                                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Third Case Study Container */}
                    <motion.div
                        className="relative group"
                        style={{ y: rightY }}
                        whileHover={isMobileView ? {} : { 
                            scale: 1.05,
                            transition: { duration: 0.3, ease: "easeOut" }
                        }}
                    >
                        <div 
                            className={cn(
                                "h-[36rem] mx-auto bg-neutral-200 rounded-3xl overflow-hidden relative hover:bg-gradient-to-br hover:from-walls-yellow hover:to-walls-sky transition-all duration-700",
                                isMobileView ? "w-full" : "w-[26rem]"
                            )}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                                router.push('/work/dr-pickle');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    router.push('/work/dr-pickle');
                                }
                            }}
                        >
                            <div className="absolute top-6 left-6 right-6 text-black transition-colors duration-500 group-hover:text-white z-20">
                                <h3 className="text-5xl font-bold tracking-tight">
                                    Dr. Pickle's Edutainment App
                                </h3>
                            </div>
                            <div className="relative w-full h-full">
                                <Image
                                    src="https://oehqusxpbwtbeenzixjh.supabase.co/storage/v1/object/public/web-ui-elements/drpickle.svg"
                                    alt="Case Study 3"
                                    fill
                                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                                />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
                
                {/* Bottom spacing */}
                <div className={cn(isMobileView ? "h-4" : "h-28")}></div>
            </div>
        </motion.section>
    );
}
