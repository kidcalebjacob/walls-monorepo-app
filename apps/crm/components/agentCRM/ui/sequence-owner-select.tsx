"use client";

import { useEffect, useState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { getSupabaseClient } from "@/app/auth/supabaseClient";
import { useAuth } from "@/app/auth/AuthContext";

interface SequenceOwnerSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** When true, only render the member's name in the trigger (no email). Dropdown items keep the email for disambiguation. */
  hideEmail?: boolean;
}

interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export function SequenceOwnerSelect({ value, onValueChange, className, hideEmail = false }: SequenceOwnerSelectProps) {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const supabase = getSupabaseClient();
        
        // Fetch all team records to get user_ids
        const { data: teamData, error: teamError } = await supabase
          .from('team')
          .select('user_id')
          .not('user_id', 'is', null);
        
        if (teamError) {
          throw teamError;
        }
        
        if (!teamData || teamData.length === 0) {
          setTeamMembers([]);
          setLoading(false);
          return;
        }
        
        // Get all unique user_ids from team
        const uniqueUserIds = new Set(teamData
          .map(t => t.user_id)
          .filter(Boolean));
        const userIds = Array.from(uniqueUserIds) as string[];
        
        if (userIds.length === 0) {
          setTeamMembers([]);
          setLoading(false);
          return;
        }
        
        // Fetch all users data
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name, avatar_url, email')
          .in('id', userIds);
        
        if (usersError) {
          throw usersError;
        }
        
        // Map to TeamMember format
        const membersData: TeamMember[] = (usersData || []).map((userData) => {
          const firstName = userData.first_name || '';
          const lastName = userData.last_name || '';
          const displayName = `${firstName} ${lastName}`.trim() || userData.email || 'Unknown';
          
          return {
            id: userData.id,
            displayName,
            email: userData.email || "",
            avatarUrl: userData.avatar_url,
          };
        });
        
        // Sort members: current user first, then alphabetically by displayName
        const currentUserEmail = user?.email;
        membersData.sort((a, b) => {
          // If a is the current user, it should come first
          if (a.email === currentUserEmail && b.email !== currentUserEmail) return -1;
          // If b is the current user, it should come first
          if (b.email === currentUserEmail && a.email !== currentUserEmail) return 1;
          // Otherwise, sort alphabetically
          return a.displayName.localeCompare(b.displayName);
        });
        
        setTeamMembers(membersData);
        setFilteredMembers(membersData);
      } catch (error) {
        console.error("Error fetching team members:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMembers();
  }, [user?.email]);

  // Filter members by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMembers(teamMembers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = teamMembers.filter(member =>
      member.displayName.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
    setFilteredMembers(filtered);
  }, [searchQuery, teamMembers]);

  const selectedMember = teamMembers.find(m => m.id === value);
  const currentUser = user?.email ? teamMembers.find(m => m.email === user.email) : null;

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
        {selectedMember ? (
          <div className="flex items-center space-x-2 flex-1">
            {selectedMember.avatarUrl ? (
              <div className="relative w-5 h-5 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center">
                <Image
                  src={selectedMember.avatarUrl}
                  alt={selectedMember.displayName}
                  fill
                  sizes="24px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                <span className="text-xs text-gray-600">
                  {selectedMember.displayName.charAt(0)}
                </span>
              </div>
            )}
            <span className="flex-1 text-left">
              {selectedMember.id === currentUser?.id ? 'You' : selectedMember.displayName}
              {hideEmail ? null : (
                <> <span className="text-gray-500">&lt;{selectedMember.email}&gt;</span></>
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center w-full">
            {searchQuery ? (
              <span className="text-left text-gray-900">{searchQuery}</span>
            ) : (
              <span className="text-gray-500">
                <SelectValue placeholder="Select owner" />
              </span>
            )}
          </div>
        )}
      </SelectTrigger>
      <SelectContent className="bg-neutral-300/20 backdrop-blur-xl border border-white/30 shadow-2xl">
        {/* Search Input */}
        <div className="p-2 border-b border-gray-900/10">
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
            placeholder="Search team members..."
            className="w-full px-3 py-2 text-sm border-1 rounded-md bg-black/10 backdrop-blur-xl focus:outline-none placeholder:text-gray-600"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {loading ? (
          <div className="py-2 px-4 text-sm text-gray-500">Loading...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-2 px-4 text-sm text-gray-500">No team members found</div>
        ) : (
          filteredMembers.map((member) => (
            <SelectItem 
              key={member.id}
              value={member.id}
              className={`rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10 pr-4 pl-2 [&>span:first-child]:hidden ${
                value === member.id ? 'bg-kenoo-yellow/40' : ''
              }`}
            >
              <div className="flex items-center space-x-2 flex-1">
                {member.avatarUrl ? (
                  <div className="relative w-5 h-5 overflow-hidden rounded-full flex-shrink-0 flex items-center justify-center">
                    <Image
                      src={member.avatarUrl}
                      alt={member.displayName}
                      fill
                      sizes="24px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs text-gray-600">
                      {member.displayName.charAt(0)}
                    </span>
                  </div>
                )}
                <span>
                  {member.id === currentUser?.id ? 'You' : member.displayName} <span className="text-gray-500">&lt;{member.email}&gt;</span>
                </span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
