'use server';

/**
 * @fileOverview An AI agent that syncs a generated schedule with Google Calendar.
 * 
 * - syncWithGoogleCalendar - A function that handles the Google Calendar sync process.
 * - SyncWithGoogleCalendarInput - The input type for the syncWithGoogleCalendar function.
 * - SyncWithGoogleCalendarOutput - The return type for the syncWithGoogleCalendar function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Placeholder for a real Google Calendar API client
const createCalendarEvent = ai.defineTool(
    {
        name: 'createCalendarEvent',
        description: 'Creates a new event in the user\'s Google Calendar.',
        inputSchema: z.object({
            title: z.string().describe('The title of the calendar event.'),
            startTime: z.string().describe('The start time of the event in ISO 8601 format.'),
            endTime: z.string().describe('The end time of the event in ISO 8601 format.'),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            eventId: z.string().optional(),
        }),
    },
    async (input) => {
        // In a real application, you would use the user's oauthToken
        // to make an API call to Google Calendar here.
        console.log(`Creating event: ${input.title} from ${input.startTime} to ${input.endTime}`);
        // This is a mock response.
        return { success: true, eventId: `evt_${Math.random().toString(36).substring(7)}` };
    }
);


const SyncWithGoogleCalendarInputSchema = z.object({
    schedule: z.string().describe('The full text of the schedule to be synced.'),
    oauthToken: z.string().describe("The user's OAuth token for Google Calendar API access."),
});
export type SyncWithGoogleCalendarInput = z.infer<typeof SyncWithGoogleCalendarInputSchema>;

const SyncWithGoogleCalendarOutputSchema = z.object({
    syncedEvents: z.array(z.object({
        title: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        eventId: z.string().optional(),
    })).describe('A list of events that were successfully synced.'),
    errors: z.array(z.string()).describe('Any errors that occurred during the sync process.'),
});
export type SyncWithGoogleCalendarOutput = z.infer<typeof SyncWithGoogleCalendarOutputSchema>;

export async function syncWithGoogleCalendar(input: SyncWithGoogleCalendarInput): Promise<SyncWithGoogleCalendarOutput> {
    return syncWithGoogleCalendarFlow(input);
}


const prompt = ai.definePrompt({
    name: 'syncWithGoogleCalendarPrompt',
    input: { schema: SyncWithGoogleCalendarInputSchema },
    // output: { schema: SyncWithGoogleCalendarOutputSchema }, We let the AI call tools and we will formulate the output
    tools: [createCalendarEvent],
    prompt: `You are an assistant that processes a user's daily schedule and creates corresponding events in their Google Calendar using the provided tools.

    The user's schedule is provided below. Parse each line to identify the task title, start time, and end time.
    Today's date is ${new Date().toDateString()}. Use this to construct full ISO 8601 timestamps for each event.
    
    For each valid task in the schedule, call the \`createCalendarEvent\` tool with the correct parameters.
    
    Schedule:
    {{{schedule}}}
    `,
});

const syncWithGoogleCalendarFlow = ai.defineFlow(
    {
        name: 'syncWithGoogleCalendarFlow',
        inputSchema: SyncWithGoogleCalendarInputSchema,
        outputSchema: SyncWithGoogleCalendarOutputSchema,
    },
    async (input) => {
        const {history} = await ai.generate({
            prompt: prompt.render({input}),
            tools: [createCalendarEvent],
            history: []
        });
        
        const lastContent = history[history.length - 1]?.content;

        if (!lastContent) {
            throw new Error("The AI failed to process the schedule for calendar sync.");
        }

        const syncedEvents: any[] = [];
        const errors: string[] = [];

        lastContent.forEach(part => {
            if (part.toolResponse) {
                if (part.toolResponse.result.success) {
                   const toolRequest = history.find(h => h.role === 'model' && h.content.find(c => c.toolRequest?.id === part.toolResponse?.id));
                   if(toolRequest) {
                       const requestPart = toolRequest.content.find(c => c.toolRequest?.id === part.toolResponse?.id);
                       if (requestPart && requestPart.toolRequest) {
                            syncedEvents.push({
                                title: requestPart.toolRequest.input.title,
                                startTime: requestPart.toolRequest.input.startTime,
                                endTime: requestPart.toolRequest.input.endTime,
                                eventId: part.toolResponse.result.eventId,
                            });
                       }
                   }
                } else {
                    errors.push(`Failed to create event.`);
                }
            }
        });

        if (syncedEvents.length === 0 && errors.length === 0) {
             errors.push("Could not parse any valid events from the provided schedule text.");
        }

        return {
            syncedEvents,
            errors,
        };
    }
);
