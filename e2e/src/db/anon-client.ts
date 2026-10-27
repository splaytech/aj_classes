import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { config } from '../config.js';

export interface AnonResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

const client = createClient(config.supabase.restUrl, config.supabase.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Thin wrappers over the anon-key PostgREST client, exposing the raw
 * PostgREST error (e.g. code 42501 for RLS denial) rather than throwing, so
 * specs can assert the rejection itself.
 */
export const anon = {
  async select<T = unknown>(table: string, columns = '*'): Promise<AnonResult<T[]>> {
    const { data, error } = await client.from(table).select(columns);
    return { data: data as T[] | null, error };
  },

  async insert<T = unknown>(table: string, row: Record<string, unknown>): Promise<AnonResult<T[]>> {
    const { data, error } = await client.from(table).insert(row).select();
    return { data: data as T[] | null, error };
  },

  async update<T = unknown>(
    table: string,
    match: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Promise<AnonResult<T[]>> {
    const { data, error } = await client.from(table).update(patch).match(match).select();
    return { data: data as T[] | null, error };
  },

  async delete<T = unknown>(
    table: string,
    match: Record<string, unknown>,
  ): Promise<AnonResult<T[]>> {
    const { data, error } = await client.from(table).delete().match(match).select();
    return { data: data as T[] | null, error };
  },
};
