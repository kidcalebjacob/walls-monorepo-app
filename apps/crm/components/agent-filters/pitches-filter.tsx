"use client";

import { X, Filter, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Image from "next/image";

interface UserData {
  id: string;
  displayName: string;
  userType: string;
  photoURL?: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
}

interface Company {
  id: string;
  name: string;
  website: string;
}

interface Creator {
  id: string;
  creatorAlias: string;
  profilePictureUrl: string;
}

interface PitchesFilterProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    searchTerm: string;
    pitchedBy: string;
    pitchedTo: string;
    company: string;
    creator: string;
  };
  onFilterChange: (filterKey: string, value: string) => void;
}

export function PitchesFilter({
  isOpen,
  onClose,
  filters,
  onFilterChange,
}: PitchesFilterProps) {
  const [agents, setAgents] = useState<UserData[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState({
    agents: true,
    contacts: true,
    companies: true,
    creators: true,
  });
  const [searchContact, setSearchContact] = useState("");
  const [searchCompany, setSearchCompany] = useState("");
  const [searchCreator, setSearchCreator] = useState("");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const extractDomain = (website: string): string => {
    try {
      return website
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
    } catch (error) {
      return '';
    }
  };

  const handleImageError = (companyId: string) => {
    setImageErrors(prev => ({
      ...prev,
      [companyId]: true
    }));
  };

  // Fetch agents (users with Agent role)
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const db = getFirestore();
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("userType", "in", ["Super Admin", "Admin", "Agent"])
        );
        
        const querySnapshot = await getDocs(q);
        const agentsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().displayName || doc.data().name || "Unknown User",
          userType: doc.data().userType,
          photoURL: doc.data().photoURL || ""
        }));
        
        agentsList.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAgents(agentsList);
      } catch (error) {
        console.error("Error fetching agents:", error);
      } finally {
        setLoading(prev => ({ ...prev, agents: false }));
      }
    };

    fetchAgents();
  }, []);

  // Fetch contacts and leads
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const db = getFirestore();
        const contactsRef = collection(db, "contacts");
        const leadsRef = collection(db, "leads");
        
        const [contactsSnapshot, leadsSnapshot] = await Promise.all([
          getDocs(contactsRef),
          getDocs(leadsRef)
        ]);

        const allContacts = [
          ...contactsSnapshot.docs.map(doc => ({
            id: doc.id,
            firstName: doc.data().firstName || "",
            lastName: doc.data().lastName || "",
            email: doc.data().email || "",
            company: doc.data().company || "",
          })),
          ...leadsSnapshot.docs.map(doc => ({
            id: doc.id,
            firstName: doc.data().firstName || "",
            lastName: doc.data().lastName || "",
            email: doc.data().email || "",
            company: doc.data().company || "",
          }))
        ] as Contact[];

        // Sort by name
        allContacts.sort((a, b) => 
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        );

        setContacts(allContacts);
      } catch (error) {
        console.error("Error fetching contacts:", error);
      } finally {
        setLoading(prev => ({ ...prev, contacts: false }));
      }
    };

    fetchContacts();
  }, []);

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const db = getFirestore();
        const companiesRef = collection(db, "companies");
        const snapshot = await getDocs(companiesRef);
        
        const companiesList = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          website: doc.data().website || "",
        }));
        
        companiesList.sort((a, b) => a.name.localeCompare(b.name));
        setCompanies(companiesList);
      } catch (error) {
        console.error("Error fetching companies:", error);
      } finally {
        setLoading(prev => ({ ...prev, companies: false }));
      }
    };

    fetchCompanies();
  }, []);

  // Fetch creators
  useEffect(() => {
    const fetchCreators = async () => {
      try {
        const db = getFirestore();
        const rosterRef = collection(db, "roster");
        const snapshot = await getDocs(rosterRef);
        
        const creatorsList = snapshot.docs.map(doc => ({
          id: doc.id,
          creatorAlias: doc.data().creatorAlias,
          profilePictureUrl: doc.data().profilePictureUrl || "",
        }));
        
        creatorsList.sort((a, b) => a.creatorAlias.localeCompare(b.creatorAlias));
        setCreators(creatorsList);
      } catch (error) {
        console.error("Error fetching creators:", error);
      } finally {
        setLoading(prev => ({ ...prev, creators: false }));
      }
    };

    fetchCreators();
  }, []);

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    const searchLower = searchContact.toLowerCase();
    return fullName.includes(searchLower) || contact.email.toLowerCase().includes(searchLower);
  });

  // Filter companies based on search
  const filteredCompanies = companies.filter(company => {
    const searchLower = searchCompany.toLowerCase();
    return company.name.toLowerCase().includes(searchLower) || company.website.toLowerCase().includes(searchLower);
  });

  // Filter creators based on search
  const filteredCreators = creators.filter(creator => {
    const searchLower = searchCreator.toLowerCase();
    return creator.creatorAlias.toLowerCase().includes(searchLower);
  });

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 w-80 bg-white/80 backdrop-blur-xl border-r border-white/30 transform transition-transform duration-200 ease-in-out rounded-none shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "z-[110]"
      )}
    >
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-black/10 flex justify-between items-center bg-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-black" strokeWidth={1.5} />
            <h2 className="text-lg font-semibold text-black">Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 cursor-pointer transition-all duration-300 hover:opacity-70"
          >
            <X className="h-[18px] w-[18px] text-black" strokeWidth={1.5} />
          </button>
        </div>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Pitched By Filter */}
            <div>
              <Select
                value={filters.pitchedBy}
                onValueChange={(value) => onFilterChange("pitchedBy", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Pitched By:</span>
                    <SelectValue placeholder={loading.agents ? "Loading…" : "Select person"}>
                      {filters.pitchedBy && (
                        <div className="flex items-center gap-2">
                          <div className="relative w-6 h-6 rounded-full overflow-hidden">
                            <Image
                              src={agents.find(a => a.id === filters.pitchedBy)?.photoURL || "/WALLS-Logo.png"}
                              alt="Agent photo"
                              width={24}
                              height={24}
                              className="object-cover"
                            />
                          </div>
                          {agents.find(a => a.id === filters.pitchedBy)?.displayName}
                        </div>
                      )}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all" className="">--</SelectItem>
                  {agents
                    .filter(agent => agent.id && agent.displayName)
                    .map((agent) => (
                      <SelectItem 
                        key={agent.id} 
                        value={agent.id}
                        className=""
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative w-6 h-6 rounded-full overflow-hidden">
                            <Image
                              src={agent.photoURL || "/WALLS-Logo.png"}
                              alt={agent.displayName}
                              width={24}
                              height={24}
                              className="object-cover"
                            />
                          </div>
                          {agent.displayName}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pitched To Filter */}
            <div>
              <Select
                value={filters.pitchedTo}
                onValueChange={(value) => onFilterChange("pitchedTo", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Pitched To:</span>
                    <SelectValue placeholder={loading.contacts ? "Loading contacts..." : "Select contact"}>
                      {filters.pitchedTo && (
                        <span>
                          {`${contacts.find(c => c.email === filters.pitchedTo)?.firstName} ${contacts.find(c => c.email === filters.pitchedTo)?.lastName}`}
                        </span>
                      )}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all" className="">--</SelectItem>
                  {filteredContacts
                    .filter(contact => contact.email && contact.firstName && contact.lastName)
                    .map((contact) => (
                      <SelectItem 
                        key={contact.id} 
                        value={contact.email}
                        className=""
                      >
                        <div className="flex items-center gap-2">
                          <span>{`${contact.firstName} ${contact.lastName}`}</span>
                          {contact.company && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-400">{contact.company}</span>
                            </>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company Filter */}
            <div>
              <Select
                value={filters.company}
                onValueChange={(value) => onFilterChange("company", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Company:</span>
                    <SelectValue placeholder={loading.companies ? "Loading companies..." : "Select company"}>
                      {filters.company && (
                        <div className="flex items-center gap-2">
                          <Image
                            src={
                              !imageErrors[companies.find(c => c.website === filters.company)?.id || ''] && filters.company
                                ? `https://logo.clearbit.com/${extractDomain(filters.company)}`
                                : "/images/BlankCompany.png"
                            }
                            alt="Company logo"
                            width={24}
                            height={24}
                            className="rounded-full object-cover"
                            onError={() => handleImageError(companies.find(c => c.website === filters.company)?.id || '')}
                          />
                          {companies.find(c => c.website === filters.company)?.name}
                        </div>
                      )}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all" className="">--</SelectItem>
                  {filteredCompanies
                    .filter(company => company.website && company.name)
                    .map((company) => {
                      const companyImageUrl = !imageErrors[company.id] && company.website
                        ? `https://logo.clearbit.com/${extractDomain(company.website)}`
                        : "/images/BlankCompany.png";
                      
                      return (
                        <SelectItem 
                          key={company.id} 
                          value={company.website}
                          className=""
                        >
                          <div className="flex items-center gap-2">
                            <Image
                              src={companyImageUrl}
                              alt={`${company.name} logo`}
                              width={24}
                              height={24}
                              className="rounded-full object-cover"
                              onError={() => handleImageError(company.id)}
                            />
                            {company.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {/* Creator Filter */}
            <div>
              <Select
                value={filters.creator}
                onValueChange={(value) => onFilterChange("creator", value === "all" ? "" : value)}
              >
                <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">Creator:</span>
                    <SelectValue placeholder={loading.creators ? "Loading creators..." : "Select creator"}>
                      {filters.creator && (
                        <div className="flex items-center gap-2">
                          {creators.find(c => c.creatorAlias === filters.creator)?.profilePictureUrl && (
                            <div className="relative w-6 h-6 rounded-full overflow-hidden">
                              <Image
                                src={creators.find(c => c.creatorAlias === filters.creator)?.profilePictureUrl || "/WALLS-Logo.png"}
                                alt="Creator photo"
                                width={24}
                                height={24}
                                className="object-cover"
                              />
                            </div>
                          )}
                          {filters.creator}
                        </div>
                      )}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all" className="">--</SelectItem>
                  {filteredCreators
                    .filter(creator => creator.creatorAlias)
                    .map((creator) => (
                      <SelectItem 
                        key={creator.id} 
                        value={creator.creatorAlias}
                        className=""
                      >
                        <div className="flex items-center gap-2">
                          {creator.profilePictureUrl && (
                            <div className="relative w-6 h-6 rounded-full overflow-hidden">
                              <Image
                                src={creator.profilePictureUrl}
                                alt={creator.creatorAlias}
                                width={24}
                                height={24}
                                className="object-cover"
                              />
                            </div>
                          )}
                          {creator.creatorAlias}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-black/10">
          <button
            onClick={() => {
              onFilterChange("searchTerm", "");
              onFilterChange("pitchedBy", "");
              onFilterChange("pitchedTo", "");
              onFilterChange("company", "");
              onFilterChange("creator", "");
            }}
            className="w-full h-[50px] rounded-full border border-transparent hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 text-black font-medium"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
} 