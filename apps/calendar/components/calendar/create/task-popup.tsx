"use client";


import { wallsToast } from "@/components/ui/walls-toast";
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogFooter,
  DialogPortal,
  DialogContent as DialogContentPrimitive,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Cross2Icon } from "@radix-ui/react-icons";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { TaskData, ScheduledTask, CalendarEvent } from "@/types/calendar.types";
import { GanttChartSquare, Paperclip } from "lucide-react";
import { useAuth } from "@walls/auth";
import { AssigneeDisplay } from "@/components/calendar/assignee-display";
import { DatePicker } from "@/components/ui/date-picker";
import { format, addDays, addMinutes } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@walls/supabase/client";
import { Toaster } from "@/components/ui/toaster";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-gray-50 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-3xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <Cross2Icon className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

interface TaskPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: TaskData, scheduledTasks: ScheduledTask[]) => void;
  events: CalendarEvent[];
  initialTask?: TaskData | null;
  isEditing?: boolean;
  scheduledTasks?: ScheduledTask[];
}

type TaskStatus = 'deferred' | 'todo' | 'inprogress' | 'complete';
type TaskPriority = 'low' | 'medium' | 'high';

interface FirestoreTaskData {
  name: string;
  description: string;
  project: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  duration: string;
  startDate: { toDate(): Date } | null;
  deadline: { toDate(): Date } | null;
  hardDeadline: boolean;
  schedule: string;
  labels: string[];
  scheduleStart: { toDate(): Date } | null;
  scheduleEnd: { toDate(): Date } | null;
  createdAt?: { toDate(): Date };
  updatedAt?: { toDate(): Date };
  createdBy?: string;
  eventType?: string;
}

export function TaskPopup({ isOpen, onClose, onSubmit, events, initialTask, isEditing, scheduledTasks }: TaskPopupProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [taskData, setTaskData] = useState<TaskData>({
    name: '',
    description: '',
    attachments: [],
    project: 'no-project',
    assignee: user?.id || '',
    status: 'todo',
    priority: 'medium',
    duration: '30',
    startDate: new Date(),
    deadline: addDays(new Date(), 7),
    hardDeadline: false,
    schedule: 'work',
    labels: [],
    scheduleStart: null,
    scheduleEnd: null,
    eventType: 'task'
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, display_name, photo_url, email')
          .neq('auth_id', user?.id || '');
        
        if (error) throw error;
        
        const usersData = (data || []).map((item: any) => ({
          uid: item.id,
          id: item.id,
          displayName: item.display_name,
          photoURL: item.photo_url,
          email: item.email
        }));
        
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    if (user?.id) {
      fetchUsers();
    }
  }, [user?.id]);

  // Initialize form with task data when editing
  useEffect(() => {
    if (initialTask && isEditing) {
      setTaskData(initialTask);
    } else {
      // Reset form when opening for new task
      setTaskData({
        name: '',
        description: '',
        attachments: [],
        project: 'no-project',
        assignee: user?.id || '',
        status: 'todo',
        priority: 'medium',
        duration: '30',
        startDate: new Date(),
        deadline: addDays(new Date(), 7),
        hardDeadline: false,
        schedule: 'work',
        labels: [],
        scheduleStart: null,
        scheduleEnd: null,
        eventType: 'task'
      });
    }
  }, [initialTask, isEditing, user?.id, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      wallsToast.error("Error", "You must be logged in to create a task");
      return;
    }

    try {
      setIsSubmitting(true);
      const supabase = createClient();
      let newTaskId = initialTask?.id;
      
      // Ensure all required fields have values
      const taskDataToSave: {
        name: string;
        description: string;
        project: string;
        assignee: string;
        status: TaskStatus;
        priority: TaskPriority;
        duration: string;
        startDate: Date;
        deadline: Date;
        hardDeadline: boolean;
        schedule: string;
        labels: string[];
        scheduleStart: Date | null;
        scheduleEnd: Date | null;
      } = {
        name: taskData.name || '',
        description: taskData.description || '',
        project: taskData.project || 'no-project',
        assignee: taskData.assignee || user.id,
        status: (taskData.status || "todo") as TaskStatus,
        priority: (taskData.priority || "medium") as TaskPriority,
        duration: taskData.duration || '30',
        startDate: taskData.startDate || new Date(),
        deadline: taskData.deadline || addDays(new Date(), 7),
        hardDeadline: taskData.hardDeadline || false,
        schedule: taskData.schedule || 'work',
        labels: taskData.labels || [],
        scheduleStart: taskData.scheduleStart,
        scheduleEnd: taskData.scheduleEnd
      };
      
      if (isEditing && initialTask?.id) {
        console.log('Editing task:', { taskId: initialTask.id, taskData: taskDataToSave });
        
        // Find the scheduled task for this task
        const scheduledTask = scheduledTasks?.find(st => st.taskId === initialTask.id);
        console.log('Found scheduled task:', scheduledTask);
        
        // If the task has a schedule, update the end time based on the new duration
        if (taskDataToSave.scheduleStart) {
          const newDuration = taskData.duration === 'reminder' ? 15 : parseInt(taskData.duration);
          const newEndTime = addMinutes(new Date(taskDataToSave.scheduleStart), newDuration);
          
          // Update taskDataToSave with new schedule end time
          taskDataToSave.scheduleEnd = newEndTime;
          console.log('Updating scheduled end time:', {
            startTime: taskDataToSave.scheduleStart,
            newDuration,
            newEndTime,
            taskDataToSave
          });

          // If there's a scheduled task, update its end time as well
          if (scheduledTask) {
            scheduledTask.endTime = newEndTime;
          }
        }

        // Update existing task in Supabase
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            name: taskDataToSave.name,
            description: taskDataToSave.description,
            project: taskDataToSave.project,
            assignee: taskDataToSave.assignee,
            status: taskDataToSave.status,
            priority: taskDataToSave.priority,
            duration: taskDataToSave.duration,
            start_date: taskDataToSave.startDate.toISOString(),
            deadline: taskDataToSave.deadline.toISOString(),
            hard_deadline: taskDataToSave.hardDeadline,
            schedule: taskDataToSave.schedule,
            labels: taskDataToSave.labels,
            schedule_start: taskDataToSave.scheduleStart?.toISOString() || null,
            schedule_end: taskDataToSave.scheduleEnd?.toISOString() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', initialTask.id);

        if (updateError) throw updateError;

        newTaskId = initialTask.id;
      } else {
        console.log('Creating new task:', taskDataToSave);
        
        // Create new task in Supabase
        const { data: newTask, error: insertError } = await supabase
          .from('tasks')
          .insert({
            name: taskDataToSave.name,
            description: taskDataToSave.description,
            project: taskDataToSave.project,
            assignee: taskDataToSave.assignee,
            status: taskDataToSave.status,
            priority: taskDataToSave.priority,
            duration: taskDataToSave.duration,
            start_date: taskDataToSave.startDate.toISOString(),
            deadline: taskDataToSave.deadline.toISOString(),
            hard_deadline: taskDataToSave.hardDeadline,
            schedule: taskDataToSave.schedule,
            labels: taskDataToSave.labels,
            schedule_start: null,
            schedule_end: null,
            event_type: taskData.eventType || 'task',
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        
        newTaskId = newTask.id;
      }

      if (newTaskId) {
        // Pass the created/updated task back with its scheduled tasks
        const relevantScheduledTasks = scheduledTasks?.filter(st => st.taskId === newTaskId).map(st => ({
          ...st,
          id: st.id || `scheduled-${newTaskId}-${Date.now()}`,
          startTime: taskDataToSave.scheduleStart,
          endTime: taskDataToSave.scheduleEnd
        })) || [];
        
        console.log('Submitting task with updated schedule:', { 
          taskId: newTaskId, 
          taskData: { ...taskData, id: newTaskId },
          scheduledTasks: relevantScheduledTasks,
          scheduleEnd: taskDataToSave.scheduleEnd
        });
        
        onSubmit(
          {
            ...taskData,
            id: newTaskId,
            scheduleStart: taskDataToSave.scheduleStart,
            scheduleEnd: taskDataToSave.scheduleEnd
          },
          relevantScheduledTasks.filter(
            (task): task is ScheduledTask =>
              task.startTime instanceof Date && task.endTime instanceof Date,
          ),
        );
      }

      wallsToast.success(isEditing ? "Task Updated" : "Task Created", isEditing ? "Your task has been updated" : "Your task has been created and can now be dragged to schedule");

      onClose();
    } catch (error) {
      console.error("Error saving task:", error);
      // More detailed error message
      wallsToast.error(
        "Error",
        error instanceof Error ? error.message : "Failed to save task"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-[2fr,1fr] divide-x divide-gray-200 gap-6 py-4">
            {/* Left Column */}
            <div className="space-y-4 pr-6">
              <div>
                <Input
                  id="name"
                  value={taskData.name}
                  onChange={(e) => setTaskData({ ...taskData, name: e.target.value })}
                  placeholder="Add title"
                  required
                  className="border-0 border-b-2 border-blue-500 rounded-none bg-transparent focus:ring-0 focus-visible:ring-0 focus:border-blue-600 px-0"
                />
              </div>

              <div className="space-y-2">
                <Textarea
                  id="description"
                  value={taskData.description}
                  onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                  placeholder="Description"
                  className="h-32 border-0 focus-visible:ring-0 focus:ring-0"
                />
              </div>

              <div className="space-y-2">
                <label 
                  htmlFor="attachments" 
                  className="flex items-center gap-2 cursor-pointer rounded-full px-4 py-2 hover:bg-gray-100 w-fit"
                >
                  <span className="text-gray-500 text-sm">Attachments</span>
                  <Paperclip className="h-4 w-4 text-gray-500" />
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={(e) => setTaskData({ ...taskData, attachments: Array.from(e.target.files || []) })}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Select 
                  value={taskData.project}
                  onValueChange={(value) => setTaskData({ ...taskData, project: value })}
                >
                  <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                    <div className="flex items-center gap-2">
                      <GanttChartSquare className="h-4 w-4 text-gray-500" />
                      <SelectValue placeholder="No project" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-project">No project</SelectItem>
                    <SelectItem value="project1">Project 1</SelectItem>
                    <SelectItem value="project2">Project 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Select 
                  value={taskData.assignee}
                  onValueChange={(value) => setTaskData({ ...taskData, assignee: value })}
                >
                  <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                      <AssigneeDisplay 
                      userId={taskData.assignee} 
                      currentUserId={user?.id || ''} 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={user?.id || ''}>Me</SelectItem>
                    {users?.map((userItem) => (
                      <SelectItem key={userItem.uid} value={userItem.uid}>
                        <div className="flex items-center gap-2">
                          {userItem.photoURL ? (
                            <img 
                              src={userItem.photoURL} 
                              alt={userItem.displayName}
                              className="h-6 w-6 rounded-full"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center">
                              {userItem.displayName?.charAt(0)}
                            </div>
                          )}
                          <span>{userItem.displayName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div>
                  <Select 
                    value={taskData.status}
                    onValueChange={(value: TaskStatus) => setTaskData({ ...taskData, status: value })}
                  >
                    <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Status:</span>
                        <SelectValue placeholder="To do" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deferred">Deferred</SelectItem>
                      <SelectItem value="todo">To do</SelectItem>
                      <SelectItem value="inprogress">In progress</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Select 
                    value={taskData.priority}
                    onValueChange={(value: TaskPriority) => setTaskData({ ...taskData, priority: value })}
                  >
                    <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Priority:</span>
                        <SelectValue placeholder="Medium" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Select 
                  value={taskData.duration}
                  onValueChange={(value) => setTaskData({ ...taskData, duration: value })}
                >
                  <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Duration:</span>
                      <SelectValue placeholder="Set duration" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reminder">Reminder</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                    <SelectItem value="960">16 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <DatePicker
                  date={taskData.startDate ?? new Date()}
                  setDate={(date) => setTaskData({ ...taskData, startDate: date })}
                  label="Start date:"
                  format="MMM d, yyyy"
                />
              </div>

              <div className="space-y-2">
                <DatePicker
                  date={taskData.deadline ?? new Date()}
                  setDate={(date) => setTaskData({ ...taskData, deadline: date })}
                  label="Deadline:"
                  format="MMM d, yyyy"
                />
                <div className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="hardDeadline" className="text-sm text-gray-500">Hard deadline:</Label>
                    <Switch
                      id="hardDeadline"
                      checked={taskData.hardDeadline}
                      onCheckedChange={(checked) => 
                        setTaskData({ ...taskData, hardDeadline: checked })
                      }
                      className="scale-75"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Select 
                  value={taskData.schedule}
                  onValueChange={(value) => setTaskData({ ...taskData, schedule: value })}
                >
                  <SelectTrigger className="border-0 rounded-full bg-transparent hover:bg-gray-100 focus:ring-0 focus-visible:ring-0 px-4 [&>svg]:hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Schedule:</span>
                      <SelectValue placeholder="Anytime" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="work">Work hours</SelectItem>
                    <SelectItem value="anytime">Anytime</SelectItem>
                    <SelectItem value="personal-am">Personal AM</SelectItem>
                    <SelectItem value="personal-pm">Personal PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              onClick={onClose} 
              variant="ghost"
              className="bg-gray-50 hover:bg-gray-100 text-black"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="ghost"
              className="bg-gray-50 hover:bg-gray-100 text-black border border-gray-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : isEditing ? "Update Task" : "Save Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Toaster />
    </Dialog>
  );
}