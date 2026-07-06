"use client";

import { useEffect, useState, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { PublicHeader } from "@/components/public-header";
import Footer from "@/components/footer";
import { Hero } from "./hero";
import { Services } from "./services";

import FooterContainer from "@/components/footer-container";
import { Collaborators } from "./collaborators";
import { CaseStudies } from "./case-studies";
import { StatementSection } from "./statement-section";
import { Values } from "./values";
import { ValuesMobile } from "./values-mobile";
import { CareersSection } from "./careers-section";
import { ScrollReveal } from "@walls/ui/scroll-reveal";
import { motion, useScroll, useTransform } from "framer-motion";

export default function HomePage() {
    const { ref: firstSectionRef, inView: firstSectionInView } = useInView({
        threshold: 0,
        initialInView: true,
    });
    const heroSectionRef = useRef<HTMLDivElement>(null);
    const servicesValuesWrapperRef = useRef<HTMLDivElement>(null);

    // Scroll progress for expanding circle – full width by the time values section is in view
    const { scrollYProgress: servicesValuesProgress } = useScroll({
        target: servicesValuesWrapperRef,
        offset: ["start 0.85", "end end"],
    });
    const scaleCircle = useTransform(servicesValuesProgress, [0, 0.5, 1], [0.5, 0.85, 2.6]);
    const { ref: heroInViewRef, inView: heroSectionInView } = useInView({
        threshold: 0.2,
    });

    // Combine refs
    const heroRef = (node: HTMLDivElement) => {
        heroSectionRef.current = node;
        if (heroInViewRef) {
            // @ts-ignore - we know this is a valid ref function
            heroInViewRef(node);
        }
    };
    const { ref: thirdSectionRef, inView: thirdSectionInView } = useInView({
        threshold: 0.5,
    });
    const [isMobileView, setIsMobileView] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobileView(window.innerWidth < 768);
        };
        
        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Scroll progress for hero section animation
    const { scrollYProgress } = useScroll({
        target: heroSectionRef,
        offset: ["start start", "end start"] // Back to end start for full section scroll
    });

    const borderRadius = useTransform(
        scrollYProgress,
        [0, 1],
        isMobileView ? [0, 0] : [0, 500] // No transform for mobile
    );

    return (
        <main 
            className="relative w-full text-foreground overflow-x-hidden"
        >
            <PublicHeader inView={firstSectionInView} />
            
            <div ref={firstSectionRef} className="absolute top-0 h-1 w-full" />

            {/* Hero Section - Full Screen with Scroll Lock */}
            {/* Container for scroll progress measurement */}
            <motion.div 
                ref={heroRef} 
                className="min-h-screen overflow-hidden"
                style={{
                    borderBottomLeftRadius: borderRadius,
                    borderBottomRightRadius: borderRadius,
                    backgroundColor: "#e2f85c",
                }}
            >
                <Hero isMobileView={isMobileView} inView={heroSectionInView} />
            </motion.div>

            {/* Statement Section - outside gray wrapper so parent doesn't affect blend mode */}
            <ScrollReveal direction="up" amount={0.1}>
                <StatementSection isMobileView={isMobileView} />
            </ScrollReveal>

            {/* Case Studies Section - above services (no ScrollReveal so header text has no load-in animation) */}
            <CaseStudies isMobileView={isMobileView} />

            {/* Services + Values wrapper: expanding circle behind both, grows into services (not into careers); bg matches case-studies */}
            <div ref={servicesValuesWrapperRef} className="relative bg-gray-50 overflow-x-clip">
                {/* Expanding circle layer – behind Services and Values, anchored at bottom (values area) */}
                <div className="absolute inset-0 z-0 flex items-end justify-center origin-bottom pointer-events-none overflow-hidden">
                    <motion.div
                        className="w-[800px] h-[800px] bg-neutral-800 rounded-full shrink-0"
                        style={{ scale: scaleCircle }}
                    />
                </div>
                <div className="relative z-10">
                    <Services isMobileView={isMobileView} />
                    {isMobileView ? (
                        <ValuesMobile isMobileView={isMobileView} />
                    ) : (
                        <Values isMobileView={isMobileView} />
                    )}
                </div>
            </div>

            {/* Collaborators Section - above careers */}
            <ScrollReveal direction="up" delay={0.05} amount={0.1}>
                <Collaborators isMobileView={isMobileView} />
            </ScrollReveal>

            {/* Careers Section - underneath collaborators */}
            <CareersSection isMobileView={isMobileView} />

            {/* Content Sections - Normal Scrolling */}
            <div className="relative bg-gray-50">
                {/* Footer Section */}
                <div ref={thirdSectionRef}>
                    <FooterContainer />
                </div>
            </div>

            <Footer inView={thirdSectionInView} />
        </main>
    );
} 