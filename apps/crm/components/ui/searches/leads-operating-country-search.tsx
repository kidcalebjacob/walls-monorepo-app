import { useEffect, useState } from "react";
import { collection, getDocs, getFirestore, orderBy, query } from "firebase/firestore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/types/country.types";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import * as React from "react";

interface LeadOperatingCountrySelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  className?: string;
}

interface OperatingCountry {
  id: string;
  name: string;
  countryCode: string;
  region?: string;
}

interface GroupedCountries {
  [key: string]: OperatingCountry[];
}

export function LeadOperatingCountrySelect({ value = [], onValueChange, className }: LeadOperatingCountrySelectProps) {
  const [countries, setCountries] = useState<OperatingCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRegions, setExpandedRegions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setLoading(true);
        const db = getFirestore();
        const countriesRef = collection(db, "typesLeadsOperatingCountry");
        const q = query(countriesRef, orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        
        const countriesData: OperatingCountry[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          countriesData.push({
            id: doc.id,
            name: data.name,
            countryCode: data.countryCode || getCountryCode(data.name),
            region: data.region || "Other",
          });
        });
        
        setCountries(countriesData);
      } catch (error) {
        console.error("Error fetching countries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCountries();
  }, []);

  const groupedCountries = countries.reduce<GroupedCountries>((acc, country) => {
    const region = country.region || "Other";
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region].push(country);
    return acc;
  }, {});

  const toggleRegion = (e: React.MouseEvent, region: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedRegions(prev => 
      prev.includes(region) 
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  const handleSelect = (countryName: string) => {
    if (value.includes(countryName)) {
      const newValue = value.filter(v => v !== countryName);
      // Sort the array by region before saving
      const sortedValue = sortCountriesByRegion(newValue);
      onValueChange(sortedValue);
    } else {
      const newValue = [...value, countryName];
      // Sort the array by region before saving
      const sortedValue = sortCountriesByRegion(newValue);
      onValueChange(sortedValue);
    }
  };

  const handleRegionSelect = (region: string, regionCountries: OperatingCountry[]) => {
    const countryNames = regionCountries.map(c => c.name);
    const allSelected = countryNames.every(name => value.includes(name));
    
    if (allSelected) {
      // If all countries in the region are selected, unselect them all
      const newValue = value.filter(v => !countryNames.includes(v));
      // Sort the array by region before saving
      const sortedValue = sortCountriesByRegion(newValue);
      onValueChange(sortedValue);
    } else {
      // If not all selected, select all countries in the region
      const newValue = [...value];
      countryNames.forEach(name => {
        if (!newValue.includes(name)) {
          newValue.push(name);
        }
      });
      // Sort the array by region before saving
      const sortedValue = sortCountriesByRegion(newValue);
      onValueChange(sortedValue);
    }
  };

  const sortCountriesByRegion = (countryNames: string[]): string[] => {
    // Create a map of countries with their regions
    const countryRegionMap = new Map(
      countries.map(country => [country.name, country.region || "Other"])
    );

    // Group countries by region
    const groupedByRegion = countryNames.reduce<Record<string, string[]>>((acc, countryName) => {
      const region = countryRegionMap.get(countryName) || "Other";
      if (!acc[region]) {
        acc[region] = [];
      }
      acc[region].push(countryName);
      return acc;
    }, {});

    // Sort regions alphabetically and then countries within each region
    return Object.entries(groupedByRegion)
      .sort(([regionA], [regionB]) => regionA.localeCompare(regionB))
      .flatMap(([_, countryNames]) => 
        countryNames.sort((a, b) => a.localeCompare(b))
      );
  };

  const getRegionSelectionState = (region: string, regionCountries: OperatingCountry[]) => {
    const countryNames = regionCountries.map(c => c.name);
    const selectedCount = countryNames.filter(name => value.includes(name)).length;
    
    if (selectedCount === 0) return null;
    if (selectedCount === countryNames.length) return "all";
    return selectedCount;
  };

  const removeCountry = (e: React.MouseEvent, countryToRemove: string) => {
    e.preventDefault();
    e.stopPropagation();
    const newValue = value.filter(country => country !== countryToRemove);
    // Sort the array by region before saving
    const sortedValue = sortCountriesByRegion(newValue);
    onValueChange(sortedValue);
  };

  const getSelectedCountryData = (countryName: string) => {
    return countries.find(c => c.name === countryName);
  };

  // Sort the initial value by region
  useEffect(() => {
    if (countries.length > 0 && value.length > 0) {
      const sortedValue = sortCountriesByRegion(value);
      if (JSON.stringify(sortedValue) !== JSON.stringify(value)) {
        onValueChange(sortedValue);
      }
    }
  }, [countries]);

  return (
    <Select 
      value={value.length > 0 ? value[0] : undefined}
      onValueChange={() => {}}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className={className} onClick={() => setOpen(true)}>
        <SelectValue placeholder={loading ? "Loading countries..." : "Select countries"}>
          <div className="flex flex-wrap gap-1 max-w-full">
            {value.length === 0 ? (
              <span className="text-muted-foreground">Select countries</span>
            ) : (
              value.map(countryName => {
                const country = getSelectedCountryData(countryName);
                return (
                  <Badge 
                    key={countryName}
                    variant="secondary" 
                    className="rounded-full text-xs py-0 px-2"
                  >
                    <div className="flex items-center gap-1">
                      {country && (
                        <div className="relative w-3 h-3 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center">
                          <ReactCountryFlag
                            countryCode={country.countryCode}
                            svg
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            title={country.name}
                          />
                        </div>
                      )}
                      <span className="truncate max-w-[100px]">{countryName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-3 p-0 hover:bg-transparent"
                        onClick={(e) => removeCountry(e, countryName)}
                      >
                        <X className="h-2 w-2" />
                      </Button>
                    </div>
                  </Badge>
                );
              })
            )}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <ScrollArea className="h-[300px]">
          <SelectItem 
            value="none" 
            className="text-muted-foreground"
            onClick={() => {
              onValueChange([]);
              setOpen(false);
            }}
          >
            -- None --
          </SelectItem>
          
          {Object.entries(groupedCountries).sort(([a], [b]) => a.localeCompare(b)).map(([region, regionCountries]) => (
            <div key={region} className="relative">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => toggleRegion(e, region)}
                  className="flex-grow justify-start gap-2 rounded-[20px] h-9 px-4 py-2 text-sm group"
                >
                  {expandedRegions.includes(region) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const selectionState = getRegionSelectionState(region, regionCountries);
                      if (selectionState) {
                        return (
                          <div 
                            className="w-5 h-5 rounded-full bg-kenoo-yellow flex items-center justify-center cursor-pointer hover:bg-kenoo-yellow/90"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegionSelect(region, regionCountries);
                            }}
                          >
                            {selectionState === "all" ? (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                className="w-3 h-3 text-black"
                              >
                                <path
                                  d="M20 6L9 17L4 12"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <span className="text-xs text-black font-medium">
                                {selectionState}
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <span>{region}</span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {regionCountries.length}
                  </span>
                </Button>
              </div>
              
              {expandedRegions.includes(region) && (
                <div className="pl-4">
                  {regionCountries.map((country) => (
                    <div 
                      key={country.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-[20px] hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSelect(country.name)}
                    >
                      <div className="relative w-4 h-4 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center">
                        <ReactCountryFlag
                          countryCode={country.countryCode}
                          svg
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          title={country.name}
                        />
                        {value.includes(country.name) && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              className="w-3 h-3 text-white"
                            >
                              <path
                                d="M20 6L9 17L4 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span>{country.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
} 