// Every response is JSON: { ok: true, data } or { ok: false, code }. Business problems (e.g. "last
// admin") are 200 with ok:false so the app can show a message; auth and request problems use 4xx.

import { corsHeaders } from './cors.ts';

export type ActionResult =
  { ok: true; data: Record<string, unknown> } | { ok: false; code: string };

export function succeed(data: Record<string, unknown> = {}): ActionResult {
  return { ok: true, data };
}

export function fail(code: string): ActionResult {
  return { ok: false, code };
}

export function respond(result: ActionResult, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(result), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}
