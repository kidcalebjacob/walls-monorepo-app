"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Check, Trash2, CalendarClock, Edit, ChevronDown, ChevronRight } from "lucide-react";
import { format, isToday, isThisWeek, isThisMonth, parseISO, isAfter, startOfDay } from "date-fns";
import { TaskPopup } from "./create/task-popup";
import { useState, useMemo } from "react";
import { TaskData, ScheduledTask } from "@/types/calendar.types";

interface CalendarTasksProps {
  tasks: TaskData[];
  events: any[];
  scheduledTasks: ScheduledTask[];
  onTaskSubmit: (taskData: TaskData, scheduledTasks: ScheduledTask[]) => void;
  onTaskComplete: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskEdit: (taskData: TaskData, scheduledTasks: ScheduledTask[]) => void;
  filters: {
    events: boolean;
    tasks: boolean;
    deals: boolean;
  };
}

// Helper type for grouped tasks
interface GroupedTasks {
  overdue: TaskData[];
  today: TaskData[];
  thisWeek: TaskData[];
  thisMonth: TaskData[];
  other: TaskData[];
}

export function CalendarTasks({
  tasks,
  events,
  scheduledTasks,
  onTaskSubmit,
  onTaskComplete,
  onTaskDelete,
  onTaskEdit,
  filters
}: CalendarTasksProps) {
  const [isTaskPopupOpen, setIsTaskPopupOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    overdue: false,
    today: false,
    thisWeek: false,
    thisMonth: false,
    other: false
  });

  const handleTaskClick = (task: TaskData) => {
    setEditingTask(task);
    setIsTaskPopupOpen(true);
  };

  const handleTaskSubmit = (taskData: TaskData, scheduledTasks: ScheduledTask[]) => {
    if (editingTask) {
      onTaskEdit(taskData, scheduledTasks);
    } else {
      onTaskSubmit(taskData, scheduledTasks);
    }
    setEditingTask(null);
  };

  const handlePopupClose = () => {
    setIsTaskPopupOpen(false);
    setEditingTask(null);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    // Store the task ID
    e.dataTransfer.setData('text/plain', taskId);
    
    // Find task details to provide more data for preview
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      // Store additional task data as JSON
      const taskData = {
        id: taskId,
        title: task.name,
        eventType: task.eventType || 'task',
        duration: task.duration || '30'
      };
      
      // Add task data for the drag preview
      e.dataTransfer.setData('application/json', JSON.stringify(taskData));
    }
    
    e.dataTransfer.effectAllowed = 'move';
    
    // Set custom drag image if needed
    if (e.target instanceof HTMLElement) {
      // Create a clone of the task element for the drag image
      const dragImage = e.target.cloneNode(true) as HTMLElement;
      dragImage.style.width = '200px';
      dragImage.style.backgroundColor = task?.eventType === 'deal' ? 'white' : 'white';
      dragImage.style.color = task?.eventType === 'deal' ? 'white' : 'black';
      dragImage.style.borderRadius = '8px';
      dragImage.style.padding = '8px';
      dragImage.style.opacity = '0.8';
      
      // Add to DOM, position off screen
      document.body.appendChild(dragImage);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      
      // Set as drag image and clean up after drag ends
      e.dataTransfer.setDragImage(dragImage, 10, 10);
      
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    }
  };

  // Check if task is already scheduled
  const isTaskScheduled = (taskId: string) => {
    return scheduledTasks.some(task => task.taskId === taskId);
  };
  
  // Get schedule date for a task
  const getTaskScheduleDate = (taskId: string): Date | null => {
    const scheduledTask = scheduledTasks.find(task => task.taskId === taskId);
    if (scheduledTask?.startTime) {
      try {
        // Ensure the date is in the correct format
        return scheduledTask.startTime instanceof Date 
          ? scheduledTask.startTime 
          : new Date(scheduledTask.startTime);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Get schedule end date for a task
  const getTaskScheduleEndDate = (taskId: string): Date | null => {
    const scheduledTask = scheduledTasks.find(task => task.taskId === taskId);
    if (scheduledTask?.endTime) {
      try {
        // Ensure the date is in the correct format
        return scheduledTask.endTime instanceof Date 
          ? scheduledTask.endTime 
          : new Date(scheduledTask.endTime);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Group tasks by time periods
  const groupedTasks = useMemo(() => {
    const groups: GroupedTasks = {
      overdue: [],
      today: [],
      thisWeek: [],
      thisMonth: [],
      other: []
    };

    // First filter tasks based on their event type
    const filteredTasks = tasks.filter(task => {
      if (task.eventType === 'deal') {
        return filters.deals;
      } else {
        // Default to 'task' for any other eventType or undefined
        return filters.tasks;
      }
    });

    const today = startOfDay(new Date());

    filteredTasks.forEach(task => {
      if (!isTaskScheduled(task.id!)) {
        groups.other.push(task);
        return;
      }

      const scheduleDate = getTaskScheduleDate(task.id!);
      const scheduleEndDate = getTaskScheduleEndDate(task.id!);
      
      if (!scheduleDate) {
        groups.other.push(task);
        return;
      }

      // Check if the task is overdue
      if (
        scheduleEndDate && 
        isAfter(today, startOfDay(scheduleEndDate)) && 
        task.status !== 'complete'
      ) {
        groups.overdue.push(task);
        return;
      }

      if (isToday(scheduleDate)) {
        groups.today.push(task);
      } else if (isThisWeek(scheduleDate)) {
        groups.thisWeek.push(task);
      } else if (isThisMonth(scheduleDate)) {
        groups.thisMonth.push(task);
      } else {
        groups.other.push(task);
      }
    });

    return groups;
  }, [tasks, scheduledTasks, filters]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderTaskItem = (task: TaskData) => (
    <div
      key={task.id}
      className={`flex items-center gap-2 p-3 rounded-lg hover:bg-gray-100 group relative cursor-pointer ${
        isTaskScheduled(task.id!) 
          ? task.eventType === 'deal' 
            ? 'border-l-4 border-kenoo-red' 
            : 'border-l-4 border-kenoo-lime'
          : ''
      }`}
      onClick={() => handleTaskClick(task)}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id!)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          task.id && onTaskComplete(task.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-green-100 rounded-full absolute left-2"
      >
        <Check className="h-4 w-4 text-gray-500 hover:text-green-600" />
      </button>
      <div className="flex-1 pl-6">
        <h4 className="text-sm text-muted-foreground">{task.name}</h4>
        {task.deadline && task.deadline instanceof Date && !isNaN(task.deadline.getTime()) && (
          <div className="flex items-center gap-1 mt-1">
            <CalendarClock className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-500">
              {format(task.deadline, "MMM d, yyyy")}
            </span>
          </div>
        )}
      </div>
      <div className={`text-xs px-2 py-1 rounded-full ${
        isTaskScheduled(task.id!)
          ? 'bg-black/70 text-kenoo-lime'
          : 'bg-gray-100 text-gray-600'
      } group-hover:hidden`}>
        {isTaskScheduled(task.id!) ? "Scheduled" : task.status}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          task.id && onTaskDelete(task.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded-full absolute right-2"
      >
        <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
      </button>
    </div>
  );

  const renderTaskGroup = (title: string, tasks: TaskData[], sectionKey: string) => {
    if (tasks.length === 0) return null;
    
    return (
      <div className="mb-4">
        <div 
          className="flex items-center justify-between cursor-pointer py-2"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center">
            <h3 className="text-sm text-gray-400">{title} <span className="text-gray-400">({tasks.length})</span></h3>
          </div>
          {expandedSections[sectionKey] ? 
            <ChevronDown className="h-4 w-4 text-gray-400" /> : 
            <ChevronRight className="h-4 w-4 text-gray-400" />
          }
        </div>
        {expandedSections[sectionKey] && (
          <div className="mt-2 space-y-2">
            {tasks.map(renderTaskItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 border p-4 bg-slate-50 rounded-[30px] shadow-sm">
      <Button
        variant="ghost"
        className="w-full h-12 flex items-center justify-start px-4 text-muted-foreground hover:text-foreground rounded-full"
        onClick={() => setIsTaskPopupOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add task
      </Button>

      <ScrollArea className="h-[calc(100vh-200px)] mt-4">
        <div className="space-y-2">
          {renderTaskGroup("Overdue", groupedTasks.overdue, "overdue")}
          {renderTaskGroup("Today", groupedTasks.today, "today")}
          {renderTaskGroup("This Week", groupedTasks.thisWeek, "thisWeek")}
          {renderTaskGroup("This Month", groupedTasks.thisMonth, "thisMonth")}
          {renderTaskGroup("Unscheduled Tasks", groupedTasks.other, "other")}
        </div>
      </ScrollArea>

      <TaskPopup
        isOpen={isTaskPopupOpen}
        onClose={handlePopupClose}
        onSubmit={handleTaskSubmit}
        events={events}
        initialTask={editingTask}
        isEditing={!!editingTask}
        scheduledTasks={scheduledTasks}
      />
    </div>
  );
}