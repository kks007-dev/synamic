
"use server";

import { z } from "zod";
import { assessPriority, AssessPriorityInput, AssessPriorityOutput } from "@/ai/flows/assess-priority";
import { generateSchedule, GenerateScheduleInput, GenerateScheduleOutput } from "@/ai/flows/generate-schedule";
import { dynamicallyReworkSchedule, DynamicallyReworkScheduleInput, DynamicallyReworkScheduleOutput } from "@/ai/flows/dynamically-rework-schedule";

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
