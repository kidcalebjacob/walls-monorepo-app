"use client";

import { useEffect, useState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";
import { Building2, User, Users, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface SequenceSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  personId?: string;
}

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sequence_owner: string;
  is_campaign: boolean;
}

type FilterType = "all" | "my" | "team" | "added";

export function SequenceSelect({ value, onValueChange, className, personId }: SequenceSelectProps) {
  const { user } = useAuth();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [filteredSequences, setFilteredSequences] = useState<Sequence[]>([]);
  const [searchFilteredSequences, setSearchFilteredSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("my");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [personSequenceIds, setPersonSequenceIds] = useState<Set<string>>(new Set());
  const [replyRateBySequenceId, setReplyRateBySequenceId] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSequences = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();
        
        // Get current user's ID
        if (!user?.email) {
          setSequences([]);
          setLoading(false);
          return;
        }

        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (!supabaseUser?.email) {
          setSequences([]);
          setLoading(false);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', supabaseUser.email)
          .single();

        if (!userData?.id) {
          setSequences([]);
          setLoading(false);
          return;
        }

        setCurrentUserId(userData.id);

        // Fetch all sequences (we'll filter client-side)
        const { data: sequencesData, error } = await supabase
          .from('sequences')
          .select('id, name, description, status, sequence_owner, is_campaign')
          .in('status', ['draft', 'active', 'paused'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Error fetching sequences:", error);
          setSequences([]);
        } else {
          setSequences(sequencesData || []);
        }
      } catch (error) {
        console.error("Error fetching sequences:", error);
        setSequences([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSequences();
  }, [user?.email]);

  // Fetch sequences that the person is already in
  useEffect(() => {
    const fetchPersonSequences = async () => {
      if (!personId) {
        setPersonSequenceIds(new Set());
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const { data: sequencePeople, error } = await supabase
          .from('sequence_people')
          .select('sequence_id')
          .eq('person_id', personId);

        if (error) {
          console.error("Error fetching person sequences:", error);
          setPersonSequenceIds(new Set());
        } else {
          const sequenceIds = new Set(sequencePeople?.map(sp => sp.sequence_id) || []);
          setPersonSequenceIds(sequenceIds);
        }
      } catch (error) {
        console.error("Error fetching person sequences:", error);
        setPersonSequenceIds(new Set());
      }
    };

    fetchPersonSequences();
  }, [personId]);

  // Fetch reply rates for all sequences (sequence_people counts)
  useEffect(() => {
    if (sequences.length === 0) {
      setReplyRateBySequenceId({});
      return;
    }
    let cancelled = false;
    const supabase = getSupabaseClient();
    const sequenceIds = sequences.map((s) => s.id);
    void (async () => {
      try {
        const { data: contactRows, error } = await supabase
          .from("sequence_people")
          .select("sequence_id, is_replied")
          .in("sequence_id", sequenceIds);
        if (cancelled) return;
        if (error) {
          setReplyRateBySequenceId({});
          return;
        }
        const contactCounts: Record<string, number> = {};
        const repliedCounts: Record<string, number> = {};
        (contactRows || []).forEach((row: { sequence_id: string; is_replied: boolean }) => {
          const sid = row.sequence_id;
          contactCounts[sid] = (contactCounts[sid] || 0) + 1;
          if (row.is_replied === true) {
            repliedCounts[sid] = (repliedCounts[sid] || 0) + 1;
          }
        });
        const rates: Record<string, number> = {};
        sequenceIds.forEach((sid) => {
          const total = contactCounts[sid] || 0;
          const replied = repliedCounts[sid] || 0;
          rates[sid] = total > 0 ? Math.round((replied / total) * 100) : 0;
        });
        setReplyRateBySequenceId(rates);
      } catch {
        if (!cancelled) setReplyRateBySequenceId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sequences]);

  // Filter sequences based on selected filter
  useEffect(() => {
    if (!currentUserId && filter !== "added") {
      setFilteredSequences([]);
      return;
    }

    const filterSequences = async () => {
      let filtered: Sequence[] = [];

      switch (filter) {
        case "added":
          filtered = sequences.filter(s => personSequenceIds.has(s.id));
          break;
        case "my":
          filtered = sequences.filter(s => s.sequence_owner === currentUserId && s.is_campaign === true);
          break;
        case "team":
          // Get team members' user IDs
          const supabase = getSupabaseClient();
          const { data: teamData } = await supabase
            .from('team')
            .select('user_id')
            .not('user_id', 'is', null);
          
          if (teamData) {
            const teamUserIds = teamData
              .map(t => t.user_id)
              .filter(Boolean) as string[];
            
            // Include current user in team
            const uniqueTeamIds = new Set([currentUserId, ...teamUserIds]);
            const allTeamIds = Array.from(uniqueTeamIds) as string[];
            filtered = sequences.filter(s => allTeamIds.includes(s.sequence_owner));
          } else {
            // If no team data, just show current user's sequences
            filtered = sequences.filter(s => s.sequence_owner === currentUserId);
          }
          break;
        case "all":
        default:
          filtered = sequences;
          break;
      }

      setFilteredSequences(filtered);
    };

    filterSequences();
  }, [filter, sequences, currentUserId, personSequenceIds]);

  // Filter sequences by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchFilteredSequences(filteredSequences);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = filteredSequences.filter(sequence =>
      sequence.name.toLowerCase().includes(query) ||
      (sequence.description && sequence.description.toLowerCase().includes(query))
    );
    setSearchFilteredSequences(filtered);
  }, [searchQuery, filteredSequences]);

  const displaySequences = searchQuery.trim() ? searchFilteredSequences : filteredSequences;
  const selectedSequence = sequences.find(s => s.id === value);

  return (
    <Select 
      value={value} 
      onValueChange={(val) => {
        onValueChange(val);
        setSearchQuery("");
      }}
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setSearchQuery("");
        } else {
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }}
    >
      <SelectTrigger className={className}>
        {selectedSequence ? (
          <span className="text-left">{selectedSequence.name}</span>
        ) : (
          <div className="flex items-center w-full">
            {searchQuery ? (
              <span className="text-left text-gray-900">{searchQuery}</span>
            ) : (
              <span className="text-gray-500">
                <SelectValue placeholder="Select sequence..." />
              </span>
            )}
          </div>
        )}
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="bottom"
        align="start"
        sideOffset={8}
        className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-full min-w-[280px] max-h-[500px] overflow-hidden flex flex-col [&>div]:!p-0 rounded-lg"
      >
        {/* Header: Search + Filter (fixed, does not scroll) */}
        <div className="flex-shrink-0 sticky top-0 z-10 bg-white/80 backdrop-blur-xl rounded-t-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-900/10">
            <div className="rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  e.stopPropagation();
                  setSearchQuery(e.target.value);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    setSearchQuery("");
                  }
                }}
                placeholder="Search sequences..."
                className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full text-sm focus:outline-none placeholder:text-neutral-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Filter Navigation */}
          <div className="flex border-b border-gray-900/10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setFilter("all");
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors group relative ${
              filter === "all"
                ? "text-neutral-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-1.5 relative pb-1">
              <Building2 className="h-4 w-4" />
              <span>All</span>
              <div className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-neutral-700 transition-all duration-300",
                filter === "all" ? "w-full" : "w-0 group-hover:w-full"
              )} />
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setFilter("my");
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors group relative ${
              filter === "my"
                ? "text-neutral-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-1.5 relative pb-1">
              <User className="h-4 w-4" />
              <span>My campaigns</span>
              <div className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-neutral-700 transition-all duration-300",
                filter === "my" ? "w-full" : "w-0 group-hover:w-full"
              )} />
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setFilter("team");
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors group relative ${
              filter === "team"
                ? "text-neutral-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-1.5 relative pb-1">
              <Users className="h-4 w-4" />
              <span>Team</span>
              <div className={cn(
                "absolute bottom-0 left-0 h-0.5 bg-neutral-700 transition-all duration-300",
                filter === "team" ? "w-full" : "w-0 group-hover:w-full"
              )} />
            </span>
          </button>
          {personId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setFilter("added");
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors group relative ${
                filter === "added"
                  ? "text-neutral-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="flex items-center gap-1.5 relative pb-1">
                <ListChecks className="h-4 w-4" />
                <span>Added</span>
                <div className={cn(
                  "absolute bottom-0 left-0 h-0.5 bg-neutral-700 transition-all duration-300",
                  filter === "added" ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </span>
            </button>
          )}
          </div>
        </div>

        {/* Sequence List - Scrollable (only this section scrolls) */}
        <div className="overflow-y-auto flex-1 min-h-0 bg-neutral-300/20 backdrop-blur-xl">
        {displaySequences.length === 0 ? (
          <div className="py-2 px-4 text-sm text-gray-500">No sequences found</div>
        ) : (
          displaySequences.map((sequence) => {
            const isPersonInSequence = personSequenceIds.has(sequence.id);
            return (
              <SelectItem 
                key={sequence.id} 
                value={sequence.id}
                disabled={isPersonInSequence}
                className={`rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 pl-4 pr-8 [&>span:first-child]:hidden relative ${
                  value === sequence.id ? 'bg-kenoo-yellow/40' : ''
                } ${isPersonInSequence ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <div className="flex items-center w-full">
                  <span className="flex-1">{sequence.name}</span>
                </div>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700">
                  {isPersonInSequence
                    ? "Added"
                    : replyRateBySequenceId[sequence.id] !== undefined
                      ? `${replyRateBySequenceId[sequence.id]}%`
                      : "—"}
                </span>
              </SelectItem>
            );
          })
        )}
        </div>
      </SelectContent>
    </Select>
  );
}
