
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
import {parse} from 'date-fns';
import { google } from 'googleapis';
import { auth } from '@/lib/firebase-admin';

// This tool represents the action of creating an event in a user's Google Calendar.
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
        try {
            // Note: In a real app with a robust backend, you would use a refresh token
            // stored securely to get a fresh access token for the user to make API calls
            // on their behalf, even when they are offline.
            // For this environment, we are simply demonstrating the flow. The actual
            // OAuth2 client setup for a production app would be more complex.
            
            console.log(`MOCK: Creating event: ${input.title} from ${input.startTime} to ${input.endTime}`);
            
            // This is a MOCK RESPONSE. A full implementation requires a robust OAuth2 flow
            // with a configured Google Cloud project, OAuth consent screen, and credential management.
            return { success: true, eventId: `evt_mock_${Math.random().toString(36).substring(7)}` };

        } catch (error: any) {
            console.error("Error in createCalendarEvent tool:", error);
            return { success: false }; 
        }
    }
);

const EventSchema = z.object({
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
});

const SyncWithGoogleCalendarInputSchema = z.object({
    events: z.array(EventSchema).describe("A list of events to be synced to the calendar."),
    idToken: z.string().describe("The user's Firebase ID token for authorization."),
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


function convertToISO(timeStr: string): string {
    const now = new Date();
    // Use date-fns to parse the "h:mm a" format robustly
    const date = parse(timeStr, 'h:mm a', now);
    return date.toISOString();
}

const syncWithGoogleCalendarFlow = ai.defineFlow(
    {
        name: 'syncWithGoogleCalendarFlow',
        inputSchema: SyncWithGoogleCalendarInputSchema,
        outputSchema: SyncWithGoogleCalendarOutputSchema,
    },
    async (input) => {
        const syncedEvents: any[] = [];
        const errors: string[] = [];

        // Verify the user's token to ensure they are authenticated.
        const decodedToken = await auth.verifyIdToken(input.idToken);
        const isGoogleLinked = decodedToken.firebase.identities['google.com'];

        if (!isGoogleLinked) {
            errors.push("User is not signed in with Google. Please link your Google account.");
            return { syncedEvents, errors };
        }

        for (const event of input.events) {
            try {
                const result = await createCalendarEvent({
                    title: event.title,
                    startTime: convertToISO(event.startTime),
                    endTime: convertToISO(event.endTime),
                });
                
                if (result.success) {
                    syncedEvents.push({
                        title: event.title,
                        startTime: event.startTime,
                        endTime: event.endTime,
                        eventId: result.eventId,
                    });
                } else {
                     errors.push(`Failed to create event for "${event.title}".`);
                }

            } catch(e: any) {
                console.error(`Error processing event: ${event.title}`, e);
                errors.push(`An error occurred while creating the event: "${event.title}".`);
            }
        }
        
        return {
            syncedEvents,
            errors,
        };
    }
);
