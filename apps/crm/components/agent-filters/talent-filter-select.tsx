"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { CheckCircle, Plus, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Talent {
  id: string;
  name: string;
  avatar_url: string;
  agent_team_id: string | null;
  contract_type: string | null;
}

interface TalentFilterSelectProps {
  selectedTalentIds: string[];
  onTalentChange: (talentIds: string[]) => void;
}

export function TalentFilterSelect({ selectedTalentIds, onTalentChange }: TalentFilterSelectProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [talent, setTalent] = useState<Talent[]>([]);
  const [managedTalent, setManagedTalent] = useState<Talent[]>([]);
  const [allTalent, setAllTalent] = useState<Talent[]>([]);
  const [searchManagedTalent, setSearchManagedTalent] = useState<Talent[]>([]);
  const [searchAllTalent, setSearchAllTalent] = useState<Talent[]>([]);
  const [expandedManaged, setExpandedManaged] = useState<boolean>(true);
  const [expandedAll, setExpandedAll] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchTalent = async () => {
      try {
        const supabase = getSupabaseClient();
        
        if (!user?.email) {
          setTalent([]);
          return;
        }

        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (!supabaseUser?.email) {
          setTalent([]);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', supabaseUser.email)
          .single();

        if (!userData?.id) {
          setTalent([]);
          return;
        }

        setCurrentUserId(userData.id);
        
        const { data: talentData, error } = await supabase
          .from('talent')
          .select('id, first_name, last_name, avatar_url, agent_team_id, status, contract_type')
          .eq('status', 'Active')
          .order('first_name', { ascending: true });
        
        if (error) {
          console.error("Error fetching talent:", error);
          setTalent([]);
          return;
        }
        
        const talentList = (talentData || [])
          .map(t => {
            const firstName = t.first_name || '';
            const lastName = t.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim();
            
            return {
              id: t.id,
              name: fullName,
              avatar_url: t.avatar_url || '',
              agent_team_id: t.agent_team_id || null,
              contract_type: t.contract_type || null
            };
          })
          .filter(t => t.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setTalent(talentList);
      } catch (error) {
        console.error("Error fetching talent:", error);
        setTalent([]);
      }
    };

    fetchTalent();
  }, [user?.email]);

  useEffect(() => {
    if (!currentUserId) {
      setManagedTalent([]);
      setAllTalent(talent);
      return;
    }

    const managed = talent.filter(t => 
      t.agent_team_id === currentUserId && t.contract_type === 'exclusive'
    );
    
    setManagedTalent(managed);
    setAllTalent(talent);
  }, [talent, currentUserId]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchManagedTalent(managedTalent);
      return;
    }

    const query = searchTerm.toLowerCase();
    const filtered = managedTalent.filter(t =>
      t.name.toLowerCase().includes(query)
    );
    setSearchManagedTalent(filtered);
  }, [searchTerm, managedTalent]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchAllTalent(allTalent);
      return;
    }

    const query = searchTerm.toLowerCase();
    const filtered = allTalent.filter(t =>
      t.name.toLowerCase().includes(query)
    );
    setSearchAllTalent(filtered);
  }, [searchTerm, allTalent]);

  const displayManagedTalent = searchTerm.trim() ? searchManagedTalent : managedTalent;
  const displayAllTalent = searchTerm.trim() ? searchAllTalent : allTalent;

  const handleTalentSelect = (talentId: string) => {
    const isSelected = selectedTalentIds.includes(talentId);
    
    const updatedIds = isSelected
      ? selectedTalentIds.filter(id => id !== talentId)
      : [...selectedTalentIds, talentId];
    
    onTalentChange(updatedIds);
  };

  const isTalentSelected = (talentId: string): boolean => {
    return selectedTalentIds.includes(talentId);
  };

  const selectedTalent = talent.filter(t => selectedTalentIds.includes(t.id));

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
      onValueChange={() => {}}
    >
      <SelectTrigger className="border border-transparent rounded-full focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden hover:bg-gray-50 hover:border-neutral-200 hover:scale-95 hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] transition-all duration-300">
        <div className="flex items-center gap-2 w-full">
          <span className="text-neutral-700">Talent:</span>
          <div className="flex-1 flex items-center gap-1 min-w-0">
            {selectedTalent.length === 0 ? (
              <span className="text-neutral-700">—</span>
            ) : selectedTalent.length === 1 ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-full relative overflow-hidden bg-kenoo-blue flex-shrink-0">
                  {selectedTalent[0].avatar_url ? (
                    <Image
                      src={selectedTalent[0].avatar_url}
                      alt={selectedTalent[0].name}
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
                      {selectedTalent[0].name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-sm truncate">{selectedTalent[0].name}</span>
              </div>
            ) : (
              <span className="text-sm">{selectedTalent.length} selected</span>
            )}
          </div>
        </div>
      </SelectTrigger>
      <SelectContent 
        className="p-0 bg-neutral-300/20 backdrop-blur-xl shadow-2xl !z-[9999] w-[350px] max-h-[500px] overflow-hidden flex flex-col [&>div]:p-0"
        side="bottom"
        align="start"
        sideOffset={8}
      >
        <div className="p-2 border-b border-gray-900/10 flex-shrink-0 sticky top-0 bg-neutral-300/95 backdrop-blur-xl z-10">
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
            placeholder="Search talent..."
            className="w-full px-3 py-2 text-sm border-1 rounded-md bg-black/10 backdrop-blur-xl focus:outline-none placeholder:text-gray-600"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="overflow-y-auto flex-1 bg-neutral-300/20 backdrop-blur-xl">
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setExpandedManaged(!expandedManaged);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center w-full px-4 py-2 border-b border-gray-900/10 cursor-pointer hover:bg-neutral-300/30 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">Managed</span>
              <div className="flex-1" />
              {expandedManaged ? (
                <Minus className="h-4 w-4 text-gray-500" />
              ) : (
                <Plus className="h-4 w-4 text-gray-500" />
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
                  {displayManagedTalent.length === 0 ? (
                    <div className="py-2 px-4 text-sm text-gray-500">No managed talent found</div>
                  ) : (
                    displayManagedTalent.map((t) => (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTalentSelect(t.id);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className={`flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 ${
                          isTalentSelected(t.id) ? 'bg-kenoo-yellow/40' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                            {t.avatar_url ? (
                              <Image
                                src={t.avatar_url}
                                alt={t.name}
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
                                  {t.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="font-normal text-sm">{t.name}</span>
                          </div>

                          {isTalentSelected(t.id) && (
                            <CheckCircle className="h-4 w-4 text-black ml-auto flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setExpandedAll(!expandedAll);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center w-full px-4 py-2 border-b border-gray-900/10 cursor-pointer hover:bg-neutral-300/30 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">All</span>
              <div className="flex-1" />
              {expandedAll ? (
                <Minus className="h-4 w-4 text-gray-500" />
              ) : (
                <Plus className="h-4 w-4 text-gray-500" />
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
                  {displayAllTalent.length === 0 ? (
                    <div className="py-2 px-4 text-sm text-gray-500">No talent found</div>
                  ) : (
                    displayAllTalent.map((t) => (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTalentSelect(t.id);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className={`flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 ${
                          isTalentSelected(t.id) ? 'bg-kenoo-yellow/40' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                            {t.avatar_url ? (
                              <Image
                                src={t.avatar_url}
                                alt={t.name}
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
                                  {t.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="font-normal text-sm">{t.name}</span>
                          </div>

                          {isTalentSelected(t.id) && (
                            <CheckCircle className="h-4 w-4 text-black ml-auto flex-shrink-0" />
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
