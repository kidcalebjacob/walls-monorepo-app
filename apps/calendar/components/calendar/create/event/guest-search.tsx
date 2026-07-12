"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from "@walls/supabase/client";
import { useAuth } from "@walls/auth";

interface SearchResult {
  name: string;
  email: string;
  type: 'contact' | 'lead' | 'scouter';
  company?: string;
  companyWebsite?: string;
}

interface GuestSearchProps {
  onSelect: (email: string) => void;
  currentInput: string;
}

const extractDomain = (website: string): string | null => {
  try {
    if (!website) return null;

    let domain = website
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .split('/')[0];

    if (!domain.includes('.')) return null;
    if (domain.length < 3) return null;

    domain = domain.replace(/[^a-zA-Z0-9.-]/g, '');

    return domain;
  } catch (error) {
    console.error('Error extracting domain:', error);
    return null;
  }
};

const getLogoUrl = (website: string | undefined): string => {
  return '/images/BlankCompany.png';
};

export function GuestSearch({ onSelect, currentInput }: GuestSearchProps) {
  const { user } = useAuth();
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const searchRecipients = async () => {
      if (!currentInput.trim() || !user) {
        setShowResults(false);
        return;
      }

      try {
        const supabase = createClient();
        const searchTerm = currentInput.toLowerCase();

        // Search contacts
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('*');
        
        const contactResults = await Promise.all((contactsData || [])
          .map(async (item: any) => {
            let companyWebsite = '';

            if (item.company) {
              const { data: companyData } = await supabase
                .from('companies')
                .select('website')
                .eq('name', item.company)
                .limit(1)
                .maybeSingle();

              if (companyData) {
                companyWebsite = companyData.website || '';
              }
            }

            return {
              name: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
              email: item.email || '',
              type: 'contact' as const,
              company: item.company || '',
              companyWebsite
            };
          }));

        // Search leads
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*');
        
        const leadResults = await Promise.all((leadsData || [])
          .map(async (item: any) => {
            let companyWebsite = '';

            if (item.company) {
              const { data: companyData } = await supabase
                .from('companies')
                .select('website')
                .eq('name', item.company)
                .limit(1)
                .maybeSingle();

              if (companyData) {
                companyWebsite = companyData.website || '';
              }
            }

            return {
              name: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
              email: item.email || '',
              type: 'lead' as const,
              company: item.company || '',
              companyWebsite
            };
          }));

        // Search scouters
        const { data: scoutersData } = await supabase
          .from('scouter')
          .select('*')
          .eq('manager', user.id);
        
        const scouterResults = (scoutersData || [])
          .map((item: any) => {
            return {
              name: item.creator_alias || '',
              email: item.personal_email || '',
              type: 'scouter' as const,
              company: item.agency_status || '',
              companyWebsite: ''
            };
          })
          .filter(result => result.email);

        // Combine and filter all results
        const filteredResults = [...contactResults, ...leadResults, ...scouterResults]
          .filter(result => result.email && (
            result.name.toLowerCase().includes(searchTerm) ||
            result.email.toLowerCase().includes(searchTerm)
          ))
          .sort((a, b) => a.name.localeCompare(b.name));

        setSearchResults(filteredResults);
        setShowResults(filteredResults.length > 0);
      } catch (error) {
        console.error('Error searching recipients:', error);
      }
    };

    const debounceTimer = setTimeout(searchRecipients, 300);
    return () => clearTimeout(debounceTimer);
  }, [currentInput, user]);

  const handleImageError = (resultId: string) => {
    setImageErrors(prev => ({
      ...prev,
      [resultId]: true
    }));
  };

  if (!showResults) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-50 px-4">
      <div className="shadow-md mt-1 rounded-xl overflow-hidden">
        <div className="bg-white/95 backdrop-blur-sm">
          <div className="max-h-[300px] overflow-y-auto p-2">
            <div>
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  onClick={() => {
                    onSelect(result.email);
                    setShowResults(false);
                  }}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100/50 rounded-lg transition-colors duration-150 text-[13px] font-[Arial]"
                >
                  <Image
                    src={
                      !imageErrors[index.toString()] && result.companyWebsite
                        ? getLogoUrl(result.companyWebsite)
                        : "/images/BlankCompany.png"
                    }
                    alt={`${result.company || 'Company'} logo`}
                    width={32}
                    height={32}
                    className="rounded-full"
                    data-company-id={index.toString()}
                    onError={() => handleImageError(index.toString())}
                  />
                  <div className="flex flex-col flex-1">
                    <span className="font-medium text-base">{result.name}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {result.email}
                      </span>
                      {result.company && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {result.company}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full capitalize">
                    {result.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 