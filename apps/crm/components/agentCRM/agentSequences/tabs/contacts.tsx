"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from '@supabase/supabase-js';
import { format } from "date-fns";
import { Trash2, Search, Play, Pause, Square, FileText, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/agentCRM/agentSequences/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDeletePopup } from "@/components/ui/confirm-delete-popup";
import { SenderSearch } from "@/components/ui/searches/senderSearch/sender-search";
import {
  SequenceContactOutcomePopup,
} from "@/components/agentCRM/agentSequences/sequence-contact-outcome-popup";
import { SequenceContactOutcomeSelect } from "@/components/agentCRM/agentSequences/sequence-contact-outcome-select";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ContactsProps {
  sequenceId: string;
}

interface SequenceContact {
  id: string;
  person_id: string;
  sequence_id: string;
  is_replied: boolean;
  outcome: string | null;
  sequence_step_id: string;
  status: string;
  completed_at: string | null;
  paused_at: string | null;
  pause_reason: string | null;
  created_at: string;
  sender_id: string;
  person?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    company_name: string | null;
    title: string | null;
    company?: {
      id?: string;
      name: string | null;
    } | null;
  };
  sender?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  step?: {
    step_index: number;
    step_name: string;
    scheduled_for?: string | null;
  } | null;
}

const ITEMS_PER_PAGE = 10;

const CONTACTS_FILTER_TRACK =
  "inline-flex min-w-max shrink-0 items-stretch gap-0.5 whitespace-nowrap rounded-full border border-neutral-200/70 bg-neutral-50/50 p-0.5";

const CONTACTS_FILTER_INNER =
  "relative z-10 flex min-h-[3.25rem] w-[100px] shrink-0 flex-none flex-col items-center justify-center gap-0.5 rounded-full border border-transparent px-2 py-1.5 text-center transition-all duration-300 ease-in-out";

const CONTACTS_FILTER_ACTIVE =
  "border-neutral-200 bg-neutral-50 text-neutral-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

const CONTACTS_FILTER_INACTIVE =
  "text-neutral-500 group-hover:scale-95 group-hover:border-neutral-200 group-hover:bg-neutral-50 group-hover:text-neutral-700 group-hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.10)]";

/** Matches agent CRM table toolbars (e.g. people-table-toolbar). */
const SEQUENCE_CONTACTS_ACTION_BUTTON_CLASS =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0";
const SEQUENCE_CONTACTS_ACTION_ICON_WRAP = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
);
const SEQUENCE_CONTACTS_ACTION_ICON_CLASS =
  "h-[18px] w-[18px] stroke-[1.5] text-neutral-500";

// Status filter tabs (counts still include all statuses server-side)
const STATUS_CATEGORIES = [
  { key: 'all', label: 'Total' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'replied', label: 'Replied' },
  { key: 'interested', label: 'Interested' },
  { key: 'future_opportunity', label: 'Revisit' },
  { key: 'undeliverable', label: 'Bounced' },
  { key: 'not_interested', label: 'No Interest' },
  { key: 'paused', label: 'Paused' },
  { key: 'no_response', label: 'No Reply' },
];

const STATUS_FILTER_KEYS = new Set(STATUS_CATEGORIES.map((c) => c.key));

export default function Contacts({ sequenceId }: ContactsProps) {
  const [contacts, setContacts] = useState<SequenceContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<SequenceContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string>('in_progress');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showOutcomePopup, setShowOutcomePopup] = useState(false);

  useEffect(() => {
    if (!STATUS_FILTER_KEYS.has(selectedStatus)) {
      setSelectedStatus("in_progress");
      setCurrentPage(1);
    }
  }, [selectedStatus]);
  

  useEffect(() => {
    const fetchContacts = async () => {
      if (!sequenceId) {
        return;
      }

      try {
        setLoading(true);
        
        // Fetch sequence steps to get step information
        const { data: stepsData } = await supabase
          .from('sequence_steps_join')
          .select(`
            id,
            step_index,
            step:sequence_steps(
              name
            )
          `)
          .eq('sequence_id', sequenceId)
          .order('step_index', { ascending: true });

        const stepsMap = new Map();
        if (stepsData) {
          stepsData.forEach((item: any) => {
            const step = Array.isArray(item.step) ? item.step[0] : item.step;
            if (step) {
              stepsMap.set(item.id, {
                step_index: item.step_index,
                step_name: step.name || `Step ${item.step_index}`
              });
            }
          });
        }

        // Fetch sequence contacts with sender information
        const { data: contactsData, error: contactsError } = await supabase
          .from('sequence_people')
          .select(`
            *,
            sender:users!sequence_people_sender_id_fkey(
              id,
              first_name,
              last_name,
              avatar_url,
              email
            )
          `)
          .eq('sequence_id', sequenceId)
          .order('created_at', { ascending: false });

        if (contactsError) {
          console.error("Error fetching sequence contacts:", contactsError);
          setContacts([]);
          return;
        }

        if (!contactsData || contactsData.length === 0) {
          setContacts([]);
          setStatusCounts({ all: 0 });
          return;
        }

        // Calculate status counts
        const counts: Record<string, number> = { all: contactsData.length };
        contactsData.forEach((contact: any) => {
          const status = contact.status?.toLowerCase() || 'cold';
          counts[status] = (counts[status] || 0) + 1;

          if (contact.is_replied) {
            counts['replied'] = (counts['replied'] || 0) + 1;
          }

          if (contact.status === 'active') {
            counts['in_progress'] = (counts['in_progress'] || 0) + 1;
          }

          if (contact.outcome === 'no_response') {
            counts['no_response'] = (counts['no_response'] || 0) + 1;
          }

          if (contact.outcome === 'interested') {
            counts['interested'] = (counts['interested'] || 0) + 1;
          }

          if (contact.outcome === 'future_opportunity') {
            counts['future_opportunity'] = (counts['future_opportunity'] || 0) + 1;
          }

          if (contact.outcome === 'undeliverable') {
            counts['undeliverable'] = (counts['undeliverable'] || 0) + 1;
          }
        });
        setStatusCounts(counts);

        // Process sender information from contactsData
        const contactsWithSender = contactsData.map((contact: any) => {
          // Handle Supabase join response - sender might be an array or object
          const sender = Array.isArray(contact.sender) 
            ? (contact.sender.length > 0 ? contact.sender[0] : null)
            : contact.sender;
          
          return {
            ...contact,
            sender: sender || null
          };
        });

        // Fetch people data
        const personIds = contactsWithSender.map(contact => contact.person_id).filter(Boolean);
        
        if (personIds.length === 0) {
          const contactsWithSteps = contactsWithSender.map((contact: any) => ({
            ...contact,
            person: null,
            step: stepsMap.get(contact.sequence_step_id) || null
          }));
          setContacts(contactsWithSteps);
          return;
        }

        const { data: peopleData, error: peopleError } = await supabase
          .from('people')
          .select(`
            id,
            first_name,
            last_name,
            email,
            phone,
            photo_url,
            company_name,
            title,
            company:companies(
              id,
              name
            )
          `)
          .in('id', personIds);

        if (peopleError) {
          console.error("Error fetching people data:", peopleError);
          const contactsWithSteps = contactsWithSender.map((contact: any) => ({
            ...contact,
            person: null,
            step: stepsMap.get(contact.sequence_step_id) || null
          }));
          setContacts(contactsWithSteps);
          return;
        }

        // Map people data to contacts
        const peopleMap = new Map((peopleData || []).map(person => [person.id, person]));
        
        // Fetch step completions for all contacts to find next step
        // Note: status and sequence_people_id are now in sequence_steps_people_join, not sequence_steps_join
        const contactIds = contactsWithSender.map(contact => contact.id).filter(Boolean);
        const stepCompletionsMap = new Map<string, any[]>();
        
        if (contactIds.length > 0) {
          const { data: stepCompletionsData } = await supabase
            .from('sequence_steps_people_join')
            .select(`
              id,
              sequence_people_id,
              status,
              scheduled_for,
              sequence_step_join_id,
              sequence_step_join:sequence_steps_join(
                id,
                step_index
              )
            `)
            .in('sequence_people_id', contactIds);
          
          if (stepCompletionsData) {
            stepCompletionsData.forEach((completion: any) => {
              const contactId = completion.sequence_people_id;
              if (!stepCompletionsMap.has(contactId)) {
                stepCompletionsMap.set(contactId, []);
              }
              // Handle Supabase join response - sequence_step_join might be an array or object
              const stepJoin = Array.isArray(completion.sequence_step_join) 
                ? (completion.sequence_step_join.length > 0 ? completion.sequence_step_join[0] : null)
                : completion.sequence_step_join;
              
              stepCompletionsMap.get(contactId)!.push({
                id: stepJoin?.id || completion.sequence_step_join_id,
                step_index: stepJoin?.step_index,
                status: completion.status,
                scheduled_for: completion.scheduled_for ?? null
              });
            });
          }
        }
        
        // Find next step for each contact (merge step info with scheduled_for from join)
        const contactsWithPeople = contactsWithSender.map((contact: any) => {
          let nextStep = null;
          
          // Get all steps for this contact
          const contactSteps = stepCompletionsMap.get(contact.id) || [];
          
          // Filter out completed steps and find the lowest indexed one
          const incompleteSteps = contactSteps
            .filter((stepCompletion: any) => stepCompletion.status !== 'completed')
            .sort((a: any, b: any) => a.step_index - b.step_index);
          
          if (incompleteSteps.length > 0) {
            const nextStepJoin = incompleteSteps[0];
            const baseStep = stepsMap.get(nextStepJoin.id) || null;
            if (baseStep) {
              nextStep = { ...baseStep, scheduled_for: nextStepJoin.scheduled_for ?? null };
            }
          }
          
          // Fallback to sequence_step_id (e.g. no join row yet); no scheduled_for
          if (!nextStep) {
            const fallback = stepsMap.get(contact.sequence_step_id);
            if (fallback) nextStep = { ...fallback, scheduled_for: null };
          }
          
          return {
            ...contact,
            person: peopleMap.get(contact.person_id) || null,
            step: nextStep || stepsMap.get(contact.sequence_step_id) || null
          };
        });

        setContacts(contactsWithPeople);
      } catch (error) {
        console.error("Error fetching sequence contacts:", error);
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };

    if (sequenceId) {
      fetchContacts();
    }
  }, [sequenceId]);

  // Filter and paginate contacts
  useEffect(() => {
    let filtered = [...contacts];

    // Apply status filter
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'replied') {
        filtered = filtered.filter(contact => contact.is_replied);
      } else if (selectedStatus === 'in_progress') {
        filtered = filtered.filter(contact => contact.status === 'active');
      } else if (selectedStatus === 'no_response') {
        filtered = filtered.filter(contact => contact.outcome === 'no_response');
      } else if (selectedStatus === 'paused') {
        filtered = filtered.filter(contact => contact.status === 'paused');
      } else if (selectedStatus === 'interested') {
        filtered = filtered.filter(contact => contact.outcome === 'interested');
      } else if (selectedStatus === 'future_opportunity') {
        filtered = filtered.filter(contact => contact.outcome === 'future_opportunity');
      } else if (selectedStatus === 'undeliverable') {
        filtered = filtered.filter(contact => contact.outcome === 'undeliverable');
      } else {
        filtered = filtered.filter(contact =>
          contact.status?.toLowerCase() === selectedStatus
        );
      }
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(contact => {
        const name = contact.person
          ? `${contact.person.first_name || ''} ${contact.person.last_name || ''}`.trim()
          : '';
        const email = contact.person?.email || '';
        const company =
          (contact.person as any)?.company?.name ||
          contact.person?.company_name ||
          '';
        const title = contact.person?.title || '';
        
        return (
          name.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower) ||
          company.toLowerCase().includes(searchLower) ||
          title.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by last activity (created_at for now)
    filtered.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    setFilteredContacts(filtered);

    const pages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setTotalPages(pages);
  }, [contacts, selectedStatus, searchTerm]);

  // Clamp page when filter results shrink (e.g. fewer pages than current)
  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredContacts.length / ITEMS_PER_PAGE));
    setCurrentPage((p) => (p > pages ? pages : p));
  }, [filteredContacts.length]);

  // Get paginated contacts
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatScheduledFor = (dateString: string | null | undefined) => {
    if (!dateString) return "TBD";
    try {
      return format(new Date(dateString), "MMM d, h:mm a");
    } catch {
      return "TBD";
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(new Set(paginatedContacts.map(c => c.id)));
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    const newSelected = new Set(selectedContacts);
    if (checked) {
      newSelected.add(contactId);
    } else {
      newSelected.delete(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const updateContactStatus = async (status: string) => {
    if (selectedContacts.size === 0) {
      return;
    }

    const contactIds = Array.from(selectedContacts);
    
    try {
      // Update status in Supabase
      const { error } = await supabase
        .from('sequence_people')
        .update({ status })
        .in('id', contactIds);

      if (error) {
        console.error("Error updating contact status:", error);
        return;
      }

      // Update local state
      const updatedContacts = contacts.map(contact => 
        selectedContacts.has(contact.id) 
          ? { ...contact, status }
          : contact
      );
      setContacts(updatedContacts);

      // Recalculate status counts
      const counts: Record<string, number> = { all: updatedContacts.length };
      updatedContacts.forEach((contact) => {
        const contactStatus = contact.status?.toLowerCase() || 'cold';
        counts[contactStatus] = (counts[contactStatus] || 0) + 1;
        
        if (contact.is_replied) {
          counts['replied'] = (counts['replied'] || 0) + 1;
        }
        
        if (contact.status === 'active' || contact.status === 'paused') {
          counts['in_progress'] = (counts['in_progress'] || 0) + 1;
        }

        if (contact.outcome === 'no_response') {
          counts['no_response'] = (counts['no_response'] || 0) + 1;
        }
      });
      setStatusCounts(counts);

      // Clear selection
      setSelectedContacts(new Set());
    } catch (error) {
      console.error("Error updating contact status:", error);
    }
  };

  const handleStop = () => {
    updateContactStatus('completed');
  };

  const handlePause = () => {
    updateContactStatus('paused');
  };

  const handleResume = () => {
    updateContactStatus('active');
  };

  const selectedContactsForOutcome = contacts.filter((c) => selectedContacts.has(c.id));

  const recalculateStatusCounts = (updatedContacts: SequenceContact[]) => {
    const counts: Record<string, number> = { all: updatedContacts.length };
    updatedContacts.forEach((contact) => {
      const contactStatus = contact.status?.toLowerCase() || "cold";
      counts[contactStatus] = (counts[contactStatus] || 0) + 1;

      if (contact.is_replied) {
        counts["replied"] = (counts["replied"] || 0) + 1;
      }

      if (contact.status === "active") {
        counts["in_progress"] = (counts["in_progress"] || 0) + 1;
      }

      if (contact.outcome === "no_response") {
        counts["no_response"] = (counts["no_response"] || 0) + 1;
      }

      if (contact.outcome === "interested") {
        counts["interested"] = (counts["interested"] || 0) + 1;
      }

      if (contact.outcome === "future_opportunity") {
        counts["future_opportunity"] = (counts["future_opportunity"] || 0) + 1;
      }

      if (contact.outcome === "undeliverable") {
        counts["undeliverable"] = (counts["undeliverable"] || 0) + 1;
      }
    });
    setStatusCounts(counts);
  };

  const handleOutcomeSaved = (contactIds: string[], outcome: string | null) => {
    const idSet = new Set(contactIds);
    setContacts((prev) => {
      const updated = prev.map((contact) =>
        idSet.has(contact.id) ? { ...contact, outcome } : contact,
      );
      recalculateStatusCounts(updated);
      return updated;
    });
    setSelectedContacts(new Set());
  };

  const handleDelete = async () => {
    if (selectedContacts.size === 0) {
      return;
    }

    const contactIds = Array.from(selectedContacts);
    
    try {
      setIsDeleting(true);
      
      // Delete contacts from sequence_people table
      const { error } = await supabase
        .from('sequence_people')
        .delete()
        .in('id', contactIds);

      if (error) {
        console.error("Error deleting contacts:", error);
        return;
      }

      // Update local state - remove deleted contacts
      const updatedContacts = contacts.filter(contact => !selectedContacts.has(contact.id));
      setContacts(updatedContacts);

      // Recalculate status counts
      const counts: Record<string, number> = { all: updatedContacts.length };
      updatedContacts.forEach((contact) => {
        const contactStatus = contact.status?.toLowerCase() || 'cold';
        counts[contactStatus] = (counts[contactStatus] || 0) + 1;
        
        if (contact.is_replied) {
          counts['replied'] = (counts['replied'] || 0) + 1;
        }
        
        if (contact.status === 'active' || contact.status === 'paused') {
          counts['in_progress'] = (counts['in_progress'] || 0) + 1;
        }

        if (contact.outcome === 'no_response') {
          counts['no_response'] = (counts['no_response'] || 0) + 1;
        }
      });
      setStatusCounts(counts);

      // Clear selection
      setSelectedContacts(new Set());
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Error deleting contacts:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusTagColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'finished':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'active':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cold':
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
      case 'unresponsive':
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const totalItems = filteredContacts.length;

  const handleSenderChange = async (contactId: string, newSenderId: string) => {
    try {
      const { error } = await supabase
        .from('sequence_people')
        .update({ sender_id: newSenderId })
        .eq('id', contactId);

      if (error) {
        console.error("Error updating sender:", error);
        return;
      }

      setContacts(prev =>
        prev.map(c =>
          c.id === contactId
            ? {
                ...c,
                sender: c.sender && c.sender.id === newSenderId
                  ? c.sender
                  : {
                      id: newSenderId,
                      first_name: c.sender?.first_name ?? null,
                      last_name: c.sender?.last_name ?? null,
                      avatar_url: c.sender?.avatar_url ?? null,
                    },
                sender_id: newSenderId,
              }
            : c
        )
      );
    } catch (err) {
      console.error("Error updating sender:", err);
    }
  };

  const handleOutcomeChange = async (contactId: string, outcome: string | null) => {
    try {
      const { error } = await supabase
        .from("sequence_people")
        .update({ outcome })
        .eq("id", contactId);

      if (error) {
        console.error("Error updating contact outcome:", error);
        return;
      }

      setContacts((prev) => {
        const updated = prev.map((contact) =>
          contact.id === contactId ? { ...contact, outcome } : contact,
        );
        recalculateStatusCounts(updated);
        return updated;
      });
    } catch (err) {
      console.error("Error updating contact outcome:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Status filter skeleton */}
        <div className="flex-shrink-0 px-8 pb-1 pt-3">
          <div className="overflow-x-auto scrollbar-hide px-0.5 py-1.5">
            <div className={CONTACTS_FILTER_TRACK}>
              {STATUS_CATEGORIES.map((category) => (
                <div
                  key={category.key}
                  className="flex min-w-0 items-center justify-center p-0"
                >
                  <div className={cn(CONTACTS_FILTER_INNER, "animate-pulse bg-neutral-100/80")}>
                    <div className="h-4 w-7 rounded-full bg-neutral-200/90" />
                    <div className="h-2 w-10 max-w-full rounded-full bg-neutral-200/80" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar Skeleton */}
        <div className="flex-shrink-0 px-8 pt-1.5 pb-0">
          <div className="flex min-h-10 items-center gap-2 min-w-0">
            <div className="pl-6 flex min-h-10 shrink-0 items-center min-w-[5.5rem]">
              <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 min-w-0 pt-4 pb-4">
            <div className="relative flex-1 min-w-0 max-w-sm">
              <div className="w-full h-8 bg-neutral-200 animate-pulse border-b border-neutral-200" />
            </div>
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <div className="h-8 w-8 rounded-lg bg-neutral-200 animate-pulse" />
              <div className="h-3 w-24 bg-neutral-200 rounded animate-pulse" />
              <div className="h-8 w-8 rounded-lg bg-neutral-200 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Table Skeleton - architecture style */}
        {/* Table body scrolls; thead sticks within this region */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-none px-8 pb-8">
          <table className="w-full text-sm min-w-[940px]">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                <th className="w-10 pb-3 bg-gray-50" />
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[260px]">Contact</th>
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[190px]">Step</th>
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[170px]">Status</th>
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[160px]">Outcome</th>
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[150px]">Sender</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(12)].map((_, i) => (
                <tr key={i} className="border-b border-neutral-50">
                  <td className="py-4 pr-2 w-10 align-middle"><div className="mx-auto box-border h-4 w-4 rounded-full border border-neutral-300 bg-neutral-100 animate-pulse" /></td>
                  <td className="py-4 pr-4"><div className="flex flex-col gap-1"><div className="h-3 w-28 bg-neutral-100 rounded animate-pulse" /><div className="h-2.5 w-20 bg-neutral-100 rounded animate-pulse" /></div></td>
                  <td className="py-4 pr-4"><div className="h-3 w-16 bg-neutral-100 rounded animate-pulse" /></td>
                  <td className="py-4 pr-4"><div className="h-3 w-14 bg-neutral-100 rounded animate-pulse" /></td>
                  <td className="py-4 pr-4"><div className="h-3 w-24 bg-neutral-100 rounded animate-pulse" /></td>
                  <td className="py-4 pr-4"><div className="h-3 w-20 bg-neutral-100 rounded animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Status filter — segmented control (matches agents/projects/timeline toggles) */}
      <div className="flex-shrink-0 px-8 pb-1 pt-3">
        <div className="overflow-x-auto scrollbar-hide px-0.5 py-1.5">
          <div
            className={CONTACTS_FILTER_TRACK}
            role="tablist"
            aria-label="Filter contacts by status"
          >
              {STATUS_CATEGORIES.map((category) => {
                const count = statusCounts[category.key] || 0;
                const isActive = selectedStatus === category.key;
                return (
                  <button
                    key={category.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    title={category.label}
                    onClick={() => {
                      setSelectedStatus(category.key);
                      setCurrentPage(1);
                    }}
                    className="group flex min-w-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div
                      className={cn(
                        CONTACTS_FILTER_INNER,
                        isActive ? CONTACTS_FILTER_ACTIVE : CONTACTS_FILTER_INACTIVE,
                      )}
                    >
                      <span className="text-sm font-semibold tabular-nums leading-none">
                        {count}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 w-full max-w-full truncate px-0.5 text-center text-[8.5px] font-light uppercase leading-none tracking-wider whitespace-nowrap sm:text-[9.5px]",
                          isActive ? "text-neutral-700" : "text-neutral-500",
                        )}
                      >
                        {category.label}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Toolbar: actions row, then search + pagination (ledger pattern) */}
      <div className="flex-shrink-0 px-8 pt-1 pb-0">
        <div className="flex min-h-10 items-center gap-2 min-w-0">
          <div className="pl-6 flex min-h-10 shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                if (selectedContacts.size > 0) {
                  setSelectedContacts(new Set());
                } else {
                  handleSelectAll(true);
                }
              }}
              disabled={
                paginatedContacts.length === 0 && selectedContacts.size === 0
              }
              className={cn(
                "text-sm font-light transition-colors",
                selectedContacts.size > 0
                  ? "text-red-600 hover:text-red-700 focus-visible:ring-red-500/35"
                  : "text-kenoo-sky hover:opacity-90 focus-visible:ring-kenoo-sky/35",
                "disabled:opacity-40 disabled:pointer-events-none",
                "bg-transparent border-0 p-0 shadow-none cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-sm"
              )}
            >
              {selectedContacts.size > 0 ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="flex min-h-10 shrink-0 items-center">
            <AnimatePresence initial={false}>
              {selectedContacts.size > 0 && (
                <motion.div
                  key="sequence-contacts-bulk-actions"
                  className="ml-4 flex min-h-10 items-center"
                initial={{ opacity: 0, x: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 14, filter: "blur(6px)" }}
                transition={{
                  duration: 0.38,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <TooltipProvider delayDuration={1000}>
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className={SEQUENCE_CONTACTS_ACTION_BUTTON_CLASS}
                        onClick={handleStop}
                        disabled={selectedContacts.size === 0}
                      >
                        <div className="relative">
                          <div className={SEQUENCE_CONTACTS_ACTION_ICON_WRAP}>
                            <Square className={SEQUENCE_CONTACTS_ACTION_ICON_CLASS} />
                          </div>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Stop</p>
                    </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className={SEQUENCE_CONTACTS_ACTION_BUTTON_CLASS}
                        onClick={handlePause}
                        disabled={selectedContacts.size === 0}
                      >
                        <div className="relative">
                          <div className={SEQUENCE_CONTACTS_ACTION_ICON_WRAP}>
                            <Pause className={SEQUENCE_CONTACTS_ACTION_ICON_CLASS} />
                          </div>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pause</p>
                    </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className={SEQUENCE_CONTACTS_ACTION_BUTTON_CLASS}
                        onClick={handleResume}
                        disabled={selectedContacts.size === 0}
                      >
                        <div className="relative">
                          <div className={SEQUENCE_CONTACTS_ACTION_ICON_WRAP}>
                            <Play className={SEQUENCE_CONTACTS_ACTION_ICON_CLASS} />
                          </div>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Resume</p>
                    </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className={SEQUENCE_CONTACTS_ACTION_BUTTON_CLASS}
                        onClick={() => setShowOutcomePopup(true)}
                        disabled={selectedContacts.size === 0}
                      >
                        <div className="relative">
                          <div className={SEQUENCE_CONTACTS_ACTION_ICON_WRAP}>
                            <Activity className={SEQUENCE_CONTACTS_ACTION_ICON_CLASS} />
                          </div>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Outcome</p>
                    </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className={SEQUENCE_CONTACTS_ACTION_BUTTON_CLASS}
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={selectedContacts.size === 0}
                      >
                        <div className="relative">
                          <div className={SEQUENCE_CONTACTS_ACTION_ICON_WRAP}>
                            <Trash2 className={SEQUENCE_CONTACTS_ACTION_ICON_CLASS} />
                          </div>
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete</p>
                    </TooltipContent>
                  </Tooltip>
                  </div>
                </TooltipProvider>
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 min-w-0 pt-4 pb-4">
          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search contacts"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={cn(
                "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
                searchTerm ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200",
                "focus:border-b-[var(--kenoo-sky)]"
              )}
            />
          </div>

          {totalItems > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-neutral-400 font-light whitespace-nowrap tabular-nums min-w-[7.5rem] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table body scrolls; thead sticks within this region */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-none px-8 pb-8">
        <table className="w-full text-sm min-w-[940px]">
          <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
            <tr>
              <th className="w-10 pb-3 bg-gray-50" />
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[260px]">
                Contact
              </th>
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[190px]">
                Step
              </th>
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[170px]">
                Status
              </th>
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[160px]">
                Outcome
              </th>
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[150px]">
                Sender
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-neutral-400 font-light">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-7 w-7 text-neutral-300" />
                    <span>No contacts match your filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact) => {
                const personName = contact.person
                  ? `${contact.person.first_name || ''} ${contact.person.last_name || ''}`.trim() || contact.person.email || 'Unknown'
                  : 'Unknown';
                return (
                  <tr
                    key={contact.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50/60 cursor-pointer"
                  >
                    <td className="py-4 pr-2 w-10 align-middle" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        indicator="dot"
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={(checked) => handleSelectContact(contact.id, checked === true)}
                      />
                    </td>
                    <td className="py-4 pr-4 w-[260px]">
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span className="text-neutral-700 font-light text-xs truncate max-w-[200px]">{personName}</span>
                        {(
                          (contact.person as any)?.company?.name ||
                          contact.person?.company_name
                        ) && (
                          <span className="text-[10px] text-neutral-400 font-light truncate max-w-[200px]">
                            {(contact.person as any)?.company?.name || contact.person?.company_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 pr-4 w-[190px]">
                      {contact.step ? (
                        <div className="flex flex-col">
                          <span className="text-neutral-700 font-light text-xs">
                            Step {contact.step.step_index + 1}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-light mt-0.5">
                            {formatScheduledFor(contact.step.scheduled_for)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <span className="text-neutral-700 font-light text-xs capitalize">{contact.status || 'Cold'}</span>
                    </td>
                    <td className="py-4 pr-4 w-[160px]">
                      <SequenceContactOutcomeSelect
                        value={contact.outcome}
                        onValueChange={(outcome) => handleOutcomeChange(contact.id, outcome)}
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <SenderSearch
                        value={contact.sender_id}
                        onValueChange={(value) => handleSenderChange(contact.id, value)}
                        className="h-8"
                        showEmailInTrigger={false}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeletePopup
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        isSubmitting={isDeleting}
      />

      <SequenceContactOutcomePopup
        open={showOutcomePopup}
        onClose={() => setShowOutcomePopup(false)}
        contacts={selectedContactsForOutcome}
        onSaved={handleOutcomeSaved}
      />
    </div>
  );
}
