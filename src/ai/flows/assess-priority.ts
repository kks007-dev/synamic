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

const AssessPriorityOutputSchema = z.object({
  priorityList: z
    .array(z.string())
    .describe('A list of the users top priorities for the day.'),
  reasoning: z
    .string()
    .describe(
      'Explanation of why these items were chosen as top priorities.'
    ),
});
export type AssessPriorityOutput = z.infer<typeof AssessPriorityOutputSchema>;

export async function assessPriority(input: AssessPriorityInput): Promise<AssessPriorityOutput> {
  return assessPriorityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assessPriorityPrompt',
  input: {schema: AssessPriorityInputSchema},
  output: {schema: AssessPriorityOutputSchema},
  prompt: `You are an AI assistant that helps users identify their top priorities for the day.

  Based on the users goals, tasks, commitments, and any other context, determine the users top priorities for the day.
  Provide a list of priorities and explain the reasoning behind your choices.

  Goals/Tasks/Commitments: {{{userGoals}}}
  Context: {{{userContext}}}

  Priorities should be specific and actionable.

  Format your response as follows:

  Priorities:
  - [Priority 1]
  - [Priority 2]
  - [Priority 3]

  Reasoning: [Explanation of why these were chosen as priorities]`,
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
