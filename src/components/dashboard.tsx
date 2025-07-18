"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  handleAssessPriority,
  handleGenerateSchedule,
  handleReworkSchedule,
} from "@/lib/actions";
import type { Priority, ScheduleTask } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Sparkles,
  CheckCircle,
  Clock,
  RefreshCw,
  ListTodo,
  Loader2,
  AlertTriangle,
  Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Header } from "./header";

const mockCalendarEvents = [
  { time: "10:00 AM - 11:00 AM", title: "Team Standup" },
  { time: "2:00 PM - 2:30 PM", title: "Doctor's Appointment" },
  { time: "5:00 PM - 6:00 PM", title: "Project Sync" },
];

function SubmitButton({ text, loadingText }: { text: string, loadingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {loadingText}
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" /> {text}
        </>
      )}
    </Button>
  );
}

function parseSchedule(scheduleText: string): ScheduleTask[] {
  if (!scheduleText) return [];
  return scheduleText
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const timeMatch = line.match(/^(\d{1,2}:\d{2}\s?[AP]M\s?-\s?\d{1,2}:\d{2}\s?[AP]M)/);
      const taskMatch = line.replace(/^(\d{1,2}:\d{2}\s?[AP]M\s?-\s?\d{1,2}:\d{2}\s?[AP]M:?\s?-?\s?)/, '');
      return {
        time: timeMatch ? timeMatch[1] : "All-day",
        task: taskMatch.trim()
      };
    });
}

export function Dashboard() {
  const { toast } = useToast();
  const [priorities, setPriorities] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [schedule, setSchedule] = useState<ScheduleTask[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reworkedSchedule, setReworkedSchedule] = useState<{revisedSchedule: string; reasoning: string} | null>(null);

  const [assessState, assessAction] = useFormState(handleAssessPriority, undefined);
  const [reworkState, reworkAction] = useFormState(handleReworkSchedule, undefined);
  
  const onAssess = async (formData: FormData) => {
    const result = await handleAssessPriority(formData);
    if(result.error) {
       toast({
        variant: "destructive",
        title: "Error Assessing Priorities",
        description: "Please check your input and try again.",
      });
    } else if (result.data) {
      setPriorities(result.data.priorityList);
      setReasoning(result.data.reasoning);
      setSelectedPriority("");
      setSchedule([]);
    }
  };

  const onGenerate = async (priority: string) => {
    if (!priority) {
      toast({
        variant: "destructive",
        title: "No Priority Selected",
        description: "Please select a priority to generate a schedule.",
      });
      return;
    }
    setIsGenerating(true);
    setSchedule([]);
    const input = {
      priority,
      calendarEvents: mockCalendarEvents.map(e => `${e.title} at ${e.time}`).join(', '),
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

  const onRework = async (formData: FormData) => {
    const result = await handleReworkSchedule(formData);
     if (result.error) {
       toast({
        variant: "destructive",
        title: "Error Reworking Schedule",
        description: "Please check your input and try again.",
      });
      setReworkedSchedule(null);
    } else if (result.data) {
      setReworkedSchedule(result.data);
       toast({
        title: "Schedule Reworked!",
        description: "Your new schedule is ready.",
      });
    }
  }


  return (
    <>
    <Header />
    <div className="container max-w-screen-xl mx-auto p-4 md:p-8">
      <main>
        <Tabs defaultValue="plan" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6">
            <TabsTrigger value="plan">Plan My Day</TabsTrigger>
            <TabsTrigger value="rework">Rework Schedule</TabsTrigger>
            <TabsTrigger value="future">Future Planning</TabsTrigger>
          </TabsList>

          {/* Plan My Day Tab */}
          <TabsContent value="plan" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Sparkles className="mr-2 text-primary" /> What are your goals for today?</CardTitle>
                    <CardDescription>Tell the AI what you want to achieve. The more detail, the better it can help you prioritize.</CardDescription>
                  </CardHeader>
                  <form action={onAssess}>
                    <CardContent>
                      <Textarea
                        name="userGoals"
                        placeholder="e.g., Finish the Q3 report, prepare for the client presentation, learn a new chapter on React, and go for a run..."
                        className="min-h-[120px]"
                        required
                      />
                    </CardContent>
                    <CardFooter>
                       <SubmitButton text="Assess Priorities" loadingText="Assessing..." />
                    </CardFooter>
                  </form>
                </Card>

                {priorities.length > 0 && (
                  <Card className="animate-in fade-in-50">
                    <CardHeader>
                      <CardTitle className="flex items-center"><ListTodo className="mr-2 text-primary"/> Suggested Priorities</CardTitle>
                      <CardDescription>{reasoning}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {priorities.map((p, i) => (
                        <Button
                          key={i}
                          variant={selectedPriority === p ? "default" : "secondary"}
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => setSelectedPriority(p)}
                        >
                          {p}
                        </Button>
                      ))}
                    </CardContent>
                     <CardFooter className="gap-2">
                        <Button onClick={() => onGenerate(selectedPriority)} disabled={!selectedPriority || isGenerating}>
                           {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Generating...</> : <><Sparkles className="mr-2 h-4 w-4"/>Generate Schedule</>}
                        </Button>
                        <Button variant="outline" onClick={() => { setPriorities([]); setReasoning(""); setSelectedPriority(""); setSchedule([]); }}>
                            <RefreshCw className="mr-2 h-4 w-4"/> Start Over
                        </Button>
                    </CardFooter>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Calendar className="mr-2 text-primary"/> Today's Events</CardTitle>
                    <CardDescription>Connected to your Google Calendar.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                     <div className="flex items-center text-sm text-green-400">
                        <CheckCircle className="mr-2 h-4 w-4"/>
                        <span>Calendar Synced</span>
                    </div>
                    {mockCalendarEvents.map((event, i) => (
                      <div key={i} className="flex items-start text-sm">
                        <Clock className="mr-3 mt-1 h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-muted-foreground">{event.time}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {(isGenerating || schedule.length > 0) && (
              <Card className="animate-in fade-in-50">
                <CardHeader>
                  <CardTitle className="flex items-center"><Sparkles className="mr-2 text-primary"/> Your Generated Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  {isGenerating ? (
                     <div className="flex items-center justify-center p-8 text-muted-foreground">
                        <Loader2 className="mr-3 h-6 w-6 animate-spin"/>
                        <span className="text-lg">AI is crafting your perfect day...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                        {schedule.map((task, i) => (
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
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                    <Button variant="secondary" onClick={() => onGenerate(selectedPriority)} disabled={!selectedPriority || isGenerating}>
                        <RefreshCw className="mr-2 h-4 w-4"/> Re-shuffle
                    </Button>
                    <Button><CheckCircle className="mr-2 h-4 w-4"/> Sync to Calendar</Button>
                </CardFooter>
              </Card>
            )}
          </TabsContent>

          {/* Rework Schedule Tab */}
          <TabsContent value="rework" className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><RefreshCw className="mr-2 text-primary"/> Rework Your Schedule</CardTitle>
                    <CardDescription>Things change. Paste your original schedule, tell us what you did, and we'll adjust the rest of your day.</CardDescription>
                </CardHeader>
                <form action={onRework}>
                    <CardContent className="space-y-4">
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
                        <SubmitButton text="Rework My Day" loadingText="Reworking..." />
                    </CardFooter>
                </form>
            </Card>

            {reworkedSchedule && (
                <Card className="animate-in fade-in-50">
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

          </TabsContent>

          {/* Future Planning Tab */}
          <TabsContent value="future">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Calendar className="mr-2 text-primary"/> Plan for the Future</CardTitle>
                    <CardDescription>This feature is coming soon! Plan your tomorrow, next week, or even next month.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground p-16">
                    <Loader2 className="h-12 w-12 mb-4 animate-spin"/>
                    <p className="text-lg font-medium">Coming Soon</p>
                    <p>Get ready to conquer your future goals.</p>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </>
  );
}
