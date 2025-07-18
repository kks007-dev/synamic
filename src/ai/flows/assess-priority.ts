'use server';

/**
 * @fileOverview This file contains the Genkit flow for assessing user priorities.
 *
 * - assessPriority - A function that uses AI to help users identify their top priorities for the day.
 * - AssessPriorityInput - The input type for the assessPriority function.
 * - AssessPriorityOutput - The return type for the assessPriority function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AssessPriorityInputSchema = z.object({
  userGoals: z
    .string()
    .describe(
      'Description of the users goals, tasks, and commitments for the day.'
    ),
  userContext: z
    .string()
    .optional()
    .describe(
      'Optional context about the users current situation or any constraints they might have.'
    ),
});
export type AssessPriorityInput = z.infer<typeof AssessPriorityInputSchema>;

const PriorityItemSchema = z.object({
  id: z.string().describe("A unique ID for the priority item, e.g., 'priority-1'"),
  text: z.string().describe('The description of the priority task.'),
  timeOfDay: z.string().describe("Suggested time of day to complete the task, e.g., 'Morning - High Focus', 'Afternoon - Creative', 'Evening - Relaxed'"),
});

const AssessPriorityOutputSchema = z.object({
  priorityList: z
    .array(PriorityItemSchema)
    .describe('A list of the users top priorities for the day, including a suggested time.'),
  reasoning: z
    .string()
    .describe(
      'Explanation of why these items were chosen as top priorities and why they are suggested for a specific time of day.'
    ),
});
export type AssessPriorityOutput = z.infer<typeof AssessPriorityOutputSchema>;
export type PriorityItem = z.infer<typeof PriorityItemSchema>;

export async function assessPriority(input: AssessPriorityInput): Promise<AssessPriorityOutput> {
  return assessPriorityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assessPriorityPrompt',
  input: {schema: AssessPriorityInputSchema},
  output: {schema: AssessPriorityOutputSchema},
  prompt: `You are an AI assistant that helps users identify their top priorities for the day.

  Based on the user's goals, tasks, commitments, and any other context, determine the user's top priorities.
  For each priority, suggest an optimal time of day to complete it. Consider factors like mental energy (e.g., high-focus tasks in the morning, creative tasks in the afternoon, and more relaxed tasks in the evening).
  Provide a list of priorities with these time-of-day suggestions and explain the reasoning behind your choices.

  Goals/Tasks/Commitments: {{{userGoals}}}
  Context: {{{userContext}}}

  Priorities should be specific and actionable.
  Each priority must have a unique ID.
  Your reasoning should explain both the priority and the time-of-day suggestion.`,
});

const assessPriorityFlow = ai.defineFlow(
  {
    name: 'assessPriorityFlow',
    inputSchema: AssessPriorityInputSchema,
    outputSchema: AssessPriorityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
