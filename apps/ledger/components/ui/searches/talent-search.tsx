"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle } from "lucide-react";
import { getSupabaseClient, useAuth } from "@walls/auth";

const FALLBACK_AVATAR =
  "https://assets.wallsentertainment.com/avatar-fallback-v2.png";

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
          .map(
            (t: {
              id: string;
              first_name: string;
              last_name: string;
              avatar_url: string | null;
            }) => {
              const name = `${t.first_name || ""} ${t.last_name || ""}`.trim();
              return name
                ? { id: t.id, name, avatar_url: t.avatar_url || "" }
                : null;
            },
          )
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
    <div className="flex max-h-[400px] flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-900/10 bg-white/80 p-2 backdrop-blur-xl">
        <div className="rounded-lg border border-neutral-200/50 bg-neutral-100 py-2 pl-2 pr-4 shadow-inner backdrop-blur-md">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchTerm("")}
            placeholder="Search talent..."
            className="w-full flex-1 border-0 bg-transparent text-sm focus:outline-none focus:ring-0 focus-visible:ring-0 placeholder:text-neutral-400"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-300/20 backdrop-blur-xl">
        {filteredTalent.length === 0 ? (
          <div className="px-4 py-2 text-sm text-gray-500">No talent found</div>
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
                className={`flex cursor-pointer items-center rounded-none px-4 py-2 hover:bg-neutral-300/30 focus:bg-neutral-500/10 ${
                  isSelected ? "bg-kenoo-yellow/40" : ""
                }`}
              >
                <div className="flex w-full items-center space-x-3">
                  <div className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-full">
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
                      <div className="flex h-full w-full items-center justify-center bg-gray-200">
                        <span className="text-xs text-gray-600">
                          {talent.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-normal">{talent.name}</span>
                  </div>
                  {isSelected && (
                    <CheckCircle className="ml-auto h-4 w-4 flex-shrink-0 text-black" />
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
