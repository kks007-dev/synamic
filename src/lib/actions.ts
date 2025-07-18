
"use server";

import { z } from "zod";
import { assessPriority, AssessPriorityInput, AssessPriorityOutput } from "@/ai/flows/assess-priority";
import { generateSchedule, GenerateScheduleInput, GenerateScheduleOutput } from "@/ai/flows/generate-schedule";
import { dynamicallyReworkSchedule, DynamicallyReworkScheduleInput, DynamicallyReworkScheduleOutput } from "@/ai/flows/dynamically-rework-schedule";
import { syncWithGoogleCalendar, SyncWithGoogleCalendarInput, SyncWithGoogleCalendarOutput } from "@/ai/flows/sync-with-google-calendar";
import { headers } from "next/headers";

async function getUserIdToken(): Promise<string> {
    const authorization = headers().get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
        return authorization.substring(7);
    }
    throw new Error("User not authenticated.");
}


const assessPrioritySchema = z.object({
  userGoals: z.string().min(10, "Please describe your goals in a bit more detail."),
});

export async function handleAssessPriority(input: AssessPriorityInput): Promise<{ data?: AssessPriorityOutput, error?: any }> {
  const validation = assessPrioritySchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }
  
  try {
    const output = await assessPriority(validation.data);
    return { data: output };
  } catch (e: any) {
    console.error("Error assessing priority:", e);
    return { error: { _form: [e.message || "An unexpected error occurred."] }};
  }
}

const generateScheduleSchema = z.object({
  priority: z.string().min(3, "Please select a valid priority."),
  calendarEvents: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  learningGoal: z.string().optional(),
  otherGoals: z.string().optional(),
});

export async function handleGenerateSchedule(input: GenerateScheduleInput): Promise<{ data?: GenerateScheduleOutput, error?: string }> {
  const validation = generateScheduleSchema.safeParse(input);

  if (!validation.success) {
    return { error: "Invalid input for schedule generation." };
  }

  try {
    const output = await generateSchedule(validation.data);
    return { data: output };
  } catch (e: any) {
     console.error("Error generating schedule:", e);
    return { error: e.message || "Failed to generate schedule due to an unexpected error." };
  }
}


const reworkScheduleSchema = z.object({
  originalSchedule: z.string().min(10, "Please provide the original schedule."),
  completedTasks: z.array(z.string()),
  remainingTime: z.string(),
  newConstraints: z.string().min(1, "Please provide context for the rework."),
  userGoals: z.string().min(10, "Please describe your goals."),
});

export async function handleReworkSchedule(input: DynamicallyReworkScheduleInput): Promise<{ data?: DynamicallyReworkScheduleOutput, error?: any }> {
  const validation = reworkScheduleSchema.safeParse(input);

  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  try {
    const output = await dynamicallyReworkSchedule(validation.data);
    return { data: output };
  } catch (e: any) {
    console.error("Error reworking schedule:", e);
    return { error: { _form: [e.message || "An unexpected error occurred while reworking the schedule."] }};
  }
}

const eventSchema = z.object({
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
});

const syncToCalendarSchema = z.object({
    events: z.array(eventSchema).min(1, "At least one event is required to sync."),
});


export async function handleSyncToCalendar(input: { events: z.infer<typeof eventSchema>[] }): Promise<{ data?: SyncWithGoogleCalendarOutput, error?: string }> {
    const validation = syncToCalendarSchema.safeParse(input);
    
    if (!validation.success) {
        return { error: "Invalid input for calendar sync." };
    }

    try {
        const idToken = await getUserIdToken();

        const output = await syncWithGoogleCalendar({
            ...validation.data,
            idToken: idToken, 
        });
        if (output.errors.length > 0) {
            return { error: output.errors.join(', ') };
        }
        return { data: output };
    } catch (e: any) {
        console.error("Error syncing to Google Calendar:", e);
        return { error: e.message || "Failed to sync to Google Calendar." };
    }
}
