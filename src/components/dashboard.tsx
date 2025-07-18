
"use client";

import { useState, useTransition, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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
    
    // Attempt to parse as JSON array first
    try {
        const tasks = JSON.parse(scheduleText.replace(/,\s*]/g, ']')); // Tolerate trailing commas
        if (Array.isArray(tasks)) {
             return tasks.map(t => {
                const [startTime, endTime] = t.time?.split(' - ').map((s: string) => s.trim()) || [null, null];
                return {
                    time: t.time || 'N/A',
                    task: t.task || 'Untitled Task',
                    startTime: startTime,
                    endTime: endTime,
                    duration: t.duration
                };
            });
        }
    } catch (e) {
        // Fallback to line-by-line parsing if JSON fails
    }

    const lines = scheduleText.split('\n').filter(line => line.trim().length > 0);
    const tasks: ScheduleTask[] = [];

    for (const line of lines) {
        const match = line.match(/(\d{1,2}:\d{2}\s?[AP]M)\s?-\s?(\d{1,2}:\d{2}\s?[AP]M):\s*(.*)/);
        if (match) {
            const [, startTime, endTime, task] = match;
            tasks.push({
                time: `${startTime} - ${endTime}`,
                task: task.trim(),
                startTime: startTime.trim(),
                endTime: endTime.trim(),
            });
        }
    }
    return tasks;
}


function SortablePriorityItem({ item }: { item: PriorityItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const getBadgeIcon = (timeOfDay: string) => {
    if (timeOfDay.toLowerCase().includes('morning')) return <BrainCircuit className="h-3 w-3 mr-1" />;
    if (timeOfDay.toLowerCase().includes('afternoon')) return <Coffee className="h-3 w-3 mr-1" />;
    if (timeOfDay.toLowerCase().includes('evening')) return <Bed className="h-3 w-3 mr-1" />;
    return null;
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="bg-card p-3 rounded-lg shadow-sm flex items-center gap-3 touch-none">
       <div {...listeners} className="cursor-grab p-2">
         <GripVertical className="text-muted-foreground" />
       </div>
       <div className="flex-grow">
          <p className="font-medium text-card-foreground">{item.text}</p>
          <Badge variant="secondary" className="mt-1">
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
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    now.setHours(hours, minutes, 0, 0);
    return now;
}

function ScheduleTimeline({ tasks, onScheduleChange }: { tasks: ScheduleTask[], onScheduleChange: (newSchedule: string) => void }) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const scheduleText = tasks.map(t => `${t.time}: ${t.task}`).join('\n');

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="relative pl-6 space-y-2">
                    {/* Timeline bar */}
                    <div className="absolute left-8 top-2 bottom-2 w-0.5 bg-border"></div>

                    {tasks.map((item, index) => {
                        const startTime = item.startTime ? parseTimeToDate(item.startTime) : new Date(0);
                        const endTime = item.endTime ? parseTimeToDate(item.endTime) : new Date(0);
                        const isActive = currentTime >= startTime && currentTime < endTime;
                        
                        return (
                            <div key={index} className="flex items-start gap-4 relative">
                                <div className={`z-10 flex-shrink-0 flex items-center justify-center rounded-full h-5 w-5 mt-1 ${isActive ? 'bg-green-500 ring-4 ring-green-500/30' : 'bg-primary'}`}>
                                </div>
                                <div className="flex-grow -mt-1 w-full">
                                    <div className="flex justify-between items-baseline">
                                        <p className="font-semibold text-primary">{item.time}</p>
                                    </div>
                                    <p className="text-card-foreground/90">{item.task}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            <CardFooter>
                 <Textarea
                    name="scheduleText"
                    className="min-h-[150px] text-sm font-mono mt-4"
                    value={scheduleText}
                    onChange={(e) => onScheduleChange(e.target.value)}
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

  const [userGoals, setUserGoals] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [reasoning, setReasoning] = useState<string>("");
  const [scheduleText, setScheduleText] = useState<string>("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
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
      setPriorities((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

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
    const priorityText = priorities.map(p => p.text).join(', ');
    const input = {
      priority: priorityText,
      calendarEvents: "Team Standup at 10:00 AM - 11:00 AM, Project Sync at 5:00 PM - 6:00 PM",
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
      setScheduleText(result.data.schedule);
    }
    setIsGenerating(false);
  };
  
  const onSync = async () => {
      if (!user) return;
      
      if (user.providerData.every(p => p.providerId !== 'google.com')) {
          toast({ variant: "destructive", title: "Google Sign-In Required", description: "Please sign in with Google to sync your calendar."});
          try {
            const provider = new GoogleAuthProvider();
            // Requesting calendar scope
            provider.addScope('https://www.googleapis.com/auth/calendar.events');
            await signInWithPopup(auth, provider);
            toast({ title: "Google Sign-In Successful!", description: "You can now try syncing your calendar again." });
          } catch (error: any) {
            toast({ variant: "destructive", title: "Google Sign-In Failed", description: error.message });
          }
          return;
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
      const result = await handleSyncToCalendar({ events: tasksToSync });
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
      setIsSyncing(false);
  }

  const onRework = (formData: FormData) => {
    startReworkTransition(async () => {
        const newConstraints = formData.get("newConstraints") as string;
        const currentScheduleText = parseSchedule(scheduleText).map(t => `${t.time}: ${t.task}`).join('\n');

        const input = {
            originalSchedule: currentScheduleText,
            completedTasks: [], // We let the AI figure this out
            remainingTime: "the rest of the day", // Let AI determine this
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
  const scheduleTasks = parseSchedule(scheduleText);

  return (
    <>
      <Header />
      <div className="container max-w-screen-lg mx-auto p-4 md:p-8 space-y-12">
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

        {priorities.length > 0 && !hasGeneratedSchedule && (
          <section id="priorities" className="animate-in fade-in-50 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-4">
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
                <div className="space-y-4">
                     <h2 className="text-2xl font-bold flex items-center"><Calendar className="mr-2 text-primary"/>Today's Events</h2>
                     <p className="text-muted-foreground">Key events to plan around.</p>
                     <div className="space-y-3">
                        <div className="flex items-start text-sm">
                            <Clock className="mr-3 mt-1 h-4 w-4 text-muted-foreground" />
                            <div><p className="font-medium">Team Standup</p><p className="text-muted-foreground">10:00 AM - 11:00 AM</p></div>
                        </div>
                        <div className="flex items-start text-sm">
                            <Clock className="mr-3 mt-1 h-4 w-4 text-muted-foreground" />
                            <div><p className="font-medium">Project Sync</p><p className="text-muted-foreground">5:00 PM - 6:00 PM</p></div>
                        </div>
                     </div>
                </div>
             </div>
          </section>
        )}
        
        {hasGeneratedSchedule && (
          <section id="schedule" className="animate-in fade-in-50 duration-500 space-y-8">
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
                <div className="flex flex-wrap gap-2 mt-4">
                    <Button onClick={onGenerate} disabled={!priorities.length || isGenerating}>
                        <RefreshCw className="mr-2 h-4 w-4"/> Re-generate
                    </Button>
                    <Button onClick={onSync} disabled={isSyncing}>
                        {isSyncing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Syncing...</> : <><Calendar className="mr-2 h-4 w-4"/>Sync to Google Calendar</>}
                    </Button>
                </div>
                </>
              )}
            </div>
            
            <Separator />

            {/* Rework and Future Planning sections */}
            <div className="grid md:grid-cols-2 gap-8">
                <section id="rework">
                    <h2 className="text-2xl font-bold flex items-center mb-2"><RefreshCw className="mr-2 text-primary"/> Rework Your Day</h2>
                    <p className="text-muted-foreground mb-4">You can edit the schedule text in the box above, then tell the AI what happened to adjust.</p>
                    <Card>
                        <form action={onRework}>
                            <CardContent className="pt-6 space-y-4">
                                <div>
                                    <Label htmlFor="newConstraints">Context for Rework</Label>
                                    <Input id="newConstraints" name="newConstraints" placeholder="e.g., Lunch ran an hour late." required />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <SubmitButton text="Rework My Day" loadingText="Reworking..." icon={RefreshCw} pending={isReworkPending}/>
                            </CardFooter>
                        </form>
                    </Card>
                </section>

                <section id="future">
                    <h2 className="text-2xl font-bold flex items-center mb-2"><Calendar className="mr-2 text-primary"/> Future Planning</h2>
                    <p className="text-muted-foreground mb-4">Plan your tomorrow, next week, or even next month.</p>
                    <Card>
                        <CardContent className="pt-6 flex flex-col items-center justify-center text-center text-muted-foreground p-16">
                            <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                            <p className="text-lg font-medium">Coming Soon</p>
                            <p>Get ready to conquer your future goals.</p>
                        </CardContent>
                    </Card>
                </section>
            </div>
          </section>
        )}

      </div>
    </>
  );
}
