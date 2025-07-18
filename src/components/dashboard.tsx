
"use client";

import { useState, useTransition } from "react";
import {
  handleAssessPriority,
  handleGenerateSchedule,
  handleReworkSchedule,
} from "@/lib/actions";
import type { ScheduleTask } from "@/lib/types";
import type { PriorityItem } from "@/ai/flows/assess-priority";

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
  CheckCircle,
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
  return scheduleText
    .split("\n")
    .filter((line) => line.trim().match(/^\d{1,2}:\d{2}\s?[AP]M/))
    .map((line) => {
      const timeMatch = line.match(/^(\d{1,2}:\d{2}\s?[AP]M\s?-\s?\d{1,2}:\d{2}\s?[AP]M)/);
      const taskMatch = line.replace(/^(\d{1,2}:\d{2}\s?[AP]M\s?-\s?\d{1,2}:\d{2}\s?[AP]M:?\s?-?\s?)/, '');
      return {
        time: timeMatch ? timeMatch[1] : "All-day",
        task: taskMatch.trim(),
      };
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

export function Dashboard() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [reasoning, setReasoning] = useState<string>("");
  const [schedule, setSchedule] = useState<ScheduleTask[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reworkedSchedule, setReworkedSchedule] = useState<{revisedSchedule: string; reasoning: string} | null>(null);
  
  const sensors = useSensors(useSensor(PointerSensor));

  const onAssess = (formData: FormData) => {
    startTransition(async () => {
      const result = await handleAssessPriority({ userGoals: formData.get('userGoals') as string });
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error Assessing Priorities",
          description: Object.values(result.error).flat().join('\n') || "Please check your input and try again.",
        });
      } else if (result.data) {
        setPriorities(result.data.priorityList);
        setReasoning(result.data.reasoning);
        setSchedule([]);
        setReworkedSchedule(null);
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
    setSchedule([]);
    // Use the reordered priorities
    const priorityText = priorities.map(p => p.text).join(', ');
    const input = {
      priority: priorityText,
      calendarEvents: "Team Standup at 10:00 AM - 11:00 AM, Project Sync at 5:00 PM - 6:00 PM",
    };
    const result = await handleGenerateSchedule(input);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error Generating Schedule",
        description: result.error,
      });
    } else if (result.data) {
      setSchedule(parseSchedule(result.data.schedule));
    }
    setIsGenerating(false);
  };

  const onRework = (formData: FormData) => {
    startTransition(async () => {
        const input = {
            originalSchedule: formData.get("originalSchedule") as string,
            completedTasks: (formData.get("completedTasks") as string).split(',').map(s => s.trim()).filter(Boolean),
            remainingTime: formData.get("remainingTime") as string,
            newConstraints: formData.get("newConstraints") as string,
            userGoals: formData.get("userGoals") as string,
        };
        
        const result = await handleReworkSchedule(input);
        if (result.error) {
            toast({
                variant: "destructive",
                title: "Error Reworking Schedule",
                description: Object.values(result.error).flat().join('\n') || "Please check your input and try again.",
            });
            setReworkedSchedule(null);
        } else if (result.data) {
            setReworkedSchedule(result.data);
            toast({
                title: "Schedule Reworked!",
                description: "Your new schedule is ready.",
            });
        }
    });
  }

  const resetAll = () => {
    setPriorities([]);
    setReasoning("");
    setSchedule([]);
    setReworkedSchedule(null);
  };

  return (
    <>
      <Header />
      <div className="container max-w-screen-lg mx-auto p-4 md:p-8 space-y-12">
        {/* Section 1: Assess Priorities */}
        <section id="plan">
          <Card className="border-none shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-3xl font-bold flex items-center text-primary"><Sparkles className="mr-3 h-8 w-8" /> Plan Your Day</CardTitle>
              <CardDescription className="text-lg">Tell the AI what you want to achieve to get a prioritized list. The more detail, the better.</CardDescription>
            </CardHeader>
            <form action={onAssess}>
              <CardContent>
                <Textarea
                  name="userGoals"
                  placeholder="e.g., Finish the Q3 report, prepare for the client presentation, learn a new chapter on React, and go for a run..."
                  className="min-h-[120px] text-base"
                  required
                />
              </CardContent>
              <CardFooter className="flex-col sm:flex-row gap-4 items-start">
                 <SubmitButton text="Assess Priorities" loadingText="Assessing..." icon={Send} pending={isPending} />
                 <Button type="button" variant="ghost" onClick={resetAll}>
                    <RefreshCw className="mr-2 h-4 w-4"/> Start Over
                </Button>
              </CardFooter>
            </form>
          </Card>
        </section>

        {/* Section 2: Drag-and-Drop Priorities & Generation */}
        {priorities.length > 0 && (
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
        
        {/* Section 3: Generated Schedule */}
        {(isGenerating || schedule.length > 0) && (
          <section id="schedule" className="animate-in fade-in-50 duration-500">
            <h2 className="text-2xl font-bold flex items-center mb-4"><Sparkles className="mr-2 text-primary"/> Your Generated Schedule</h2>
            {isGenerating ? (
               <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-lg">
                  <Loader2 className="mr-3 h-8 w-8 animate-spin text-primary"/>
                  <span className="text-xl mt-4">AI is crafting your perfect day...</span>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {schedule.map((task, i) => (
                      <div key={i} className="flex items-center p-3 rounded-lg bg-card-foreground/5">
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/20 text-primary font-bold mr-4 shrink-0">
                              <CheckCircle size={20}/>
                          </div>
                          <div>
                              <p className="font-semibold">{task.task}</p>
                              <p className="text-sm text-muted-foreground">{task.time}</p>
                          </div>
                      </div>
                  ))}
                </CardContent>
                <CardFooter className="gap-2">
                    <Button variant="secondary" onClick={onGenerate} disabled={!priorities.length || isGenerating}>
                        <RefreshCw className="mr-2 h-4 w-4"/> Re-shuffle
                    </Button>
                </CardFooter>
              </Card>
            )}
          </section>
        )}

        <Separator />
        
        {/* Section 4: Rework Schedule */}
        <section id="rework">
            <h2 className="text-2xl font-bold flex items-center mb-2"><RefreshCw className="mr-2 text-primary"/> Rework Your Day</h2>
            <p className="text-muted-foreground mb-4">Things change. Paste your schedule, tell us what you did, and we'll adjust the rest of your day.</p>
            <Card>
                <form action={onRework}>
                    <CardContent className="pt-6 space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="userGoalsRework">Your Original Goals</Label>
                                <Input id="userGoalsRework" name="userGoals" placeholder="e.g., Finish report, learn React" required />
                            </div>
                             <div>
                                <Label htmlFor="remainingTime">Time Remaining Today</Label>
                                <Input id="remainingTime" name="remainingTime" placeholder="e.g., 4 hours" required />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="originalSchedule">Original Schedule</Label>
                            <Textarea id="originalSchedule" name="originalSchedule" placeholder="Paste your generated schedule here." className="min-h-[150px]" required/>
                        </div>
                        <div>
                            <Label htmlFor="completedTasks">Tasks You've Completed (comma-separated)</Label>
                            <Input id="completedTasks" name="completedTasks" placeholder="e.g., Morning standup, Drafted email" />
                        </div>
                        <div>
                            <Label htmlFor="newConstraints">New Constraints or Events</Label>
                            <Input id="newConstraints" name="newConstraints" placeholder="e.g., Unexpected meeting at 3 PM" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton text="Rework My Day" loadingText="Reworking..." icon={RefreshCw} pending={isPending}/>
                    </CardFooter>
                </form>
            </Card>

             {reworkedSchedule && (
                <Card className="mt-6 animate-in fade-in-50">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Sparkles className="mr-2 text-primary"/> Your Revised Schedule</CardTitle>
                        <CardDescription>{reworkedSchedule.reasoning}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {parseSchedule(reworkedSchedule.revisedSchedule).map((task, i) => (
                             <div key={i} className="flex items-center p-3 rounded-lg bg-card-foreground/5">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/20 text-primary font-bold mr-4">
                                    <CheckCircle size={20}/>
                                </div>
                                <div>
                                    <p className="font-semibold">{task.task}</p>
                                    <p className="text-sm text-muted-foreground">{task.time}</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </section>

        <Separator />
        
        {/* Section 5: Future Planning */}
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
    </>
  );
}
