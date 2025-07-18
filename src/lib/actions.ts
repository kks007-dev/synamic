"use server";

import { z } from "zod";
import { assessPriority, AssessPriorityInput } from "@/ai/flows/assess-priority";
import { generateSchedule, GenerateScheduleInput } from "@/ai/flows/generate-schedule";
import { dynamicallyReworkSchedule, DynamicallyReworkScheduleInput } from "@/ai/flows/dynamically-rework-schedule";

const assessPrioritySchema = z.object({
  userGoals: z.string().min(10, "Please describe your goals in a bit more detail."),
});

export async function handleAssessPriority(formData: FormData) {
  const rawInput = { userGoals: formData.get("userGoals") as string };
  const validation = assessPrioritySchema.safeParse(rawInput);

  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }
  
  try {
    const output = await assessPriority(validation.data as AssessPriorityInput);
    return { data: output };
  } catch (e) {
    return { error: { _form: ["An unexpected error occurred."] }};
  }
}

const generateScheduleSchema = z.object({
  priority: z.string().min(3, "Please select a valid priority."),
  calendarEvents: z.string(),
  learningGoal: z.string().optional(),
  otherGoals: z.string().optional(),
});

export async function handleGenerateSchedule(input: GenerateScheduleInput) {
  const validation = generateScheduleSchema.safeParse(input);

  if (!validation.success) {
    return { error: "Invalid input for schedule generation." };
  }

  try {
    const output = await generateSchedule(validation.data);
    return { data: output };
  } catch (e) {
    return { error: "Failed to generate schedule due to an unexpected error." };
  }
}


const reworkScheduleSchema = z.object({
  originalSchedule: z.string().min(10, "Please provide the original schedule."),
  completedTasks: z.string(),
  remainingTime: z.string().min(1, "Please specify the remaining time."),
  newConstraints: z.string().optional(),
  userGoals: z.string().min(10, "Please describe your goals."),
});

export async function handleReworkSchedule(formData: FormData) {
  const rawInput = {
    originalSchedule: formData.get("originalSchedule") as string,
    completedTasks: formData.get("completedTasks") as string,
    remainingTime: formData.get("remainingTime") as string,
    newConstraints: formData.get("newConstraints") as string,
    userGoals: formData.get("userGoals") as string,
  };

  const validation = reworkScheduleSchema.safeParse(rawInput);

  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const { completedTasks, ...rest } = validation.data;
  const completedTasksArray = completedTasks.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const output = await dynamicallyReworkSchedule({ ...rest, completedTasks: completedTasksArray });
    return { data: output };
  } catch (e) {
    return { error: { _form: ["An unexpected error occurred while reworking the schedule."] }};
  }
}