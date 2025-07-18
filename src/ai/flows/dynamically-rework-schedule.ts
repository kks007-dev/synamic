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
  originalSchedule: z.string().describe('The user\'s original schedule for the day.'),
  completedTasks: z.array(z.string()).describe('A list of tasks that the user has already completed.'),
  remainingTime: z.string().describe('The amount of time remaining in the day (e.g., "3 hours").'),
  newConstraints: z
    .string() 
    .optional()
    .describe('Any new constraints or unexpected events that have occurred (optional).'),
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
  prompt: `You are an AI assistant that helps users dynamically adjust their schedules when they deviate from their original plans.

  The user provides their original schedule, a list of completed tasks, the remaining time in the day, any new constraints or unexpected events, and their overall goals for the day.

  Based on this information, you will revise the schedule to best align with the user\'s goals, reprioritizing tasks or suggesting alternative activities as needed.

  Original Schedule: {{{originalSchedule}}}
  Completed Tasks: {{#each completedTasks}}{{{this}}}, {{/each}}
  Remaining Time: {{{remainingTime}}}
  New Constraints: {{{newConstraints}}}
  User Goals: {{{userGoals}}}

  Revised Schedule:`, // The prompt should clearly instruct the LLM to use the available tools when appropriate. It doesn't need to force the use of tools, but it should guide the LLM.
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
