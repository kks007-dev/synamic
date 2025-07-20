
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
  schedule: z.string().optional().describe('An optional pre-generated schedule text to parse.'),
});
export type GenerateScheduleInput = z.infer<typeof GenerateScheduleInputSchema>;

const GenerateScheduleOutputSchema = z.object({
  schedule: z.string().describe('The generated daily schedule as a JSON string array. Each item should be an object with "time", "task", and "duration" properties.'),
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

  Your output MUST be a valid JSON array of objects. Each object in the array represents a scheduled task and must have the following properties: "time" (e.g., "1:00 PM - 2:30 PM"), "task" (a string describing the activity), and "duration" (e.g. "1.5 hours"). Do not output anything other than the JSON array.

  ONLY include events and tasks that are explicitly provided by the user in the input fields below (priority, calendarEvents, learningGoal, otherGoals). Do NOT add any extra events or tasks (such as meetings, standups, or similar) that are not present in the user's input. The ONLY exceptions are a 1-hour lunch break around noon and a dinner break if the schedule extends into the evening.

  Create a schedule that balances productivity and personal growth.
  The schedule should be framed by the provided start and end times. If not provided, assume a standard 9 AM to 6 PM workday.

  User Priority: {{{priority}}}
  Calendar Events: {{{calendarEvents}}}
  {{#if startTime}}Start Time: {{{startTime}}}{{/if}}
  {{#if endTime}}End Time: {{{endTime}}}{{/if}}
  Learning Goal: {{{learningGoal}}}
  Other Goals: {{{otherGoals}}}

  Please provide a detailed schedule for the day as a JSON array of objects.
  Each item in the schedule must have a specific time slot (e.g., "1:00 PM - 2:30 PM").
  The schedule should be realistic and account for breaks and transitions between activities.
  The schedule must also indicate the duration of each task.
  You MUST include a 1-hour lunch break around noon and a dinner break if the schedule extends into the evening.
  Do not deviate from the priority that the user provides.
`,
});

// Add a utility to strictly parse the user's schedule text into events
function parseScheduleText(scheduleText: string) {
  // Example line: "10:00 AM - 11:00 AM: Team Standup"
  const lines = scheduleText.split('\n').map(l => l.trim()).filter(Boolean);
  const events = [];
  for (const line of lines) {
    const match = line.match(/^(\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M): (.+)$/i);
    if (match) {
      events.push({
        startTime: match[1],
        endTime: match[2],
        title: match[3],
      });
    }
  }
  return events;
}

const generateScheduleFlow = ai.defineFlow(
  {
    name: 'generateScheduleFlow',
    inputSchema: GenerateScheduleInputSchema,
    outputSchema: GenerateScheduleOutputSchema,
  },
  async input => {
    // If the user provided a schedule text, parse and use only those events
    if (input.schedule) {
      const events = parseScheduleText(input.schedule);
      return { schedule: JSON.stringify(events) };
    }
    // Otherwise, fall back to the prompt-based generation (with strict prompt)
    const {output} = await prompt(input);
    return output!;
  }
);
