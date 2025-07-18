// src/ai/flows/generate-schedule.ts
'use server';

/**
 * @fileOverview AI agent for generating a daily schedule based on user priorities and calendar events.
 *
 * - generateSchedule - A function that generates a daily schedule.
 * - GenerateScheduleInput - The input type for the generateSchedule function.
 * - GenerateScheduleOutput - The return type for the generateSchedule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateScheduleInputSchema = z.object({
  priority: z
    .string()
    .describe('The user-specified utmost priority for the day.'),
  calendarEvents: z
    .string()
    .describe(
      'A description of calendar events including name and time to factor into the schedule.'
    ),
  learningGoal: z
    .string()
    .optional()
    .describe('An optional learning goal for the day.'),
  otherGoals: z
    .string()
    .optional()
    .describe('Any other goals the user wants to achieve during the day.'),
  startTime: z.string().optional().describe('The optional start time for the schedule (e.g., "9:00 AM").'),
  endTime: z.string().optional().describe('The optional end time for the schedule (e.g., "6:00 PM").'),
});
export type GenerateScheduleInput = z.infer<typeof GenerateScheduleInputSchema>;

const GenerateScheduleOutputSchema = z.object({
  schedule: z.string().describe('The generated daily schedule.'),
});
export type GenerateScheduleOutput = z.infer<typeof GenerateScheduleOutputSchema>;

export async function generateSchedule(
  input: GenerateScheduleInput
): Promise<GenerateScheduleOutput> {
  return generateScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSchedulePrompt',
  input: {schema: GenerateScheduleInputSchema},
  output: {schema: GenerateScheduleOutputSchema},
  prompt: `You are an AI assistant designed to generate an optimized daily schedule for users.

  Consider the user's utmost priority, calendar events, and any learning or other goals.
  Create a schedule that balances productivity and personal growth.
  The schedule should be framed by the provided start and end times. If not provided, assume a standard 9 AM to 6 PM workday.

  User Priority: {{{priority}}}
  Calendar Events: {{{calendarEvents}}}
  {{#if startTime}}Start Time: {{{startTime}}}{{/if}}
  {{#if endTime}}End Time: {{{endTime}}}{{/if}}
  Learning Goal: {{{learningGoal}}}
  Other Goals: {{{otherGoals}}}

  Please provide a detailed schedule for the day as a list of items.
  Each item in the schedule must have a specific time slot (e.g., "1:00 PM - 2:30 PM").
  The schedule should be realistic and account for breaks and transitions between activities.
  The schedule must also indicate the duration of each task.
  You MUST include a 1-hour lunch break around noon and a dinner break if the schedule extends into the evening.
  Do not deviate from the priority that the user provides.
`,
});

const generateScheduleFlow = ai.defineFlow(
  {
    name: 'generateScheduleFlow',
    inputSchema: GenerateScheduleInputSchema,
    outputSchema: GenerateScheduleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
