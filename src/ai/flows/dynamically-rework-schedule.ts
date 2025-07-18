'use server';
/**
 * @fileOverview An AI agent that dynamically adjusts a user's schedule based on deviations.
 *
 * - dynamicallyReworkSchedule - A function that handles the schedule rework process.
 * - DynamicallyReworkScheduleInput - The input type for the dynamicallyReworkSchedule function.
 * - DynamicallyReworkScheduleOutput - The return type for the dynamicallyReworkSchedule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DynamicallyReworkScheduleInputSchema = z.object({
  originalSchedule: z.string().describe('The user\'s original schedule for the day, which they may have edited.'),
  completedTasks: z.array(z.string()).describe('A list of tasks that the user has already completed. Can be empty.'),
  remainingTime: z.string().describe('The amount of time remaining in the day (e.g., "3 hours", "the rest of the day").'),
  newConstraints: z
    .string() 
    .optional()
    .describe('Any new constraints or unexpected events that have occurred (e.g. "Lunch was an hour late", "Unexpected meeting at 3pm"). This is the primary driver for the rework.'),
  userGoals: z.string().describe('The user\'s overall goals for the day.'),
});
export type DynamicallyReworkScheduleInput = z.infer<typeof DynamicallyReworkScheduleInputSchema>;

const DynamicallyReworkScheduleOutputSchema = z.object({
  revisedSchedule: z.string().describe('The AI-revised schedule for the remainder of the day.'),
  reasoning: z.string().describe('The AI\'s reasoning for the schedule adjustments.'),
});
export type DynamicallyReworkScheduleOutput = z.infer<typeof DynamicallyReworkScheduleOutputSchema>;

export async function dynamicallyReworkSchedule(input: DynamicallyReworkScheduleInput): Promise<DynamicallyReworkScheduleOutput> {
  return dynamicallyReworkScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'dynamicallyReworkSchedulePrompt',
  input: {schema: DynamicallyReworkScheduleInputSchema},
  output: {schema: DynamicallyReworkScheduleOutputSchema},
  prompt: `You are an AI assistant that helps users dynamically adjust their schedules.

  The user provides their original/edited schedule, any new constraints, and their overall goals for the day.
  Your main task is to revise the schedule based on the new constraints.
  
  Analyze the current time (it's ${new Date().toLocaleTimeString()}) and the provided schedule to figure out which tasks are likely completed.
  Then, reschedule the remaining tasks for the rest of the day, accommodating the new constraints.
  The new schedule should be a complete schedule for the whole day, including the parts that have already passed and the newly adjusted future parts.

  Original/Edited Schedule: 
  {{{originalSchedule}}}

  New Constraints/Events: 
  {{{newConstraints}}}

  User's Overall Goals: 
  {{{userGoals}}}

  Revise the full-day schedule and provide reasoning for your changes.`,
});

const dynamicallyReworkScheduleFlow = ai.defineFlow(
  {
    name: 'dynamicallyReworkScheduleFlow',
    inputSchema: DynamicallyReworkScheduleInputSchema,
    outputSchema: DynamicallyReworkScheduleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
