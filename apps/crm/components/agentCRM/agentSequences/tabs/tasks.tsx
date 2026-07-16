"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from '@supabase/supabase-js';
import { format } from "date-fns";
import { Search, Play, SkipForward, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/agentCRM/agentSequences/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/app/auth/AuthContext";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TasksProps {
  sequenceId: string;
}

interface TaskItem {
  id: string;
  sequence_people_id: string;
  status: string;
  scheduled_for: string | null;
  completed_at: string | null;
  created_at: string;
  sequence_step_join_id: string;
  step_join?: {
    id: string;
    step_index: number;
    step?: {
      id: string;
      name: string;
      description: string | null;
      is_task: boolean;
      channel: string;
    } | null;
  } | null;
  person?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    photo_url: string | null;
    title: string | null;
    company_id: string | null;
    company?: {
      id: string;
      name: string | null;
    } | null;
  } | null;
}

const ITEMS_PER_PAGE = 50;

/** Matches agent CRM table toolbars (e.g. people-table-toolbar). */
const ACTION_BUTTON_CLASS =
  "w-10 h-10 p-0 text-slate-600 hover:bg-transparent flex items-center justify-center shadow-none relative group flex-shrink-0";
const ACTION_ICON_WRAP = cn(
  "relative z-10 p-3 rounded-full transition-all duration-300 ease-in-out",
  "group-hover:bg-gray-50 group-hover:border group-hover:border-neutral-200 group-hover:shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] group-hover:scale-95"
);
const ACTION_ICON_CLASS = "h-[18px] w-[18px] stroke-[1.5] text-neutral-500";

export default function Tasks({ sequenceId }: TasksProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [isCompleting, setIsCompleting] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    if (!sequenceId) {
      return;
    }

    try {
      setLoading(true);

      const { data: sequencePeopleData } = await supabase
        .from('sequence_people')
        .select('id')
        .eq('sequence_id', sequenceId);

      if (!sequencePeopleData || sequencePeopleData.length === 0) {
        setTasks([]);
        return;
      }

      const sequencePeopleIds = sequencePeopleData.map(sp => sp.id);

      const { data: tasksData, error: tasksError } = await supabase
        .from('sequence_steps_people_join')
        .select(`
          id,
          sequence_people_id,
          status,
          scheduled_for,
          completed_at,
          created_at,
          sequence_step_join_id,
          sequence_step_join:sequence_steps_join(
            id,
            step_index,
            step:sequence_steps(
              id,
              name,
              description,
              is_task,
              channel
            )
          ),
          sequence_people:sequence_people!inner(
            id,
            person_id,
            person:people(
              id,
              first_name,
              last_name,
              email,
              photo_url,
              title,
              company_id,
              company:companies(
                id,
                name
              )
            )
          )
        `)
        .eq('status', 'scheduled')
        .in('sequence_people_id', sequencePeopleIds)
        .order('scheduled_for', { ascending: true, nullsFirst: false });

      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        setTasks([]);
        return;
      }

      const formattedTasks: TaskItem[] = [];

      if (tasksData) {
        for (const item of tasksData) {
          const stepJoin = Array.isArray(item.sequence_step_join)
            ? (item.sequence_step_join.length > 0 ? item.sequence_step_join[0] : null)
            : item.sequence_step_join;

          const step = stepJoin?.step
            ? (Array.isArray(stepJoin.step) ? stepJoin.step[0] : stepJoin.step)
            : null;

          if (step?.is_task === true) {
            const sequencePeople = Array.isArray(item.sequence_people)
              ? (item.sequence_people.length > 0 ? item.sequence_people[0] : null)
              : item.sequence_people;

            const personData = sequencePeople?.person
              ? (Array.isArray(sequencePeople.person) ? sequencePeople.person[0] : sequencePeople.person)
              : null;

            let person = null;
            if (personData) {
              const company = personData.company
                ? (Array.isArray(personData.company) ? personData.company[0] : personData.company)
                : null;

              person = {
                id: personData.id,
                first_name: personData.first_name,
                last_name: personData.last_name,
                email: personData.email,
                photo_url: personData.photo_url,
                title: personData.title,
                company_id: personData.company_id,
                company: company || null
              };
            }

            formattedTasks.push({
              id: item.id,
              sequence_people_id: item.sequence_people_id,
              status: item.status,
              scheduled_for: item.scheduled_for,
              completed_at: item.completed_at,
              created_at: item.created_at,
              sequence_step_join_id: item.sequence_step_join_id,
              step_join: stepJoin ? {
                id: stepJoin.id,
                step_index: stepJoin.step_index || 0,
                step: step
              } : null,
              person: person
            });
          }
        }
      }

      setTasks(formattedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [sequenceId]);

  useEffect(() => {
    if (sequenceId) {
      fetchTasks();
    }
  }, [sequenceId, fetchTasks]);

  // Filter and paginate tasks
  useEffect(() => {
    let filtered = [...tasks];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(task => {
        const name = task.person
          ? `${task.person.first_name || ''} ${task.person.last_name || ''}`.trim()
          : '';
        const email = task.person?.email || '';
        const company = task.person?.company?.name || '';
        const title = task.person?.title || '';
        const taskName = task.step_join?.step?.name || '';

        return (
          name.toLowerCase().includes(searchLower) ||
          email.toLowerCase().includes(searchLower) ||
          company.toLowerCase().includes(searchLower) ||
          title.toLowerCase().includes(searchLower) ||
          taskName.toLowerCase().includes(searchLower)
        );
      });
    }

    filtered.sort((a, b) => {
      const aTime = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
      const bTime = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
      return aTime - bTime;
    });

    setFilteredTasks(filtered);

    const pages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setTotalPages(pages);
  }, [tasks, searchTerm]);

  // Clamp page when filter results shrink
  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredTasks.length / ITEMS_PER_PAGE));
    setCurrentPage((p) => (p > pages ? pages : p));
  }, [filteredTasks.length]);

  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch {
      return dateString || "—";
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

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}` || '?';
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(paginatedTasks.map(t => t.id)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks);
    if (checked) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleCompleteTasks = async () => {
    if (selectedTasks.size === 0) {
      return;
    }

    const taskIds = Array.from(selectedTasks);
    const selectedTasksData = tasks.filter(task => selectedTasks.has(task.id));

    console.log("[Tasks] Starting handleCompleteTasks", {
      taskCount: taskIds.length,
      sequenceId,
      userEmail: user?.email
    });

    try {
      setIsCompleting(true);

      let agentId: string | null = null;
      if (user?.email) {
        console.log("[Tasks] Fetching agent_id for email:", user.email);
        const { data: agent, error: agentError } = await supabase
          .from('team')
          .select('id')
          .eq('email', user.email)
          .limit(1)
          .single();

        if (agentError) {
          console.error("[Tasks] Error fetching agent_id:", agentError);
        } else if (agent) {
          agentId = agent.id;
          console.log("[Tasks] Found agent_id:", agentId);
        } else {
          console.warn("[Tasks] No agent found for email:", user.email);
        }
      } else {
        console.warn("[Tasks] No user email available");
      }

      console.log("[Tasks] Fetching talents for sequence:", sequenceId);
      const { data: sequenceTalents, error: talentsError } = await supabase
        .from('sequence_talent')
        .select('talent_id')
        .eq('sequence_id', sequenceId);

      if (talentsError) {
        console.error("[Tasks] Error fetching sequence talents:", talentsError);
      }

      const talentIds = sequenceTalents?.map(st => st.talent_id) || [];
      console.log("[Tasks] Found talent IDs:", talentIds);

      const { error } = await supabase
        .from('sequence_steps_people_join')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .in('id', taskIds);

      if (error) {
        console.error("Error completing tasks:", error);
        wallsToast.error("Error", "Failed to complete tasks");
        return;
      }

      for (const task of selectedTasksData) {
        try {
          console.log("[Tasks] Processing task:", {
            taskId: task.id,
            sequencePeopleId: task.sequence_people_id,
            personId: task.person?.id,
            personEmail: task.person?.email,
            companyId: task.person?.company_id,
            stepChannel: task.step_join?.step?.channel
          });

          console.log("[Tasks] Checking for existing pitch with sequence_people_id:", task.sequence_people_id);
          const { data: existingPitch, error: checkError } = await supabase
            .from('pitches')
            .select('id')
            .eq('sequence_people_id', task.sequence_people_id)
            .maybeSingle();

          if (checkError) {
            console.error("[Tasks] Error checking for existing pitch:", checkError);
          }

          let pitchId: string;

          if (existingPitch) {
            pitchId = existingPitch.id;
            console.log("[Tasks] Using existing pitch:", pitchId);
          } else {
            const channel = task.step_join?.step?.channel || 'email';
            const companyWebsite = task.person?.email ? extractCompanyWebsite(task.person.email) : null;

            const pitchUuid = crypto.randomUUID();

            const pitchInsertData = {
              id: pitchUuid,
              provider_id: pitchUuid,
              provider: 'walls',
              person_id: task.person?.id || null,
              agent_id: agentId,
              company_id: task.person?.company_id || null,
              company_website: companyWebsite,
              timestamp: new Date().toISOString(),
              channel: channel,
              message: null,
              sequence_people_id: task.sequence_people_id,
            };

            console.log("[Tasks] Creating new pitch with data:", pitchInsertData);

            const { data: pitchData, error: pitchError } = await supabase
              .from('pitches')
              .insert(pitchInsertData)
              .select('id')
              .single();

            if (pitchError) {
              console.error("[Tasks] Error creating pitch - Full error object:", {
                error: pitchError,
                message: pitchError.message,
                details: pitchError.details,
                hint: pitchError.hint,
                code: pitchError.code,
                insertData: pitchInsertData
              });
              continue;
            }

            if (!pitchData) {
              console.error("[Tasks] No pitch data returned from insert");
              continue;
            }

            pitchId = pitchData.id;
            console.log("[Tasks] Successfully created pitch:", pitchId);
          }

          if (talentIds.length > 0) {
            console.log("[Tasks] Creating pitches_creators for pitch:", pitchId, "with talents:", talentIds);
            const { data: existingCreators, error: checkCreatorsError } = await supabase
              .from('pitches_creators')
              .select('talent_id')
              .eq('pitch_id', pitchId)
              .in('talent_id', talentIds);

            if (checkCreatorsError) {
              console.error("[Tasks] Error checking existing creators:", checkCreatorsError);
            }

            if (!checkCreatorsError && existingCreators) {
              const existingTalentIds = new Set(existingCreators.map(ec => ec.talent_id));
              const newTalentIds = talentIds.filter(tid => !existingTalentIds.has(tid));

              console.log("[Tasks] Existing creators:", Array.from(existingTalentIds), "New creators to add:", newTalentIds);

              if (newTalentIds.length > 0) {
                const pitchesCreatorsData = newTalentIds.map(talentId => ({
                  pitch_id: pitchId,
                  talent_id: talentId
                }));

                console.log("[Tasks] Inserting pitches_creators:", pitchesCreatorsData);
                const { error: creatorsError } = await supabase
                  .from('pitches_creators')
                  .insert(pitchesCreatorsData);

                if (creatorsError) {
                  console.error("[Tasks] Error creating pitches_creators:", creatorsError);
                } else {
                  console.log("[Tasks] Successfully created pitches_creators");
                }
              }
            } else {
              const pitchesCreatorsData = talentIds.map(talentId => ({
                pitch_id: pitchId,
                talent_id: talentId
              }));

              console.log("[Tasks] Inserting all pitches_creators (check failed):", pitchesCreatorsData);
              const { error: creatorsError } = await supabase
                .from('pitches_creators')
                .insert(pitchesCreatorsData);

              if (creatorsError) {
                console.error("[Tasks] Error creating pitches_creators:", creatorsError);
              } else {
                console.log("[Tasks] Successfully created pitches_creators");
              }
            }
          } else {
            console.log("[Tasks] No talent IDs to create pitches_creators");
          }

          const stepName = task.step_join?.step?.name;

          if (!stepName) {
            console.warn("[Tasks] No step name found for task:", task.id, "Skipping pitches_activities creation");
            continue;
          }

          console.log("[Tasks] Checking for existing pitches_activities for task:", task.id, "with activity_type:", stepName);
          const { data: existingActivity, error: checkActivityError } = await supabase
            .from('pitches_activities')
            .select('id')
            .eq('sequence_step_people_join_id', task.id)
            .eq('activity_type', stepName)
            .eq('activity_source', 'sequence')
            .maybeSingle();

          if (checkActivityError) {
            console.error("[Tasks] Error checking existing activity:", checkActivityError);
          }

          if (!existingActivity) {
            const channel = task.step_join?.step?.channel || 'email';
            const activityData = {
              pitch_id: pitchId,
              channel: channel,
              activity_type: stepName,
              activity_source: 'sequence',
              sequence_step_people_join_id: task.id,
            };

            console.log("[Tasks] Creating pitches_activities:", activityData);
            const { error: activityError } = await supabase
              .from('pitches_activities')
              .insert(activityData);

            if (activityError) {
              console.error("[Tasks] Error creating pitches_activities:", activityError);
            } else {
              console.log("[Tasks] Successfully created pitches_activities");
            }
          } else {
            console.log("[Tasks] Activity already exists, skipping");
          }

          try {
            const currentStepIndex = task.step_join?.step_index;
            const sequencePeopleId = task.sequence_people_id;

            if (currentStepIndex === undefined || currentStepIndex === null) {
              console.warn("[Tasks] Missing step_index for task:", task.id, "Skipping next step scheduling");
            } else {
              const nextStepIndex = currentStepIndex + 1;

              console.log("[Tasks] Finding next step for task:", task.id, "Next step index:", nextStepIndex);

              const { data: nextStepJoinData, error: nextStepError } = await supabase
                .from('sequence_steps_join')
                .select(`
                  id,
                  delay_minutes,
                  step_index,
                  step:sequence_steps(
                    id,
                    is_task
                  )
                `)
                .eq('sequence_id', sequenceId)
                .eq('step_index', nextStepIndex)
                .maybeSingle();

              if (nextStepError) {
                console.error("[Tasks] Error fetching next step:", nextStepError);
              } else if (!nextStepJoinData) {
                console.log("[Tasks] No next step exists for task:", task.id);
              } else {
                const step = Array.isArray(nextStepJoinData.step)
                  ? (nextStepJoinData.step.length > 0 ? nextStepJoinData.step[0] : null)
                  : nextStepJoinData.step;

                const isNextStepTask = step?.is_task === true;
                const nextStepJoinId = nextStepJoinData.id;
                const delayMinutes = nextStepJoinData.delay_minutes || 0;

                console.log("[Tasks] Next step info:", {
                  nextStepJoinId,
                  isNextStepTask,
                  delayMinutes
                });

                const { data: existingRecord, error: checkError2 } = await supabase
                  .from('sequence_steps_people_join')
                  .select('id, status')
                  .eq('sequence_people_id', sequencePeopleId)
                  .eq('sequence_step_join_id', nextStepJoinId)
                  .maybeSingle();

                if (checkError2) {
                  console.error("[Tasks] Error checking existing record:", checkError2);
                } else {
                  if (isNextStepTask) {
                    const now = new Date();
                    const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000);

                    console.log("[Tasks] Next step is a task, scheduling for:", scheduledFor.toISOString());

                    if (existingRecord) {
                      const { error: updateError } = await supabase
                        .from('sequence_steps_people_join')
                        .update({
                          status: 'scheduled',
                          scheduled_for: scheduledFor.toISOString()
                        })
                        .eq('id', existingRecord.id);

                      if (updateError) {
                        console.error("[Tasks] Error updating next task:", updateError);
                      } else {
                        console.log("[Tasks] Successfully updated next task to scheduled");
                      }
                    } else {
                      let senderId: string | null = null;
                      if (user?.id) {
                        const { data: userData, error: userError } = await supabase
                          .from('users')
                          .select('id')
                          .eq('auth_id', user.id)
                          .limit(1)
                          .single();

                        if (!userError && userData) {
                          senderId = userData.id;
                        }
                      }

                      if (!senderId) {
                        console.warn("[Tasks] Could not find sender_id, skipping task creation");
                      } else {
                        const { error: insertError } = await supabase
                          .from('sequence_steps_people_join')
                          .insert({
                            sequence_people_id: sequencePeopleId,
                            sequence_step_join_id: nextStepJoinId,
                            status: 'scheduled',
                            scheduled_for: scheduledFor.toISOString(),
                            sender_id: senderId,
                            sequence_step_index: nextStepIndex
                          });

                        if (insertError) {
                          console.error("[Tasks] Error creating next task:", insertError);
                        } else {
                          console.log("[Tasks] Successfully created next task");
                        }
                      }
                    }
                  } else {
                    console.log("[Tasks] Next step is not a task, setting to queued");

                    if (existingRecord) {
                      const { error: updateError } = await supabase
                        .from('sequence_steps_people_join')
                        .update({
                          status: 'queued'
                        })
                        .eq('id', existingRecord.id);

                      if (updateError) {
                        console.error("[Tasks] Error updating next step to queued:", updateError);
                      } else {
                        console.log("[Tasks] Successfully updated next step to queued");
                      }
                    } else {
                      let senderId: string | null = null;
                      if (user?.id) {
                        const { data: userData, error: userError } = await supabase
                          .from('users')
                          .select('id')
                          .eq('auth_id', user.id)
                          .limit(1)
                          .single();

                        if (!userError && userData) {
                          senderId = userData.id;
                        }
                      }

                      if (!senderId) {
                        console.warn("[Tasks] Could not find sender_id, skipping step creation");
                      } else {
                        const { error: insertError } = await supabase
                          .from('sequence_steps_people_join')
                          .insert({
                            sequence_people_id: sequencePeopleId,
                            sequence_step_join_id: nextStepJoinId,
                            status: 'queued',
                            sender_id: senderId,
                            sequence_step_index: nextStepIndex
                          });

                        if (insertError) {
                          console.error("[Tasks] Error creating next step:", insertError);
                        } else {
                          console.log("[Tasks] Successfully created next step as queued");
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (nextStepError) {
            console.error("[Tasks] Error handling next step for task:", task.id, "Full error:", nextStepError);
          }
        } catch (pitchError) {
          console.error("[Tasks] Error processing pitch for task:", task.id, "Full error:", pitchError);
        }
      }

      console.log("[Tasks] Completed processing all tasks");

      await fetchTasks();

      const updatedTasks = tasks.filter(task => !selectedTasks.has(task.id));
      setTasks(updatedTasks);

      setSelectedTasks(new Set());

      wallsToast.success("Success", `${taskIds.length} task${taskIds.length > 1 ? 's' : ''} marked as complete`);
    } catch (error) {
      console.error("Error completing tasks:", error);
      wallsToast.error("Error", "Failed to complete tasks");
    } finally {
      setIsCompleting(false);
    }
  };

  const extractCompanyWebsite = (email: string): string | null => {
    if (!email || !email.includes('@')) {
      return null;
    }
    const domain = email.split('@')[1];
    return `https://${domain}`;
  };

  const handleSkipTasks = async () => {
    if (selectedTasks.size === 0) {
      return;
    }

    const taskIds = Array.from(selectedTasks);
    const selectedTasksData = tasks.filter(task => selectedTasks.has(task.id));

    try {
      setIsCompleting(true);

      for (const task of selectedTasksData) {
        const currentStepIndex = task.step_join?.step_index;
        const sequencePeopleId = task.sequence_people_id;

        if (currentStepIndex === undefined || currentStepIndex === null) {
          console.error("Missing step_index for task:", task.id);
          continue;
        }

        const { error: completeError } = await supabase
          .from('sequence_steps_people_join')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (completeError) {
          console.error("Error completing task:", completeError);
          continue;
        }

        const nextStepIndex = currentStepIndex + 1;

        const { data: nextStepJoinData, error: nextStepError } = await supabase
          .from('sequence_steps_join')
          .select(`
            id,
            delay_minutes,
            step_index,
            step:sequence_steps(
              id,
              is_task
            )
          `)
          .eq('sequence_id', sequenceId)
          .eq('step_index', nextStepIndex)
          .maybeSingle();

        if (nextStepError) {
          console.error("Error fetching next step:", nextStepError);
          continue;
        }

        if (!nextStepJoinData) {
          continue;
        }

        const step = Array.isArray(nextStepJoinData.step)
          ? (nextStepJoinData.step.length > 0 ? nextStepJoinData.step[0] : null)
          : nextStepJoinData.step;

        const isNextStepTask = step?.is_task === true;
        const nextStepJoinId = nextStepJoinData.id;
        const delayMinutes = nextStepJoinData.delay_minutes || 0;

        const { data: existingRecord, error: checkError } = await supabase
          .from('sequence_steps_people_join')
          .select('id, status')
          .eq('sequence_people_id', sequencePeopleId)
          .eq('sequence_step_join_id', nextStepJoinId)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking existing record:", checkError);
          continue;
        }

        const now = new Date();
        const scheduledFor = new Date(now.getTime() + delayMinutes * 60 * 1000);

        if (isNextStepTask) {
          if (existingRecord) {
            const { error: updateError } = await supabase
              .from('sequence_steps_people_join')
              .update({
                status: 'scheduled',
                scheduled_for: scheduledFor.toISOString()
              })
              .eq('id', existingRecord.id);

            if (updateError) {
              console.error("Error updating next task:", updateError);
            }
          } else {
            const { error: insertError } = await supabase
              .from('sequence_steps_people_join')
              .insert({
                sequence_people_id: sequencePeopleId,
                sequence_step_join_id: nextStepJoinId,
                status: 'scheduled',
                scheduled_for: scheduledFor.toISOString()
              });

            if (insertError) {
              console.error("Error creating next task:", insertError);
            }
          }
        } else {
          if (existingRecord) {
            const { error: updateError } = await supabase
              .from('sequence_steps_people_join')
              .update({
                status: 'queued'
              })
              .eq('id', existingRecord.id);

            if (updateError) {
              console.error("Error updating next step:", updateError);
            }
          } else {
            const { error: insertError } = await supabase
              .from('sequence_steps_people_join')
              .insert({
                sequence_people_id: sequencePeopleId,
                sequence_step_join_id: nextStepJoinId,
                status: 'queued'
              });

            if (insertError) {
              console.error("Error creating next step:", insertError);
            }
          }
        }
      }

      await fetchTasks();

      setSelectedTasks(new Set());

      wallsToast.success("Success", `${taskIds.length} task${taskIds.length > 1 ? 's' : ''} skipped`);
    } catch (error) {
      console.error("Error skipping tasks:", error);
      wallsToast.error("Error", "Failed to skip tasks");
    } finally {
      setIsCompleting(false);
    }
  };

  const totalItems = filteredTasks.length;

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar Skeleton */}
        <div className="flex-shrink-0 px-8 pt-3 pb-0">
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

        {/* Table Skeleton */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-none px-8 pb-8">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
              <tr>
                <th className="w-10 pb-3 bg-gray-50" />
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[260px]">Task</th>
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[220px]">Contact</th>
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[200px]">Scheduled For</th>
                <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[120px]">Step</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-neutral-50">
                  <td className="py-4 pr-2 w-10 align-middle"><div className="mx-auto box-border h-4 w-4 rounded-full border border-neutral-300 bg-neutral-100 animate-pulse" /></td>
                  <td className="py-4 pr-4"><div className="h-3 w-28 bg-neutral-100 rounded animate-pulse" /></td>
                  <td className="py-4 pr-4"><div className="flex flex-col gap-1"><div className="h-3 w-24 bg-neutral-100 rounded animate-pulse" /><div className="h-2.5 w-16 bg-neutral-100 rounded animate-pulse" /></div></td>
                  <td className="py-4 pr-4"><div className="h-3 w-32 bg-neutral-100 rounded animate-pulse" /></td>
                  <td className="py-4 pr-4"><div className="h-3 w-12 bg-neutral-100 rounded animate-pulse" /></td>
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
      {/* Toolbar */}
      <div className="flex-shrink-0 px-8 pt-3 pb-0">
        <div className="flex min-h-10 items-center gap-2 min-w-0">
          <div className="pl-6 flex min-h-10 shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                if (selectedTasks.size > 0) {
                  setSelectedTasks(new Set());
                } else {
                  handleSelectAll(true);
                }
              }}
              disabled={paginatedTasks.length === 0 && selectedTasks.size === 0}
              className={cn(
                "text-sm font-light transition-colors",
                selectedTasks.size > 0
                  ? "text-red-600 hover:text-red-700 focus-visible:ring-red-500/35"
                  : "text-kenoo-sky hover:opacity-90 focus-visible:ring-kenoo-sky/35",
                "disabled:opacity-40 disabled:pointer-events-none",
                "bg-transparent border-0 p-0 shadow-none cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-sm"
              )}
            >
              {selectedTasks.size > 0 ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="flex min-h-10 shrink-0 items-center">
            <AnimatePresence initial={false}>
              {selectedTasks.size > 0 && (
                <motion.div
                  key="tasks-bulk-actions"
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
                            className={ACTION_BUTTON_CLASS}
                            onClick={handleCompleteTasks}
                            disabled={selectedTasks.size === 0 || isCompleting}
                          >
                            <div className="relative">
                              <div className={ACTION_ICON_WRAP}>
                                <Play className={ACTION_ICON_CLASS} />
                              </div>
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Execute</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className={ACTION_BUTTON_CLASS}
                            onClick={handleSkipTasks}
                            disabled={selectedTasks.size === 0 || isCompleting}
                          >
                            <div className="relative">
                              <div className={ACTION_ICON_WRAP}>
                                <SkipForward className={ACTION_ICON_CLASS} />
                              </div>
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Skip</p>
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
              placeholder="Search tasks"
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

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-none px-8 pb-8">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="sticky top-0 z-10 border-b border-neutral-100 bg-gray-50">
            <tr>
              <th className="w-10 pb-3 bg-gray-50" />
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[260px]">
                Task
              </th>
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[220px]">
                Contact
              </th>
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[200px]">
                Scheduled For
              </th>
              <th className="text-left pb-3 pr-4 font-medium text-neutral-400 text-xs uppercase tracking-wide whitespace-nowrap bg-gray-50 w-[120px]">
                Step
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-neutral-400 font-light">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-7 w-7 text-neutral-300" />
                    <span>No tasks scheduled.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTasks.map((task) => {
                const personName = task.person
                  ? `${task.person.first_name || ''} ${task.person.last_name || ''}`.trim() || task.person.email || 'Unknown'
                  : 'Unknown';
                const initials = task.person
                  ? getInitials(task.person.first_name, task.person.last_name)
                  : '?';

                return (
                  <tr
                    key={task.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50/60 cursor-pointer"
                  >
                    <td className="py-4 pr-2 w-10 align-middle" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        indicator="dot"
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={(checked) => handleSelectTask(task.id, checked === true)}
                      />
                    </td>
                    <td className="py-4 pr-4 w-[260px]">
                      <span className="text-neutral-700 font-light text-xs truncate max-w-[220px] block">
                        {task.step_join?.step?.name || '—'}
                      </span>
                    </td>
                    <td className="py-4 pr-4 w-[220px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200 overflow-hidden relative">
                          {task.person?.photo_url && !imageErrors.has(task.id) ? (
                            <Image
                              src={task.person.photo_url}
                              alt={personName}
                              width={28}
                              height={28}
                              className="rounded-full object-cover w-full h-full"
                              onError={() => {
                                setImageErrors(prev => new Set(prev).add(task.id));
                              }}
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-neutral-500">
                              {initials}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span className="text-neutral-700 font-light text-xs truncate max-w-[160px]">{personName}</span>
                          {task.person?.company?.name && (
                            <span className="text-[10px] text-neutral-400 font-light truncate max-w-[160px]">
                              {task.person.company.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 w-[200px]">
                      <span className="text-neutral-700 font-light text-xs">
                        {formatScheduledFor(task.scheduled_for)}
                      </span>
                    </td>
                    <td className="py-4 pr-4 w-[120px]">
                      {task.step_join ? (
                        <span className="text-neutral-700 font-light text-xs">
                          Step {task.step_join.step_index + 1}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Toaster />
    </div>
  );
}
