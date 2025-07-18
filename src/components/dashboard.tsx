
"use client";

import { useState, useTransition, useEffect } from "react";
import { GoogleAuthProvider, linkWithPopup, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  handleAssessPriority,
  handleGenerateSchedule,
  handleReworkSchedule,
  handleSyncToCalendar,
} from "@/lib/actions";
import type { ScheduleTask } from "@/lib/types";
import type { PriorityItem } from "@/ai/flows/assess-priority";
import { useAuth } from "@/components/auth-provider";
import { useSession, signIn } from "next-auth/react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Calendar,
  Sparkles,
  Clock,
  RefreshCw,
  ListTodo,
  Loader2,
  Send,
  GripVertical,
  BrainCircuit,
  Coffee,
  Bed,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Header } from "./header";
import React from "react";

function SubmitButton({ text, loadingText, icon: Icon = Sparkles, pending }: { text: string; loadingText: string, icon?: React.ElementType, pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {loadingText}
        </>
      ) : (
        <>
          <Icon className="mr-2 h-4 w-4" /> {text}
        </>
      )}
    </Button>
  );
}

function parseSchedule(scheduleText: string): ScheduleTask[] {
    if (!scheduleText) return [];
    
    try {
        const tasks = JSON.parse(scheduleText.replace(/,\s*]/g, ']'));
        if (Array.isArray(tasks)) {
             return tasks.map((t: any, index: number) => {
                const [startTime, endTime] = t.time?.split(' - ').map((s: string) => s.trim()) || [null, null];
                return {
                    id: `task-${index}-${new Date().getTime()}`,
                    time: t.time || 'N/A',
                    task: t.task || 'Untitled Task',
                    startTime: startTime,
                    endTime: endTime,
                    duration: t.duration
                } as ScheduleTask;
            });
        }
    } catch (e) {
        console.error("Failed to parse schedule JSON:", e, "---", scheduleText);
    }
    
    // Fallback for non-JSON or malformed JSON
    const lines = scheduleText.split('\n').filter((line: string) => line.trim().length > 0);
    return lines.map((line: string, index: number) => {
         const match = line.match(/(\d{1,2}:\d{2}\s?[AP]M)\s?-\s?(\d{1,2}:\d{2}\s?[AP]M):\s*(.*)/);
         if (match) {
            const [, startTime, endTime, task] = match;
            return {
                id: `task-${index}-${new Date().getTime()}`,
                time: `${startTime.trim()} - ${endTime.trim()}`,
                task: task.trim(),
                startTime: startTime.trim(),
                endTime: endTime.trim(),
            } as ScheduleTask;
         }
         return {
            id: `task-${index}-${new Date().getTime()}`,
            time: 'N/A',
            task: line,
            startTime: undefined,
            endTime: undefined,
         } as ScheduleTask;
    });
}


function SortablePriorityItem({ item }: { item: PriorityItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const getBadgeIcon = (timeOfDay: string) => {
    if (timeOfDay.toLowerCase().includes('morning')) return <BrainCircuit className="h-3 w-3 mr-1" />;
    if (timeOfDay.toLowerCase().includes('afternoon')) return <Coffee className="h-3 w-3 mr-1" />;
    if (timeOfDay.toLowerCase().includes('evening')) return <Bed className="h-3 w-3 mr-1" />;
    return null;
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="bg-card p-3 rounded-lg shadow-sm flex items-center gap-3 touch-none">
       <div {...listeners} className="cursor-grab p-2">
         <GripVertical className="text-muted-foreground" />
       </div>
       <div className="flex-grow">
          <p className="font-medium text-card-foreground">{item.text}</p>
          {/* Remove variant if not supported by BadgeProps */}
          <Badge className="mt-1">
            {getBadgeIcon(item.timeOfDay)}
            {item.timeOfDay}
          </Badge>
       </div>
    </div>
  );
}

function parseTimeToDate(timeStr: string): Date {
    const now = new Date();
    const [time, modifier] = timeStr.split(' ');
    if (!modifier) { // Handle "HH:MM" format
        const [hours, minutes] = time.split(':').map(Number);
        now.setHours(hours, minutes, 0, 0);
        return now;
    }
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier.toUpperCase() === 'PM' && hours < 12) {
        hours += 12;
    }
    if (modifier.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
    }
    now.setHours(hours, minutes, 0, 0);
    return now;
}

function ScheduleTimeline({ tasks, onScheduleChange }: { tasks: ScheduleTask[], onScheduleChange: (newSchedule: string) => void }) {
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const scheduleText = tasks.map((t: ScheduleTask) => `${t.time}: ${t.task}`).join('\n');

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="relative pl-6 space-y-4">
                    <div className="absolute left-8 top-2 bottom-2 w-0.5 bg-border -translate-x-1/2"></div>
                    {tasks.map((item: ScheduleTask, index: number) => {
                        const startTime = item.startTime ? parseTimeToDate(item.startTime) : null;
                        const endTime = item.endTime ? parseTimeToDate(item.endTime) : null;
                        const isActive = startTime && endTime && currentTime >= startTime && currentTime < endTime;
                        return (
                            <div key={item.id || index} className="flex items-start gap-4 relative">
                                <div className={`z-10 flex-shrink-0 flex items-center justify-center rounded-full h-5 w-5 mt-1 -translate-x-1/2 ${isActive ? 'bg-green-500 ring-4 ring-green-500/30' : 'bg-primary'}`}></div>
                                <div className="flex-grow -mt-1 w-full bg-card p-4 rounded-lg border">
                                    <div className="flex justify-between items-baseline">
                                        <p className="font-semibold text-primary">{item.time}</p>
                                        {item.duration && <p className="text-sm text-muted-foreground">{item.duration}</p>}
                                    </div>
                                    <p className="text-card-foreground/90 mt-1">{item.task}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            <CardFooter className="flex-col items-start">
                <Label htmlFor="scheduleText" className="mb-2">Edit Schedule Text</Label>
                 <Textarea
                    id="scheduleText"
                    name="scheduleText"
                    className="min-h-[150px] text-sm font-mono mt-2"
                    value={scheduleText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onScheduleChange(e.target.value)}
                  />
            </CardFooter>
        </Card>
    );
}

export function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAssessPending, startAssessTransition] = useTransition();
  const [isReworkPending, startReworkTransition] = useTransition();

  const [userGoals, setUserGoals] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [reasoning, setReasoning] = useState<string>("");
  const [scheduleText, setScheduleText] = useState<string>("");

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  
  const sensors = useSensors(useSensor(PointerSensor));

  const onAssess = (formData: FormData) => {
    startAssessTransition(async () => {
      const goals = formData.get('userGoals') as string;
      setUserGoals(goals);
      setStartTime(formData.get('startTime') as string);
      setEndTime(formData.get('endTime') as string);

      const result = await handleAssessPriority({ userGoals: goals });
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error Assessing Priorities",
          description: Object.values(result.error).flat().join('\n') || "Please check your input and try again.",
        });
      } else if (result.data) {
        setPriorities(result.data.priorityList);
        setReasoning(result.data.reasoning);
        setScheduleText("");
      }
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPriorities((items: PriorityItem[]) => {
        const oldIndex = items.findIndex((item: PriorityItem) => item.id === active.id);
        const newIndex = items.findIndex((item: PriorityItem) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Helper to parse time string (e.g., "9:00 AM") to Date object for today
  function parseTimeStringToDate(timeStr: string): Date {
    const now = new Date();
    const [time, modifier] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier?.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (modifier?.toUpperCase() === 'AM' && hours === 12) hours = 0;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    return date;
  }

  // Helper to format Date object to "h:mm AM/PM"
  function formatTime(date: Date): string {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  // New schedule generator (no AI)
  function generateScheduleDirect(priorities: PriorityItem[], startTime: string, endTime: string) {
    // Defaults
    const defaultStart = '9:00 AM';
    const defaultEnd = '6:00 PM';
    const start = startTime?.trim() ? startTime : defaultStart;
    const end = endTime?.trim() ? endTime : defaultEnd;
    const startDate = parseTimeStringToDate(start);
    const endDate = parseTimeStringToDate(end);
    const totalMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
    const numTasks = priorities.length;
    if (numTasks === 0 || totalMinutes <= 0) return [];

    // Insert a 1-hour lunch break around noon if it fits
    const lunchStartHour = 12;
    const lunchDuration = 60; // minutes
    let lunchInserted = false;
    let slots = numTasks;
    if (totalMinutes > (numTasks * 60 + lunchDuration)) {
      slots += 1; // add lunch slot
      lunchInserted = true;
    }
    const slotMinutes = Math.floor(totalMinutes / slots);

    let current = new Date(startDate);
    const schedule: ScheduleTask[] = [];
    for (let i = 0, p = 0; i < slots; i++) {
      // Insert lunch if it's time
      if (lunchInserted && !schedule.some((e: ScheduleTask) => e.task === 'Lunch Break') && current.getHours() >= lunchStartHour && current.getHours() < lunchStartHour + 2) {
        const lunchEnd = new Date(current.getTime() + lunchDuration * 60000);
        schedule.push({
          time: `${formatTime(current)} - ${formatTime(lunchEnd)}`,
          task: 'Lunch Break',
          duration: '1 hour',
        } as ScheduleTask);
        current = lunchEnd;
        continue;
      }
      // Assign task
      if (p < priorities.length) {
        const next = new Date(current.getTime() + slotMinutes * 60000);
        schedule.push({
          time: `${formatTime(current)} - ${formatTime(next)}`,
          task: priorities[p].text,
          duration: `${slotMinutes} min`,
        } as ScheduleTask);
        current = next;
        p++;
      }
    }
    return schedule;
  }

  const onGenerate = async () => {
    if (priorities.length === 0) {
      toast({
        variant: "destructive",
        title: "No Priorities",
        description: "First, assess your priorities for the day.",
      });
      return;
    }
    setIsGenerating(true);
    setScheduleText("");
    // Use AI-powered schedule generation
    const priorityText = priorities.map(p => p.text).join(', ');
    const input = {
      priority: priorityText,
      calendarEvents: "Team Standup at 10:00 AM - 11:00 AM, Project Sync at 5:00 PM - 6:00 PM", // You may want to make this dynamic
      startTime: startTime,
      endTime: endTime,
    };
    const result = await handleGenerateSchedule(input);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error Generating Schedule",
        description: result.error,
      });
    } else if (result.data) {
      // result.data.schedule is a JSON string array
      setScheduleText(result.data.schedule);
    }
    setIsGenerating(false);
  };
  
  const onSync = async () => {
    let accessToken: string | null = null;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Not signed in",
        description: "Please sign in with Google to sync your calendar.",
      });
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      accessToken = credential?.accessToken ?? null;
      if (!accessToken) {
        toast({ variant: "destructive", title: "Google Auth Failed", description: "Could not get Google access token." });
        return;
      }
    } else {
      const isGoogleLinked = user.providerData.some(p => p.providerId === 'google.com');
      if (!isGoogleLinked) {
        toast({ variant: "destructive", title: "Google Account Required", description: "Please link your Google account to sync the calendar." });
        try {
          const provider = new GoogleAuthProvider();
          provider.addScope('https://www.googleapis.com/auth/calendar');
          const linkResult = await linkWithPopup(auth.currentUser!, provider);
          const linkCredential = GoogleAuthProvider.credentialFromResult(linkResult);
          accessToken = linkCredential?.accessToken ?? null;
          if (!accessToken) throw new Error("No access token from Google link.");
          toast({ title: "Google Account Linked!", description: "You can now sync your calendar." });
        } catch (error: any) {
          toast({ variant: "destructive", title: "Google Linking Failed", description: error.message });
          return;
        }
      } else {
        // Re-authenticate to get a fresh access token
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar');
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        accessToken = credential?.accessToken ?? null;
        if (!accessToken) {
          toast({ variant: "destructive", title: "Google Auth Failed", description: "Could not get Google access token." });
          return;
        }
      }
    }

    const tasksToSync = parseSchedule(scheduleText).map(task => ({
      title: task.task,
      startTime: task.startTime!,
      endTime: task.endTime!,
    })).filter(t => t.startTime && t.endTime);

    if (tasksToSync.length === 0) {
      toast({ variant: "destructive", title: "No valid schedule events to sync." });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await handleSyncToCalendar({ events: tasksToSync, accessToken });
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error Syncing to Calendar",
          description: result.error,
        });
      } else {
        toast({
          title: "Synced Successfully!",
          description: `Synced ${result.data?.syncedEvents.length} event(s) to your Google Calendar.`,
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error Syncing to Calendar", description: String(e) });
    }
    setIsSyncing(false);
  }

  const onRework = (formData: FormData) => {
    startReworkTransition(async () => {
        const newConstraints = formData.get("newConstraints") as string;
        
        const input = {
            originalSchedule: scheduleText,
            completedTasks: [], 
            remainingTime: "the rest of the day",
            newConstraints: newConstraints,
            userGoals: userGoals,
        };
        
        const result = await handleReworkSchedule(input);
        if (result.error) {
            toast({
                variant: "destructive",
                title: "Error Reworking Schedule",
                description: Object.values(result.error).flat().join('\n') || "Please check your input and try again.",
            });
        } else if (result.data) {
            setScheduleText(result.data.revisedSchedule);
            toast({
                title: "Schedule Reworked!",
                description: "Your new schedule is ready.",
            });
        }
    });
  }

  const resetAll = () => {
    setUserGoals("");
    setStartTime("");
    setEndTime("");
    setPriorities([]);
    setReasoning("");
    setScheduleText("");
  };

  const hasGeneratedSchedule = scheduleText.length > 0 || isGenerating;
  const scheduleTasks = parseSchedule(scheduleText).map(task => ({
    ...task,
    time: normalizeTimeRange(task.time),
    startTime: task.startTime ? normalizeTimeRange(task.startTime) : undefined,
    endTime: task.endTime ? normalizeTimeRange(task.endTime) : undefined,
  }));

  // Add helper to normalize time strings (e.g., '1:00 PM - 2:30 PM')
  function normalizeTimeRange(timeRange: string): string {
    if (!timeRange || typeof timeRange !== 'string') return '';
    const [start, end] = (timeRange.split('-').map(s => s.trim())).concat(['', '']);
    function fix(t: string) {
      if (!t || typeof t !== 'string') return '';
      const parts = t.split(' ');
      if (parts.length < 2) return t;
      let [time, ampm] = parts;
      if (!time || !ampm) return t;
      const timeParts = time.split(':');
      if (timeParts.length < 2) return t;
      let [h, m] = timeParts;
      h = h ? h.padStart(1, '0') : '0';
      m = m ? m.padStart(2, '0') : '00';
      return `${h}:${m} ${ampm.toUpperCase()}`;
    }
    return `${fix(start)}${end ? ' - ' + fix(end) : ''}`;
  }

  const [reworkText, setReworkText] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [customDate, setCustomDate] = useState<string>("");
  const dayLabels = [
    { label: 'M', value: 'Monday' },
    { label: 'T', value: 'Tuesday' },
    { label: 'W', value: 'Wednesday' },
    { label: 'T', value: 'Thursday' },
    { label: 'F', value: 'Friday' },
    { label: 'Sa', value: 'Saturday' },
    { label: 'Su', value: 'Sunday' },
  ];

  function getNextDateForDay(day: string) {
    // Returns next date (YYYY-MM-DD) for the given day label (e.g., 'Monday')
    const today = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetIndex = daysOfWeek.indexOf(day);
    if (targetIndex === -1) return null;
    const diff = (targetIndex + 7 - today.getDay()) % 7 || 7;
    const nextDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    return nextDate.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  // Helper to get a fresh Google OAuth access token (used in sync to selected days)
  async function getGoogleAccessToken(): Promise<string> {
    if (!user) {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) throw new Error('Could not get Google access token.');
      return credential.accessToken;
    } else {
      const isGoogleLinked = user.providerData.some(p => p.providerId === 'google.com');
      if (!isGoogleLinked) {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar');
        const linkResult = await linkWithPopup(auth.currentUser!, provider);
        const linkCredential = GoogleAuthProvider.credentialFromResult(linkResult);
        if (!linkCredential?.accessToken) throw new Error('No access token from Google link.');
        return linkCredential.accessToken;
      } else {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar');
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) throw new Error('Could not get Google access token.');
        return credential.accessToken;
      }
    }
  }

  // Function to fetch today's events from Google Calendar
  const fetchTodayEvents = async (accessToken: string) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Get user's timezone offset in format like -04:00
    const timeZoneOffset = new Date().getTimezoneOffset();
    const offsetHours = Math.abs(timeZoneOffset / 60);
    const offsetSign = timeZoneOffset <= 0 ? '+' : '-';
    const timezoneOffsetString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:00`;
    
    // Format dates with timezone offset appended (like 2024-01-15T00:00:00-04:00)
    const startOfDayString = `${startOfDay.toISOString().slice(0, -5)}${timezoneOffsetString}`;
    const endOfDayString = `${endOfDay.toISOString().slice(0, -5)}${timezoneOffsetString}`;
    
    console.log('API request with timezone:', { startOfDayString, endOfDayString, timezoneOffsetString });
    
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(startOfDayString)}&timeMax=${encodeURIComponent(endOfDayString)}&singleEvents=true&orderBy=startTime`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }
    
    const data = await response.json();
    console.log('Google Calendar API response:', data);
    return data.items || [];
  };

  // Connect to Google Calendar and fetch events
  const connectGoogleCalendar = async () => {
    setIsConnecting(true);
    try {
      // Debug timezone info
      const tzInfo = getTimezoneInfo();
      console.log('Connecting to Google Calendar with timezone:', tzInfo);
      
      const accessToken = await getGoogleAccessToken();
      const events = await fetchTodayEvents(accessToken);
      setGoogleEvents(events);
      setIsGoogleConnected(true);
      toast({
        title: "Connected to Google Calendar!",
        description: `Fetched ${events.length} events for today.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to connect",
        description: error.message || "Could not connect to Google Calendar.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Helper to get today's events from scheduleTasks
  function getTodaysEvents(tasks: ScheduleTask[]): ScheduleTask[] {
    // Optionally, filter by today's date if events have a date property, else return all
    return tasks;
  }

  // Helper to format Google Calendar event times in local timezone
  function formatGoogleEventTime(dateTimeString: string | undefined): string {
    if (!dateTimeString) return 'N/A';
    try {
      // Parse the UTC date string
      const utcDate = new Date(dateTimeString);
      
      // Get user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Convert to local time using the user's timezone
      const localDate = new Date(utcDate.toLocaleString("en-US", {timeZone: userTimezone}));
      
      // Format the time
      return localDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'N/A';
    }
  }

  // Debug function to show timezone info
  function getTimezoneInfo() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date().getTimezoneOffset();
    const offsetHours = Math.abs(offset / 60);
    const offsetSign = offset <= 0 ? '+' : '-';
    
    console.log(`User timezone: ${timezone}`);
    console.log(`Timezone offset: UTC${offsetSign}${offsetHours}:00`);
    
    return { timezone, offset: `${offsetSign}${offsetHours}:00` };
  }

  return (
    <>
      <Header />
      <div className="w-full flex flex-col items-center mb-8">
        <div className="flex gap-4 items-center justify-center">
          {/* Removed sync button from header */}
          {/* Optionally, show sign-in status or user info here */}
          {!user && (
            <span className="text-muted-foreground">Sign in to sync your schedule</span>
          )}
        </div>
      </div>
      <div className="container max-w-screen-lg mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Plan Your Day */}
          <div>
            <section id="plan">
              <Card className="border-none shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-3xl font-bold flex items-center text-primary"><Sparkles className="mr-3 h-8 w-8" /> Plan Your Day</CardTitle>
                  <CardDescription className="text-lg">Tell the AI what you want to achieve to get a prioritized list. The more detail, the better.</CardDescription>
                </CardHeader>
                <form action={onAssess}>
                  <CardContent className="space-y-4">
                    <Textarea
                      name="userGoals"
                      placeholder="e.g., Finish the Q3 report, prepare for the client presentation, learn a new chapter on React, and go for a run..."
                      className="min-h-[120px] text-base"
                      required
                      defaultValue={userGoals}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="startTime">Start Time (Optional)</Label>
                            <Input id="startTime" name="startTime" type="text" placeholder="e.g., 9:00 AM" defaultValue={startTime} />
                        </div>
                        <div>
                            <Label htmlFor="endTime">End Time (Optional)</Label>
                            <Input id="endTime" name="endTime" type="text" placeholder="e.g., 5:00 PM" defaultValue={endTime} />
                        </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col sm:flex-row gap-4 items-start">
                     <SubmitButton text="Assess Priorities" loadingText="Assessing..." icon={Send} pending={isAssessPending} />
                     <Button type="button" variant="ghost" onClick={resetAll}>
                        <RefreshCw className="mr-2 h-4 w-4"/> Start Over
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </section>
          </div>
          {/* Right: Current Events Card */}
          <div>
            <Card className="shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center text-primary"><Calendar className="mr-2 h-6 w-6"/> Current Events</CardTitle>
                <CardDescription className="text-base">
                  Today's Schedule 
                  {isGoogleConnected && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGoogleConnected ? (
                  googleEvents.length === 0 ? (
                    <div className="text-muted-foreground">No events found for today in your Google Calendar.</div>
                  ) : (
                    <ul className="space-y-2">
                      {googleEvents.map((item, idx) => (
                        <li key={item.id || idx} className="flex flex-col border-b pb-2">
                          <span className="font-semibold text-primary">{item.summary}</span>
                          <span className="text-card-foreground/90">{formatGoogleEventTime(item.start.dateTime)} - {formatGoogleEventTime(item.end.dateTime)}</span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <div className="text-muted-foreground">
                    <p>Connect your Google Calendar to see today's events.</p>
                    <Button onClick={connectGoogleCalendar} disabled={isConnecting}>
                      {isConnecting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Connecting...</> : <><Sparkles className="mr-2 h-4 w-4"/> Connect Google Calendar</>}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Full-width sections for priorities and schedule */}
        {priorities.length > 0 && !hasGeneratedSchedule && (
          <section id="priorities" className="animate-in fade-in-50 duration-500 mt-8">
            <div className="space-y-4">
               <h2 className="text-2xl font-bold flex items-center"><ListTodo className="mr-2 text-primary"/>Your Suggested Priorities</h2>
               <p className="text-muted-foreground">{reasoning}</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                   <SortableContext items={priorities} strategy={verticalListSortingStrategy}>
                     <div className="space-y-3">
                       {priorities.map(item => <SortablePriorityItem key={item.id} item={item} />)}
                     </div>
                   </SortableContext>
                 </DndContext>
                  <div className="pt-4">
                     <Button onClick={onGenerate} disabled={isGenerating} size="lg">
                        {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Generating...</> : <><Sparkles className="mr-2 h-4 w-4"/>Generate My Schedule</>}
                     </Button>
                 </div>
            </div>
          </section>
        )}
        {hasGeneratedSchedule && (
          <section id="schedule" className="animate-in fade-in-50 duration-500 space-y-8 mt-8">
            <div>
              <h2 className="text-2xl font-bold flex items-center mb-4"><Sparkles className="mr-2 text-primary"/> Your Generated Schedule</h2>
              {isGenerating ? (
                 <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-lg">
                    <Loader2 className="mr-3 h-8 w-8 animate-spin text-primary"/>
                    <span className="text-xl mt-4">AI is crafting your perfect day...</span>
                </div>
              ) : (
                <>
                <ScheduleTimeline tasks={scheduleTasks} onScheduleChange={setScheduleText} />
                <CardFooter className="flex flex-wrap gap-2 mt-4 items-end">
                    <Button onClick={onGenerate} disabled={!priorities.length || isGenerating}>
                        <RefreshCw className="mr-2 h-4 w-4"/> Re-generate
                    </Button>
                    <Button onClick={onSync} disabled={isSyncing}>
                        {isSyncing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Syncing...</> : <><Calendar className="mr-2 h-4 w-4"/>Sync to Google Calendar</>}
                    </Button>
                    {/* Rework UI: single textbox and button, inline with sync */}
                    <input
                      type="text"
                      className="ml-4 px-3 py-2 rounded border bg-background text-foreground focus:outline-none focus:ring"
                      style={{ minWidth: 200 }}
                      placeholder="e.g., Lunch ran an hour late."
                      value={reworkText}
                      onChange={e => setReworkText(e.target.value)}
                    />
                    <Button
                      onClick={() => {
                        startReworkTransition(async () => {
                          const input = {
                            originalSchedule: scheduleText,
                            completedTasks: [],
                            remainingTime: "the rest of the day",
                            newConstraints: reworkText,
                            userGoals: userGoals,
                          };
                          const result = await handleReworkSchedule(input);
                          if (result.error) {
                            toast({
                              variant: "destructive",
                              title: "Error Reworking Schedule",
                              description: Object.values(result.error).flat().join('\n') || "Please check your input and try again.",
                            });
                          } else if (result.data) {
                            setScheduleText(result.data.revisedSchedule);
                            toast({
                              title: "Schedule Reworked!",
                              description: "Your new schedule is ready.",
                            });
                          }
                        });
                      }}
                      disabled={isReworkPending || !reworkText.trim()}
                    >
                      <RefreshCw className="mr-2 h-4 w-4"/> Rework My Day
                    </Button>
                </CardFooter>
                {/* Future days row */}
                <div className="flex flex-col gap-2 mt-6">
                  <div className="flex gap-2 items-center">
                    {dayLabels.map((d, i) => (
                      <button
                        key={d.label + i}
                        type="button"
                        aria-label={d.value}
                        title={d.value}
                        className={`rounded-full w-8 h-8 flex items-center justify-center border ${selectedDays.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
                        onClick={() => setSelectedDays(sel => sel.includes(d.value) ? sel.filter(x => x !== d.value) : [...sel, d.value])}
                      >
                        {d.label}
                      </button>
                    ))}
                    <input
                      type="date"
                      className="ml-4 px-2 py-1 rounded border text-black"
                      value={customDate}
                      onChange={e => setCustomDate(e.target.value)}
                      aria-label="Custom date"
                    />
                    <Button
                      className="ml-4"
                      disabled={selectedDays.length === 0 && !customDate}
                      onClick={async () => {
                        // Compute all target dates
                        const dates: string[] = [];
                        selectedDays.forEach(day => {
                          const nextDate = getNextDateForDay(day);
                          if (nextDate) dates.push(nextDate);
                        });
                        if (customDate) dates.push(customDate);
                        // Call backend to sync schedule for each date
                        const tasksToSync = parseSchedule(scheduleText).map(task => ({
                          title: task.task,
                          startTime: task.startTime!,
                          endTime: task.endTime!,
                        })).filter(t => t.startTime && t.endTime);
                        if (tasksToSync.length === 0) {
                          toast({ variant: "destructive", title: "No valid schedule events to sync." });
                          return;
                        }
                        setIsSyncing(true);
                        try {
                          const accessToken = await getGoogleAccessToken();
                          const result = await (handleSyncToCalendar as any)({ events: tasksToSync, accessToken, targetDates: dates });
                          if (result.error) {
                            toast({
                              variant: "destructive",
                              title: "Error Syncing to Calendar",
                              description: result.error,
                            });
                          } else {
                            toast({
                              title: "Synced Successfully!",
                              description: `Synced schedule to: ${dates.join(', ')}`,
                            });
                          }
                        } catch (e) {
                          toast({ variant: "destructive", title: "Error Syncing to Calendar", description: String(e) });
                        }
                        setIsSyncing(false);
                      }}
                    >
                      Sync to Selected Days
                    </Button>
                  </div>
                </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}