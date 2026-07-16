"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, Search } from "lucide-react";
import { motion } from "framer-motion";
import { wallsToast } from "@/components/ui/walls-toast";
import { Pagination } from "@/components/ui/pagination";
import Link from 'next/link';
import Image from 'next/image';
import { CompaniesSearchSidebar } from "@/components/agentCRM/agentCompanies/sidebar/CompaniesSearchSidebar";
import { CompaniesSearchSidebarProvider, useCompaniesSearchSidebar } from "@/components/agentCRM/agentCompanies/sidebar/CompaniesSearchSidebarContext";

interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  employeeCount: string;
  annualRevenue: number;
  linkedinUrl: string;
  status: string;
  notes: string;
  primaryContact: string;
  lastInteraction: string;
  createdAt: string;
  foundingYear: string;
  companyOverview: string;
  keywords: string[];
  vendorCompanyName: string;
  vendorCity: string;
  vendorState: string;
  vendorCountry: string;
  vendorZipCode: string;
  vendorPointOfContact: string;
  logo: string;
  domain: string;
  revenueFormatted: string;
  headcountGrowth: {
    sixMonth: number;
    twelveMonth?: number;
  };
  location: string;
  apolloOrganizationId?: string;
  existsInDatabase?: boolean;
  last_enriched?: string | null;
}

const ITEMS_PER_PAGE = 100;

// Cache keys and expiry time
const COMPANIES_CACHE_KEY = 'walls-companies-search-cache';
const COMPANIES_CACHE_TIMESTAMP_KEY = 'walls-companies-search-cache-timestamp';
const COMPANIES_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CompaniesSearchProps {
  analyticsData: any;
}

const extractDomain = (website: string): string => {
  try {
    // Remove http:// or https:// and www.
    const domain = website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, ''); // Remove trailing slash
    return domain;
  } catch (error) {
    return '';
  }
};

const ensureHttps = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

const formatNumber = (number: string | number | null | undefined): string => {
  if (!number) return '0';
  
  // Convert to string if it's a number
  const strNumber = typeof number === 'number' ? number.toString() : number;
  
  // Convert string to number and handle any non-numeric input
  const num = parseInt(strNumber.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return '0';
  
  // Use Intl.NumberFormat to add commas
  return new Intl.NumberFormat('en-US').format(num);
};

const formatCurrency = (amount: number | null | undefined): string => {
  if (!amount) return '$0';
  
  // For amounts less than 1 million, use regular formatting
  if (amount < 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  
  // For billions (1B+)
  if (amount >= 1000000000) {
    const billions = amount / 1000000000;
    const hasDecimal = billions % 1 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: hasDecimal ? 1 : 0,
      maximumFractionDigits: 1,
    }).format(billions) + 'B';
  }
  
  // For millions (1M+)
  const millions = amount / 1000000;
  const hasDecimal = millions % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasDecimal ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(millions) + 'M';
};

// Function to determine enrichment status
const getEnrichmentStatus = (lastEnriched?: string | null, existsInDatabase?: boolean) => {
  // If company doesn't exist in database, return 'none'
  if (!existsInDatabase || !lastEnriched) return 'none';
  
  // Handle string timestamps
  const enrichedDate = new Date(lastEnriched);
  if (isNaN(enrichedDate.getTime())) return 'none';
  
  const now = new Date();
  const monthsDiff = (now.getFullYear() - enrichedDate.getFullYear()) * 12 + now.getMonth() - enrichedDate.getMonth();
  
  if (monthsDiff <= 4) return 'fresh';
  if (monthsDiff <= 12) return 'moderate';
  return 'stale';
};

// Enrichment Status Component
const EnrichmentStatus = ({ status, website, userId }: { status: 'fresh' | 'moderate' | 'stale' | 'none'; website: string; userId?: string }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const loadingTimer = useRef<NodeJS.Timeout>();

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    };
  }, []);

  const handleEnrich = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) return; // Prevent multiple clicks while loading
    
    setIsLoading(true);
    try {
      const domain = extractDomain(website);
      if (!domain) {
        wallsToast.error("No domain found for this company");
        setIsLoading(false);
        return;
      }
      
      const response = await fetch('/api/apollo/enrichment/organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: domain,
          userId: userId
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to enrich company');
      }
      
      setIsLoading(false);
      setIsSuccess(true);
      wallsToast.success(result.message);
      
    } catch (error) {
      console.error('Error enriching company:', error);
      setIsLoading(false);
      
      // Check for specific error message about no organization data
      if (error instanceof Error && 
          (error.message === 'No organization data found' || 
           error.message.includes('404'))) {
        wallsToast.error("No public data available");
      } else {
        wallsToast.error("Failed to enrich company data");
      }
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            onClick={handleEnrich}
            className={`flex flex-col items-center gap-[2px] w-6 p-4 rounded-full hover:bg-gray-500/30 transition-all duration-200 cursor-pointer group ${isLoading ? 'animate-pulse' : ''}`}
          >
            {status === 'none' ? (
              // Show 0 bars (all hidden/gray) when company doesn't exist, with subtle glow animation
              <>
                <div className="w-5 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-1" />
                <div className="w-4 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-2" />
                <div className="w-3 h-[3px] rounded-sm bg-gray-300 opacity-30 glow-bar-3" />
              </>
            ) : (
              // Show bars based on status when company exists
              <>
                <div
                  className={`w-5 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-500' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-4 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-400 delay-100' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' :
                    status === 'moderate' ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`w-3 h-[3px] rounded-sm transition-all duration-300 ${
                    isSuccess ? 'bg-kenoo-sky/60' :
                    isLoading ? 'bg-blue-300 delay-200' :
                    status === 'fresh' ? 'bg-kenoo-sky/60' :
                    status === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          className="font-light" 
          side="top"
          sideOffset={5}
        >
          {isLoading ? 'Enriching...' : isSuccess ? 'Enriched!' : status === 'none' ? 'Add to database' : 'Enrich'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

function CompaniesSearchContent({ analyticsData }: CompaniesSearchProps) {
  const { user } = useAuth();
  const { filters, isCollapsed, setIsCollapsed } = useCompaniesSearchSidebar();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [hasSearched, setHasSearched] = useState(false);

  const fetchCompanies = async (pageNumber: number = 1) => {
    try {
      setLoading(true);
      // Close sidebar if open
      setIsCollapsed(true);
      // Close expanded sections by dispatching a custom event
      window.dispatchEvent(new CustomEvent('closeExpandedSections'));

      // Build Apollo.io API filters
      const apolloFilters: any = {};
      
      // Only add filters if they have values
      if (filters.industry && filters.industry.trim() !== '') {
        apolloFilters.q_organization_keyword_tags = [filters.industry];
      }
      
      if (filters.companyName && filters.companyName.trim() !== '') {
        apolloFilters.q_organization_name = filters.companyName;
      }
      
      if (filters.companySize && filters.companySize.length > 0) {
        apolloFilters.organization_num_employees_ranges = filters.companySize;
      }
      
      if (filters.revenueMin || filters.revenueMax) {
        apolloFilters.revenue_range = {};
        if (filters.revenueMin && filters.revenueMin.trim() !== '') {
          apolloFilters.revenue_range.min = parseInt(filters.revenueMin);
        }
        if (filters.revenueMax && filters.revenueMax.trim() !== '') {
          apolloFilters.revenue_range.max = parseInt(filters.revenueMax);
        }
      }
      
      if (filters.location && filters.location.trim() !== '') {
        apolloFilters.organization_locations = [filters.location];
      }

      // Call our API endpoint
      const response = await fetch('/api/apollo/search/organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: pageNumber,
          per_page: ITEMS_PER_PAGE,
          filters: apolloFilters
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }

      const data = await response.json();
      
      if (!data.companies || !Array.isArray(data.companies)) {
        setCompanies([]);
        setTotalItems(0);
        setTotalPages(1);
      } else {
        setCompanies(data.companies);
        setTotalItems(data.total || 0);
        setTotalPages(Math.max(1, Math.ceil((data.total || 0) / ITEMS_PER_PAGE)));
        setCurrentPage(pageNumber);
      }
    } catch (error) {
      setCompanies([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  // Don't automatically fetch on filter changes
  // useEffect(() => {
  //   fetchCompanies(1);
  // }, [filters]);

  const handlePageChange = (page: number) => {
    fetchCompanies(page);
  };

  const handleImageError = (companyId: string, isClearbit: boolean = false, domain: string = '') => {
    setImageErrors(prev => ({
      ...prev,
      [companyId]: true,
      [`clearbit-${domain}`]: isClearbit ? true : prev[`clearbit-${domain}`]
    }));
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes glow-bar-1 {
          0%, 100% { background-color: rgba(156, 163, 175, 0.3); }
          5% { background-color: rgba(59, 130, 246, 0.6); }
          10% { background-color: rgba(59, 130, 246, 0.4); }
          15% { background-color: rgba(156, 163, 175, 0.3); }
        }
        @keyframes glow-bar-2 {
          0%, 100% { background-color: rgba(156, 163, 175, 0.3); }
          20% { background-color: rgba(59, 130, 246, 0.6); }
          25% { background-color: rgba(59, 130, 246, 0.4); }
          30% { background-color: rgba(156, 163, 175, 0.3); }
        }
        @keyframes glow-bar-3 {
          0%, 100% { background-color: rgba(156, 163, 175, 0.3); }
          35% { background-color: rgba(59, 130, 246, 0.6); }
          40% { background-color: rgba(59, 130, 246, 0.4); }
          45% { background-color: rgba(156, 163, 175, 0.3); }
        }
        .glow-bar-1 {
          animation: glow-bar-1 6s ease-in-out infinite;
        }
        .glow-bar-2 {
          animation: glow-bar-2 6s ease-in-out infinite;
        }
        .glow-bar-3 {
          animation: glow-bar-3 6s ease-in-out infinite;
        }
      `}} />
      <div className="flex min-h-screen">
      <div className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="max-w-[90%] mx-auto mt-4 px-4">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center min-h-[80vh]">
              <div className="relative w-[150px] h-[150px] mb-8">
                <Image
                  src="/images/WBlack.svg"
                  alt="WALLS Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <motion.div
                initial={false}
                animate={
                  loading
                    ? { width: 72, borderRadius: "9999px" }
                    : { width: "auto", borderRadius: "9999px" }
                }
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="inline-flex overflow-hidden"
              >
                <Button
                  onClick={() => !loading && fetchCompanies(1)}
                  disabled={loading}
                  className={`font-normal text-md px-6 py-6 rounded-full transition-all duration-300 relative group shadow-inner border flex items-center justify-center
                    ${loading
                      ? "bg-transparent border-transparent shadow-none"
                      : "bg-kenoo-yellow/50 hover:bg-kenoo-yellow/90 border-kenoo-yellow/50 text-neutral-700"
                    }`}
                >
                  <motion.div
                    className="flex items-center justify-center gap-2"
                    initial={false}
                    animate={loading ? { gap: 0 } : { gap: 8 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    {/* Icon */}
                    <motion.div
                      animate={loading ? { scale: 1.1 } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="relative flex items-center justify-center"
                    >
                      <Search
                        className={`h-5 w-5 ${loading ? "text-neutral-600" : "text-neutral-400"}`}
                      />

                      {/* Circular loader border only appears during loading */}
                      {loading && (
                        <motion.div
                          className="absolute inset-[-10px] rounded-full border-2 border-transparent"
                          style={{
                            background: `conic-gradient(from 0deg, transparent, #F59E0B, transparent)`,
                            WebkitMask:
                              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            WebkitMaskComposite: "xor",
                            maskComposite: "exclude",
                          }}
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        />
                      )}
                    </motion.div>

                    {/* Text smoothly fades out as width animates */}
                    <motion.span
                      initial={false}
                      animate={loading ? { opacity: 0, width: 0 } : { opacity: 1, width: "auto" }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="whitespace-nowrap"
                    >
                      Search companies
                    </motion.span>
                  </motion.div>
                </Button>
              </motion.div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {companies.map((company) => {
                  const domain = extractDomain(company.website);
                  const clearbitFailed = imageErrors[`clearbit-${domain}`];
                  
                  return (
                    <Link href={`/agents/crm/edit-companies/${company.id}`} key={company.id} className="block">
                      <Card className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 transition-all duration-300 group relative overflow-visible hover:cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]">
                        <CardContent className="p-4 relative z-10 overflow-visible">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6 flex-1">
                              <Image
                                src={
                                  !imageErrors[company.id] && company.logo
                                    ? company.logo
                                    : (!clearbitFailed && company.website)
                                    ? `https://logo.clearbit.com/${domain}`
                                    : "/images/BlankCompany.png"
                                }
                                alt={`${company.name} logo`}
                                width={50}
                                height={50}
                                className="rounded-full object-contain w-[50px] h-[50px] bg-white flex items-center justify-center"
                                onError={() => {
                                  if (!imageErrors[company.id] && company.logo) {
                                    // If company logo failed
                                    handleImageError(company.id);
                                  } else if (!clearbitFailed && company.website) {
                                    // If Clearbit logo failed
                                    handleImageError(company.id, true, domain);
                                  }
                                }}
                              />
                              <div className="flex-1 grid grid-cols-6 gap-4">
                                <div className="col-span-2">
                                  <h3 className="font-bold text-foreground">
                                    {company.name || 'Unnamed Company'}
                                  </h3>
                                  <p className="text-sm text-muted-foreground font-light">
                                    Founded {company.foundingYear || 'N/A'}
                                  </p>
                                                                      {company.domain && (
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        window.open(ensureHttps(company.website), '_blank', 'noopener,noreferrer');
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-800 font-light cursor-pointer bg-transparent border-0 p-0"
                                    >
                                      {company.domain}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="border-r border-gray-300 -ml-16 mr-4 h-4" />
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <span className="text-muted-foreground font-light">
                                      Employee Growth
                                    </span>
                                    {company.headcountGrowth?.sixMonth !== undefined && (
                                      <p className={`text-xs font-light ${company.headcountGrowth.sixMonth > 0 ? 'text-green-600' : company.headcountGrowth.sixMonth < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                        {(company.headcountGrowth.sixMonth * 100).toFixed(1)}% (6m)
                                      </p>
                                    )}
                                    {company.headcountGrowth?.twelveMonth !== undefined && (
                                      <p className={`text-xs font-light ${company.headcountGrowth.twelveMonth > 0 ? 'text-green-600' : company.headcountGrowth.twelveMonth < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                        {(company.headcountGrowth.twelveMonth * 100).toFixed(1)}% (12m)
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-center">
                                  <div>
                                    <p className="text-sm font-light text-foreground">
                                      {company.revenueFormatted || formatCurrency(company.annualRevenue)}
                                    </p>
                                    <p className="text-sm text-muted-foreground font-light">
                                      Annual Revenue
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-center">
                                  <div>
                                    <p className="text-sm font-light text-foreground">
                                      {company.phone || 'No phone available'}
                                    </p>
                                    <p className="text-sm text-muted-foreground font-light">
                                      Phone
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-end relative z-50">
                                  <EnrichmentStatus 
                                    status={getEnrichmentStatus(company.last_enriched, company.existsInDatabase)} 
                                    website={company.website || company.domain || ''}
                                    userId={user?.id}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <CompaniesSearchSidebar />
    </div>
    </>
  );
}

export default function CompaniesSearch(props: CompaniesSearchProps) {
  return (
    <CompaniesSearchSidebarProvider>
      <CompaniesSearchContent {...props} />
    </CompaniesSearchSidebarProvider>
  );
} 