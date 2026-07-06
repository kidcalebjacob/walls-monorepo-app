"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { motion, useScroll, useTransform, useMotionValue, useAnimationFrame } from "framer-motion";

interface ValuesProps {
    isMobileView: boolean;
}

export function Values({ isMobileView }: ValuesProps) {
    const sectionRef = useRef<HTMLElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const stripXVal = useMotionValue(0);
    const stripX = useTransform(stripXVal, (v) => `${v}%`);

    useAnimationFrame((_time, delta) => {
        const baseSpeed = 0.6;
        const deltaSeconds = delta / 1000;
        const increment = baseSpeed * deltaSeconds;
        let x = stripXVal.get() - increment;
        while (x < -50) x += 50;
        stripXVal.set(x);
    });

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "center center"],
    });
    // Parallax: text scales less (stays smaller), moves up more
    const scaleText = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 1, 1.04]);
    const yText = useTransform(scrollYProgress, [0, 0.5, 1], ["7%", "0%", "-9%"]);
    const scaleImage = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1, 1.04]);
    const yImage = useTransform(scrollYProgress, [0, 0.5, 1], ["-1.5%", "0%", "1.5%"]);
    return (
        <>
        <section ref={sectionRef} className="relative h-screen w-full overflow-hidden">
            {/* Full viewport height – circle is in parent wrapper (index), expands into services behind cards */}
            <div className="absolute inset-0 bg-transparent">
                            {/* Background Text – parallax: scales more, drifts up */}
                            <div className="absolute inset-0 flex items-start justify-center -pt-52 z-10 origin-center">
                                <motion.span
                                    className="text-[clamp(8rem,25vw,250px)] font-black text-walls-yellow select-none block"
                                    style={{ scale: scaleText, y: yText }}
                                >
                                    TEAM
                                </motion.span>
                            </div>
                            
                            {/* Image – parallax: scales less, drifts down (different rate = depth) */}
                            <motion.div
                                className="absolute inset-0 z-20 origin-center"
                                style={{ scale: scaleImage, y: yImage }}
                            >
                                <Image
                                    src="https://oehqusxpbwtbeenzixjh.supabase.co/storage/v1/object/public/web-ui-elements/murphslife-values.png"
                                    alt="WALLS Entertainment Core Values"
                                    fill
                                    className="object-cover"
                                    priority
                                    sizes="100vw"
                                />
                            </motion.div>
                            
                    {/* Community Text Card */}
                    <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 z-30 max-w-60">
                                <h3 className="text-xl font-medium tracking-tight text-walls-yellow mb-1 uppercase">
                                    It takes a
                                </h3>
                                <h3 className="text-4xl font-black tracking-tight text-walls-yellow mb-3 uppercase">
                                    Village
                                </h3>
                                <p className="text-base font-light text-neutral-300 leading-relaxed mb-4">
                                    Our model is simple: individual strength creates collective force. We can do more together.
                                </p>
                                <Link href="/about" className="border-2 border-walls-yellow text-walls-yellow bg-transparent px-6 py-3 rounded-full font-medium hover:bg-walls-yellow/85 hover:text-black hover:border-walls-yellow transition-all duration-500 ease-in-out flex items-center justify-between w-full">
                                    <span>Our values</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                                    </svg>
                                </Link>
                            </div>

                    {/* Right Side Dotted Circle Container */}
                    <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30">
                        <div className="relative">
                            <div className="w-40 h-40 border-4 border-dashed border-neutral-300 rounded-full flex items-center justify-center hover:bg-walls-yellow/70 transition-all duration-500 ease-in-out">
                                <div className="w-36 h-36 rounded-full overflow-hidden flex items-center justify-center">
                                    <Image
                                        src="https://assets.wallsentertainment.com/murphslife.png"
                                        alt="Murphslife logo"
                                        width={150}
                                        height={150}
                                        className="object-contain w-28 h-28 opacity-90"
                                    />
                                </div>
                            </div>
                            <div className="text-center mt-4">
                                        <a
                                            href="https://murphslife.com/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm text-neutral-300 hover:bg-walls-yellow hover:text-black transition-all duration-300 whitespace-nowrap px-2 py-1 rounded"
                                        >
                                            murphslife.com
                                            <svg
                                                className="ml-1 h-3 w-3"
                                                viewBox="0 0 12 12"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M1 11L11 1M11 1H1M11 1V11"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </a>
                                    </div>
                            </div>
                        </div>
                    </div>
        </section>

            {/* Auto-scroll strip – opposite colors to "Our story", OUR VALUES */}
            <Link
                href="/about"
                className="group relative block w-full cursor-pointer bg-neutral-900/10 py-5 md:py-7 overflow-hidden"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <motion.div
                    className="flex w-[max-content] whitespace-nowrap items-center"
                    style={{ x: stripX }}
                >
                    {[...Array(24)].map((_, i) => (
                        <span key={i} className="flex items-center shrink-0">
                            <span className="text-walls-yellow uppercase tracking-wider text-lg md:text-xl font-light px-8 md:px-12">
                                <span className="relative inline-block">
                                    OUR VALUES
                                    <motion.span
                                        className="absolute bottom-0 left-0 h-0.5 bg-walls-yellow origin-left"
                                        initial={false}
                                        animate={{ scaleX: isHovered ? 1 : 0 }}
                                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                        style={{ width: "100%" }}
                                    />
                                </span>
                            </span>
                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-walls-yellow shrink-0" />
                        </span>
                    ))}
                </motion.div>
            </Link>
        </>
    );
}
