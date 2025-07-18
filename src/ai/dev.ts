import { config } from 'dotenv';
config();

import '@/ai/flows/generate-schedule.ts';
import '@/ai/flows/assess-priority.ts';
import '@/ai/flows/dynamically-rework-schedule.ts';
import '@/ai/flows/sync-with-google-calendar.ts';
