// The service layer: the ONLY part of the app that talks to a backend.
//
// Components and sections import from '@/services' and call plain functions
// such as `submitEnquiry()`. Only files inside this folder may import backend
// clients (Web3Forms and Kit today; Supabase from Release 2). ESLint enforces this.
//
// Release 2 adds `supabase.client.ts` here (the single place that creates the
// Supabase client) and services such as `testimonials.service.ts`.

export { submitEnquiry } from './enquiry.service';
export { subscribe } from './subscription.service';
export type { SubmitResult } from './types';
