// app/components/agent-mail/email-composer/components/recipients/recipient-search-results.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Command, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";

interface SearchResult {
  name: string;
  email: string;
  type: 'contact' | 'lead' | 'scouter';
  company?: string;
  companyWebsite?: string;
}

interface RecipientSearchResultsProps {
  results: SearchResult[];
  onSelect: (email: string) => void;
  onClose: () => void;
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

export function RecipientSearchResults({ 
  results, 
  onSelect, 
  onClose 
}: RecipientSearchResultsProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (resultId: string) => {
    const img = document.querySelector(`[data-company-id="${resultId}"]`) as HTMLImageElement;
    if (!img) return;

    const retryCount = parseInt(img.dataset.retryCount || '0');
    if (retryCount < 2) {  // Try up to 2 times
      img.dataset.retryCount = (retryCount + 1).toString();
      img.src = img.src; // Retry loading the same URL
    } else {
      setImageErrors(prev => ({
        ...prev,
        [resultId]: true
      }));
    }
  };

  if (results.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-50 px-4">
      <div className="bg-white/80 backdrop-blur-sm border rounded-xl shadow-lg mt-1">
        <Command className="w-full">
          <CommandList>
            <div className="max-h-[300px] overflow-y-auto p-2">
              <CommandGroup>
                {results.map((result, index) => (
                  <CommandItem
                    key={index}
                    onSelect={() => {
                      onSelect(result.email);
                      onClose();
                    }}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100/50 rounded-lg transition-colors duration-150 text-[13px] font-[Arial]"
                  >
                    <Image
                      src={
                        !imageErrors[index.toString()] && result.companyWebsite
                          ? `https://logo.clearbit.com/${extractDomain(result.companyWebsite)}`
                          : "/images/BlankCompany.png"
                      }
                      alt={`${result.company || 'Company'} logo`}
                      width={32}
                      height={32}
                      className="rounded-full"
                      data-company-id={index.toString()}
                      data-retry-count="0"
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
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}