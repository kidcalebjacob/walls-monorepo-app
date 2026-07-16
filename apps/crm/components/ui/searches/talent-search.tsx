"use client";

import React, { useState, useEffect, useRef } from "react";
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from "next/image";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { CheckCircle } from "lucide-react";

const FALLBACK_AVATAR = FALLBACK_ICON_URL;

interface Talent {
  id: string;
  name: string;
  avatar_url: string;
}

interface TalentSearchProps {
  value: string;
  onSelect: (talentId: string) => void;
}

export function TalentSearch({ value, onSelect }: TalentSearchProps) {
  const { user } = useAuth();
  const [talentList, setTalentList] = useState<Talent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredTalent, setFilteredTalent] = useState<Talent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchTalent = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("talent")
          .select("id, first_name, last_name, avatar_url")
          .eq("status", "Active")
          .order("first_name", { ascending: true });

        if (error) {
          console.error("Error fetching talent:", error);
          setTalentList([]);
          return;
        }

        const list = (data || [])
          .map((t: { id: string; first_name: string; last_name: string; avatar_url: string | null }) => {
            const name = `${t.first_name || ""} ${t.last_name || ""}`.trim();
            return name
              ? { id: t.id, name, avatar_url: t.avatar_url || "" }
              : null;
          })
          .filter(Boolean) as Talent[];
        setTalentList(list);
      } catch (err) {
        console.error(err);
        setTalentList([]);
      }
    };
    fetchTalent();
  }, [user]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredTalent(talentList);
      return;
    }
    const q = searchTerm.toLowerCase();
    setFilteredTalent(talentList.filter((t) => t.name.toLowerCase().includes(q)));
  }, [searchTerm, talentList]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col max-h-[400px] overflow-hidden">
      <div className="p-2 border-b border-gray-900/10 flex-shrink-0 bg-white/80 backdrop-blur-xl">
        <div className="rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchTerm("")}
            placeholder="Search talent..."
            className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full text-sm focus:outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 bg-neutral-300/20 backdrop-blur-xl">
        {filteredTalent.length === 0 ? (
          <div className="py-2 px-4 text-sm text-gray-500">No talent found</div>
        ) : (
          filteredTalent.map((talent) => {
            const isSelected = value === talent.id;
            return (
              <div
                key={talent.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(talent.id);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={`flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 ${
                  isSelected ? "bg-kenoo-yellow/40" : ""
                }`}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                    {talent.avatar_url ? (
                      <Image
                        src={talent.avatar_url}
                        alt={talent.name}
                        fill
                        className="object-cover"
                        sizes="24px"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = FALLBACK_AVATAR;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-600">
                          {talent.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-normal text-sm">{talent.name}</span>
                  </div>
                  {isSelected && (
                    <CheckCircle className="h-4 w-4 text-black ml-auto flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
