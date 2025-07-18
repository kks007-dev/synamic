
"use server";

import { z } from "zod";
import { assessPriority, AssessPriorityInput, AssessPriorityOutput } from "@/ai/flows/assess-priority";
import { generateSchedule, GenerateScheduleInput, GenerateScheduleOutput } from "@/ai/flows/generate-schedule";
import { dynamicallyReworkSchedule, DynamicallyReworkScheduleInput, DynamicallyReworkScheduleOutput } from "@/ai/flows/dynamically-rework-schedule";
import { syncWithGoogleCalendar, SyncWithGoogleCalendarInput, SyncWithGoogleCalendarOutput } from "@/ai/flows/sync-with-google-calendar";
import { auth } from "@/lib/firebase-admin";

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
  remainingTime: z.string().min(1, "Please specify the remaining time."),
  newConstraints: z.string().optional(),
  userGoals: z.string().min(10, "Please describe your goals."),
});

export async function handleReworkSchedule(input: DynamicallyReworkScheduleInput): Promise<{ data?: DynamicallyReworkScheduleOutput, error?: any }> {
  const rawInput = {
    ...input,
    completedTasks: Array.isArray(input.completedTasks) ? input.completedTasks : (input.completedTasks as unknown as string).split(',').map(s => s.trim()).filter(Boolean),
  };

  const validation = reworkScheduleSchema.safeParse(rawInput);

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

const syncToCalendarSchema = z.object({
    schedule: z.string().min(1, "A schedule is required to sync."),
});

export async function handleSyncToCalendar(input: SyncWithGoogleCalendarInput): Promise<{ data?: SyncWithGoogleCalendarOutput, error?: string }> {
    const validation = syncToCalendarSchema.safeParse(input);

    if (!validation.success) {
        return { error: "Invalid input for calendar sync." };
    }

    try {
        // Here you would typically get the user's OAuth token for Google Calendar.
        // For this example, we'll pass a placeholder. In a real app, this
        // would be securely retrieved after the user authenticates.
        const output = await syncWithGoogleCalendar({
            ...validation.data,
            // This is a placeholder and will need to be replaced with a real token
            // obtained from the user's Google Sign-In session.
            oauthToken: "USER_OAUTH_TOKEN_PLACEHOLDER",
        });
        return { data: output };
    } catch (e: any) {
        console.error("Error syncing to Google Calendar:", e);
        return { error: e.message || "Failed to sync to Google Calendar." };
    }
}
