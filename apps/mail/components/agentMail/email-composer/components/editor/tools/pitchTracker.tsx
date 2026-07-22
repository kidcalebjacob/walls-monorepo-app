import React, { useState, useEffect, useRef } from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { Plus, CheckCircle, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import Image from "next/image";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

interface Creator {
  id: string;
  name: string;
  avatar_url: string;
  agent_team_id: string | null;
  contract_type: string | null;
}

interface SelectedCreator {
  id: string;
  name: string;
  avatar_url: string;
}

export interface SelectedCreatorSummary {
  id: string;
  name: string;
}

interface PitchTrackerProps {
  onPitchChange: (selectedCreators: SelectedCreatorSummary[]) => void;
}

export function PitchTracker({ onPitchChange }: PitchTrackerProps) {
  const { user } = useAuth();
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreator[]>([]);
  const [open, setOpen] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [managedCreators, setManagedCreators] = useState<Creator[]>([]);
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  const [searchManagedCreators, setSearchManagedCreators] = useState<Creator[]>([]);
  const [searchAllCreators, setSearchAllCreators] = useState<Creator[]>([]);
  const [expandedManaged, setExpandedManaged] = useState<boolean>(true);
  const [expandedAll, setExpandedAll] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchCreators = async () => {
      try {
        const supabase = getSupabaseClient();
        
        // Get current user's ID
        if (!user?.email) {
          setCreators([]);
          return;
        }

        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (!supabaseUser?.email) {
          setCreators([]);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', supabaseUser.email)
          .single();

        if (!userData?.id) {
          setCreators([]);
          return;
        }

        setCurrentUserId(userData.id);
        
        // Fetch active talent from Supabase
        const { data: talentData, error } = await supabase
          .from('talent')
          .select('id, first_name, last_name, avatar_url, agent_team_id, status, contract_type')
          .eq('status', 'Active')
          .order('first_name', { ascending: true });
        
        if (error) {
          console.error("Error fetching creators:", error);
          setCreators([]);
          return;
        }
        
        // Map talent data to Creator interface
        const creatorsList = (talentData || [])
          .map(talent => {
            const firstName = talent.first_name || '';
            const lastName = talent.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim();
            
            return {
              id: talent.id,
              name: fullName,
              avatar_url: talent.avatar_url || '',
              agent_team_id: talent.agent_team_id || null,
              contract_type: talent.contract_type || null
            };
          })
          .filter(creator => creator.name) // Only include creators with a name
          .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by full name
        
        setCreators(creatorsList);
      } catch (error) {
        console.error("Error fetching creators:", error);
        setCreators([]);
      }
    };

    fetchCreators();
  }, [user?.email]);

  // Separate creators into managed and all
  useEffect(() => {
    if (!currentUserId) {
      setManagedCreators([]);
      setAllCreators(creators);
      return;
    }

    // Managed creators: agent_team_id matches user.id and contract_type is 'exclusive'
    const managed = creators.filter(c => 
      c.agent_team_id === currentUserId && c.contract_type === 'exclusive'
    );
    
    setManagedCreators(managed);
    setAllCreators(creators);
  }, [creators, currentUserId]);

  // Filter managed creators by search query
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchManagedCreators(managedCreators);
      return;
    }

    const query = searchTerm.toLowerCase();
    const filtered = managedCreators.filter(creator =>
      creator.name.toLowerCase().includes(query)
    );
    setSearchManagedCreators(filtered);
  }, [searchTerm, managedCreators]);

  // Filter all creators by search query
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchAllCreators(allCreators);
      return;
    }

    const query = searchTerm.toLowerCase();
    const filtered = allCreators.filter(creator =>
      creator.name.toLowerCase().includes(query)
    );
    setSearchAllCreators(filtered);
  }, [searchTerm, allCreators]);

  const displayManagedCreators = searchTerm.trim() ? searchManagedCreators : managedCreators;
  const displayAllCreators = searchTerm.trim() ? searchAllCreators : allCreators;

  // Notify parent component when selected creators change
  useEffect(() => {
    onPitchChange(selectedCreators.map(c => ({ id: c.id, name: c.name })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCreators]);

  const handleCreatorSelect = (creatorId: string) => {
    const creator = creators.find(c => c.id === creatorId);
    if (!creator) return;
    
    const isSelected = selectedCreators.some(c => c.id === creator.id);
    
    const updatedCreators = isSelected
      ? selectedCreators.filter(c => c.id !== creator.id)
      : [...selectedCreators, { 
          id: creator.id,
          name: creator.name, 
          avatar_url: creator.avatar_url 
        }];
    
    setSelectedCreators(updatedCreators);
  };

  const isCreatorSelected = (creatorId: string): boolean => {
    return selectedCreators.some(c => c.id === creatorId);
  };

  return (
    <Select 
      value=""
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setSearchTerm("");
        } else {
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }}
      onValueChange={() => {
        // Prevent default value change behavior for multi-select
      }}
    >
      <SelectTrigger className="relative group hover:bg-transparent p-0 h-[40px] w-[40px] flex items-center justify-center border-0 shadow-none bg-transparent focus:ring-0 focus:ring-offset-0">
        <div className="relative group">
          <div className="relative z-10 h-[40px] w-[40px] p-2 bg-neutral-100/80 backdrop-blur-md rounded-full shadow-inner border border-neutral-200/50 transition-all duration-300 ease-in-out group-hover:bg-neutral-100 group-hover:shadow-inner group-hover:border-neutral-200 group-hover:scale-95 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] flex items-center justify-center">
            {selectedCreators.length === 0 ? (
              <Plus className="h-[18px] w-[18px] stroke-[1.5] text-neutral-600 flex-shrink-0" />
            ) : selectedCreators.length === 1 ? (
              <div className="h-[24px] w-[24px] rounded-full relative overflow-hidden bg-walls-blue flex items-center justify-center flex-shrink-0">
                {selectedCreators[0].avatar_url ? (
                  <Image
                    src={selectedCreators[0].avatar_url}
                    alt={selectedCreators[0].name}
                    fill
                    className="object-cover rounded-full"
                    sizes="24px"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = FALLBACK_ICON_URL;
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white text-xs font-medium">
                    {selectedCreators[0].name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[24px] w-[24px] rounded-full bg-walls-blue text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                {selectedCreators.length}
              </div>
            )}
          </div>
        </div>
      </SelectTrigger>
      <SelectContent 
        className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-[350px] min-w-[350px] max-h-[500px] overflow-hidden flex flex-col [&>div]:!p-0 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={8}
      >
        {/* Search Input - Sticky */}
        <div className="p-2 border-b border-gray-900/10 flex-shrink-0 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
          <div className="rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                e.stopPropagation();
                setSearchTerm(e.target.value);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") {
                  setSearchTerm("");
                }
              }}
              placeholder="Search creators..."
              className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full text-sm focus:outline-none placeholder:text-neutral-600"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Creator List - Scrollable */}
        <div className="overflow-y-auto flex-1 bg-neutral-300/20 backdrop-blur-xl">
          {/* Managed Section */}
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setExpandedManaged(!expandedManaged);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center w-full px-4 py-2 border-b border-gray-900/10 cursor-pointer bg-neutral-200/50 hover:bg-neutral-300/40 transition-colors"
            >
              <span className="text-sm font-normal text-gray-700">Managed</span>
              <div className="flex-1" />
              {expandedManaged ? (
                <Minus className="h-4 w-4 text-neutral-600" />
              ) : (
                <Plus className="h-4 w-4 text-neutral-600" />
              )}
            </button>
            <AnimatePresence>
              {expandedManaged && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {displayManagedCreators.length === 0 ? (
                    <div className="py-2 px-4 text-sm text-gray-500">No managed creators found</div>
                  ) : (
                    displayManagedCreators.map((creator) => (
                      <div
                        key={creator.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCreatorSelect(creator.id);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className={`flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 ${
                          isCreatorSelected(creator.id) ? 'bg-kenoo-yellow/40' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                            {creator.avatar_url ? (
                              <Image
                                src={creator.avatar_url}
                                alt={creator.name}
                                fill
                                className="object-cover"
                                sizes="24px"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = FALLBACK_ICON_URL;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <span className="text-xs text-gray-600">
                                  {creator.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="font-normal text-sm">{creator.name}</span>
                          </div>

                          {isCreatorSelected(creator.id) && (
                            <CheckCircle className="h-4 w-4 text-neutral-600 ml-auto flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* All Section */}
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setExpandedAll(!expandedAll);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center w-full px-4 py-2 border-b border-gray-900/10 cursor-pointer bg-neutral-200/50 hover:bg-neutral-300/40 transition-colors"
            >
              <span className="text-sm font-normal text-gray-700">All</span>
              <div className="flex-1" />
              {expandedAll ? (
                <Minus className="h-4 w-4 text-neutral-600" />
              ) : (
                <Plus className="h-4 w-4 text-neutral-600" />
              )}
            </button>
            <AnimatePresence>
              {expandedAll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {displayAllCreators.length === 0 ? (
                    <div className="py-2 px-4 text-sm text-gray-500">No creators found</div>
                  ) : (
                    displayAllCreators.map((creator) => (
            <div
              key={creator.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCreatorSelect(creator.id);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={`flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 ${
                isCreatorSelected(creator.id) ? 'bg-kenoo-yellow/40' : ''
              }`}
            >
              <div className="flex items-center space-x-3 w-full">
                <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                  {creator.avatar_url ? (
                    <Image
                      src={creator.avatar_url}
                      alt={creator.name}
                      fill
                      className="object-cover"
                      sizes="24px"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = FALLBACK_ICON_URL;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs text-gray-600">
                        {creator.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="font-normal text-sm">{creator.name}</span>
                </div>

                {isCreatorSelected(creator.id) && (
                  <CheckCircle className="h-4 w-4 text-neutral-600 ml-auto flex-shrink-0" />
                )}
              </div>
            </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SelectContent>
    </Select>
  );
}