"use client";

import React, { useState } from 'react';
import { useAuth } from "@/app/auth/AuthContext";
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Mail, Phone, Building2, MapPin, Search, HardDrive, User, Globe } from "lucide-react";
import { wallsToast } from "@/components/ui/walls-toast";
import { Pagination } from "@/components/ui/pagination";
import Link from 'next/link';
import Image from 'next/image';
import { LeadsSearchSidebar } from "@/components/agentCRM/agentPeople/sidebar/LeadsSearchSidebar";
import { LeadsSearchSidebarProvider, useLeadsSearchSidebar } from "@/components/agentCRM/agentPeople/sidebar/LeadsSearchSidebarContext";
import { FaLinkedin } from "react-icons/fa6";
import { motion } from "framer-motion";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  seniority: string;
  location: string;
  companyName: string;
  companyDomain: string;
  companyLocation: string;
  companySize: string;
  emailStatus: string;
  linkedinUrl: string;
  photo: string;
  organization?: {
    name: string;
    website_url?: string;
    linkedin_url?: string;
    primary_phone?: {
      number: string;
    };
    logo_url?: string;
  };
}

const ITEMS_PER_PAGE = 100; // Match Apollo's max per page for people search

interface LeadsSearchProps {
  analyticsData: any;
}

function LeadsSearchContent({ analyticsData }: LeadsSearchProps) {
  const { user } = useAuth();
  const { filters, isCollapsed, setIsCollapsed } = useLeadsSearchSidebar();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const fetchLeads = async (pageNumber: number = 1) => {
    try {
      setLoading(true);
      // Close sidebar if open
      setIsCollapsed(true);
      // Close expanded sections by dispatching a custom event
      window.dispatchEvent(new CustomEvent('closeExpandedSections'));

      // Call our API endpoint
      const response = await fetch('/api/apollo/search/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: pageNumber,
          per_page: ITEMS_PER_PAGE,
          person_titles: filters.personTitles,
          include_similar_titles: filters.includeSimilarTitles,
          person_locations: filters.personLocations,
          person_seniorities: filters.personSeniorities,
          organization_locations: filters.organizationLocations,
          q_organization_domains_list: filters.organizationDomains,
          contact_email_status: filters.contactEmailStatus,
          organization_ids: filters.organizationIds,
          organization_num_employees_ranges: filters.organizationNumEmployeesRanges,
          q_keywords: filters.keywords
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to fetch leads');
      }

      const data = await response.json();
      
      if (!data.leads || !Array.isArray(data.leads)) {
        setLeads([]);
        setTotalItems(0);
        setTotalPages(1);
      } else {
        setLeads(data.leads);
        // Use pagination info from Apollo response
        setTotalItems(data.total || 0);
        setTotalPages(data.total_pages || 1);
        setCurrentPage(pageNumber);
      }
    } catch (error) {
      wallsToast.error("Failed to fetch leads");
      setLeads([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const handlePageChange = (page: number) => {
    fetchLeads(page);
  };

  return (
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
                  onClick={() => !loading && fetchLeads(1)}
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
                      Search leads
                    </motion.span>
                  </motion.div>
                </Button>
              </motion.div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {leads.map((lead) => (
                  <Card 
                    key={lead.id} 
                    className="w-full bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 transition-all duration-300 group relative overflow-hidden hover:cursor-pointer hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
                  >
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6 flex-1">
                          {lead.photo && !imageErrors[lead.id] ? (
                            <Image
                              src={lead.photo}
                              alt={`${lead.firstName} ${lead.lastName}`}
                              width={50}
                              height={50}
                              className="rounded-full object-cover w-[50px] h-[50px] bg-white flex items-center justify-center"
                              onError={() => setImageErrors(prev => ({ ...prev, [lead.id]: true }))}
                            />
                          ) : (
                            <div className="rounded-full w-[50px] h-[50px] bg-gray-100/50 backdrop-blur-sm flex items-center justify-center">
                              <User className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 grid grid-cols-5 gap-4">
                            {/* Contact Information */}
                            <div className="col-span-2">
                              <h3 className="font-bold text-foreground flex items-center gap-3">
                                {lead.firstName} {lead.lastName}
                                {lead.linkedinUrl && (
                                  <a 
                                    href={lead.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-kenoo-light hover:text-kenoo-blue transition-colors duration-300"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(lead.linkedinUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                  >
                                    <FaLinkedin className="w-5 h-5" />
                                  </a>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground font-light">
                                {lead.title}
                              </p>
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground font-light">
                                  {lead.emailStatus || 'No email status'}
                                </p>
                                <span className="text-muted-foreground">•</span>
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground font-light">
                                  {(lead.location || lead.companyLocation || 'No location').split(',')[0]}
                                </p>
                              </div>
                            </div>

                            {/* Vertical Divider */}
                            <div className="relative col-span-3">
                              <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-black/10" />
                              
                              {/* Company Information */}
                              <div className="pl-6">
                                <div className="flex items-center gap-3">
                                  {lead.organization?.logo_url ? (
                                    <Image
                                      src={lead.organization.logo_url}
                                      alt={`${lead.organization.name || lead.companyName} logo`}
                                      width={24}
                                      height={24}
                                      className="rounded object-contain bg-white"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "/images/WBlack.svg";
                                      }}
                                    />
                                  ) : (
                                    <Building2 className="w-6 h-6 text-muted-foreground" />
                                  )}
                                  <h4 className="font-bold text-foreground truncate">
                                    {(lead.organization?.name || lead.companyName || '').length > 40 
                                      ? `${(lead.organization?.name || lead.companyName || '').slice(0, 40)}...` 
                                      : (lead.organization?.name || lead.companyName)}
                                  </h4>
                                </div>
                                {lead.organization?.website_url && (
                                  <p className="text-sm text-muted-foreground font-light truncate">
                                    {lead.organization.website_url.replace(/^https?:\/\/(www\.)?/, '')}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                  {lead.organization?.website_url && (
                                    <a
                                      href={lead.organization.website_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-muted-foreground hover:text-foreground transition-colors duration-300"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        window.open(lead.organization.website_url, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      <Globe className="w-4 h-4" />
                                    </a>
                                  )}
                                  {lead.organization?.linkedin_url && (
                                    <a
                                      href={lead.organization.linkedin_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-muted-foreground hover:text-foreground transition-colors duration-300"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        window.open(lead.organization.linkedin_url, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      <FaLinkedin className="w-4 h-4" />
                                    </a>
                                  )}
                                  {lead.organization?.primary_phone?.number && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(lead.organization.primary_phone.number);
                                        wallsToast.success('Phone number copied to clipboard');
                                      }}
                                      className="text-muted-foreground hover:text-foreground transition-colors duration-300"
                                    >
                                      <Phone className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Save Person Button */}
                        <div className="flex items-center justify-end pr-4">
                          <div 
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                const response = await fetch('/api/apollo/enrichment/people', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: lead.id,
                                    firstName: lead.firstName,
                                    lastName: lead.lastName,
                                    name: `${lead.firstName} ${lead.lastName}`,
                                    email: lead.email,
                                    linkedin: lead.linkedinUrl,
                                    domain: lead.companyDomain,
                                    userId: user?.id
                                  })
                                });
                                
                                const result = await response.json();
                                if (!response.ok) {
                                  throw new Error(result.error || 'Failed to save person');
                                }
                                wallsToast.success(result.message || 'Person saved successfully');
                              } catch (error) {
                                wallsToast.error("Failed to save person data");
                              }
                            }}
                            className="p-4 bg-blue-500/10 hover:bg-blue-500/20 backdrop-blur-sm rounded-full shadow-sm transition-all duration-200 cursor-pointer group"
                          >
                            <HardDrive className="h-[24px] w-[24px] stroke-[1.5] text-blue-500 group-hover:text-blue-600 transition-colors duration-200" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
      <LeadsSearchSidebar />
    </div>
  );
}

export default function LeadsSearch(props: LeadsSearchProps) {
  return (
    <LeadsSearchSidebarProvider>
      <LeadsSearchContent {...props} />
    </LeadsSearchSidebarProvider>
  );
} 