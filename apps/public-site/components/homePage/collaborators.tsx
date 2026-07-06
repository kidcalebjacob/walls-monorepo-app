"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { createClient } from "@walls/supabase/client";

interface CollaboratorsProps {
    isMobileView: boolean;
}

interface CompanyLogo {
    id: string;
    logo_url: string;
    company_name: string;
}

export function Collaborators({ isMobileView }: CollaboratorsProps) {
    const [companies, setCompanies] = useState<CompanyLogo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                setLoading(true);
                const supabase = createClient();

                const { data, error } = await supabase
                    .from('collab_case_studies')
                    .select('id, logo_url, company_name')
                    .order('company_name');

                if (error) {
                    console.error('Error fetching companies:', error);
                    return;
                }

                if (data) {
                    setCompanies(data);
                }
            } catch (error) {
                console.error('Error fetching companies:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCompanies();
    }, []);

    if (loading) {
        return (
            <section className={cn(
                "relative w-full h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 overflow-hidden px-4 sm:px-8 md:px-16 lg:px-24"
            )}>
                <div className="flex flex-col h-full relative z-10">
                    {/* Trusted By Header */}
                    <div className="pt-16 md:pt-20 text-center">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-3xl md:text-2xl lg:text-3xl font-serif tracking-tighter text-black/80"
                        >
                            Trusted by
                        </motion.h2>
                    </div>

                    {/* Loading Skeleton Grid */}
                    <div className="flex justify-center pt-6 md:pt-8 lg:pt-12">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 sm:gap-8 md:gap-10 lg:gap-16 w-full max-w-7xl">
                            {Array.from({ length: 24 }).map((_, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.4, delay: index * 0.05 }}
                                    className="w-20 h-20 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 relative"
                                >
                                    <div className="w-full h-full bg-gray-200 rounded-lg animate-pulse" />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className={cn(
            "relative w-full min-h-[120vh] bg-gradient-to-b from-gray-50 via-white to-gray-50 overflow-hidden px-4 sm:px-8 md:px-16 lg:px-24"
        )}>
            <div className="flex flex-col min-h-[120vh] relative z-10">
                {/* Trusted By Header */}
                <div className="pt-16 md:pt-20 text-center">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-3xl md:text-2xl lg:text-3xl font-serif tracking-tighter text-black/80"
                    >
                        Trusted by
                    </motion.h2>
                </div>

                {/* Company Logos Grid */}
                <div className="flex justify-center pt-6 md:pt-8 lg:pt-12">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 sm:gap-8 md:gap-10 lg:gap-16 w-full max-w-7xl"
                    >
                        {companies.map((company, index) => (
                            <motion.div
                                key={company.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4, delay: index * 0.05 }}
                                className="w-20 h-20 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 relative group"
                            >
                                <div className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-2">
                                    <Image
                                        src={company.logo_url || '/images/placeholder-logo.svg'}
                                        alt={`${company.company_name} Logo`}
                                        fill
                                        className="object-contain opacity-60 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0 transition-all"
                                        sizes="(max-width: 640px) 80px, (max-width: 768px) 64px, (max-width: 1024px) 80px, 96px"
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
} 