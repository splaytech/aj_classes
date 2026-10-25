// Staff profiles: name, phone, subjects, bio, qualifications and photo (R2a stories US12, US13; item 4).
// The database decides who may change what (RLS); this file only reads and writes.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { toErrorKey } from './auth-errors';
import { attempt, fail, succeed } from './result';
import { getProfileClient } from './staff-client';
import { getSupabase } from './supabase.client';
import type { ProfileChanges, Result, StaffProfile } from './types';

const PHOTO_BUCKET = 'avatars';
const PROFILE_COLUMNS = 'id, email, full_name, bio, qualifications, subjects, avatar_path, phone';
const PHOTO_CACHE_SECONDS = '31536000'; // each upload gets a new name, so it can be cached for a year

const FILE_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};

type Client = SupabaseClient<Database>;
type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'email' | 'full_name' | 'bio' | 'qualifications' | 'subjects' | 'avatar_path' | 'phone'
>;

// --- Your own profile (R2a US12, US13) ------------------------------------------

export async function getMyProfile(): Promise<Result<StaffProfile>> {
  const userId = await signedInUserIdOrNull();
  return userId ? getProfile(userId) : fail('notActive');
}

export async function updateMyProfile(changes: ProfileChanges): Promise<Result<StaffProfile>> {
  const userId = await signedInUserIdOrNull();
  return userId ? updateProfile(userId, changes) : fail('notActive');
}

export async function uploadMyPhoto(photo: Blob): Promise<Result<StaffProfile>> {
  const userId = await signedInUserIdOrNull();
  return userId ? uploadPhoto(userId, photo) : fail('notActive');
}

export async function removeMyPhoto(): Promise<Result<StaffProfile>> {
  const userId = await signedInUserIdOrNull();
  return userId ? removePhoto(userId) : fail('notActive');
}

// --- Any profile: yours, or someone else's if you are an admin (R2a US18) ---------
// The database decides: staff may change only their own row; admins may change any row.

export async function getProfile(userId: string): Promise<Result<StaffProfile>> {
  return attempt(async () => {
    const supabase = await getProfileClient(userId);
    if (!supabase) return fail('notAllowed'); // not staff, or someone else's without admin two-step
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();
    if (error) return fail(toErrorKey(error));
    if (!data) return fail('notFound');

    return succeed(toStaffProfile(supabase, data));
  });
}

/** Saves name, subjects, bio, qualifications and phone. Returns the profile as saved. */
export async function updateProfile(
  userId: string,
  changes: ProfileChanges,
): Promise<Result<StaffProfile>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    return saveProfileColumns(supabase, userId, {
      full_name: changes.fullName.trim(),
      bio: changes.bio.trim(),
      qualifications: changes.qualifications,
      subjects: changes.subjects,
      // In the same statement, so a refused phone saves none of the other fields (AC-4.3).
      // Blank is sent as null; the database keeps "no number yet" and refuses clearing a saved one.
      phone: changes.phone.trim() || null,
    });
  });
}

/**
 * Stores a new photo (already resized by the browser) and points the profile at it.
 * Order: upload → update profile → delete the old file. If the update fails, the new
 * file is deleted again so nothing is left behind (R2a review V26).
 */
export async function uploadPhoto(userId: string, photo: Blob): Promise<Result<StaffProfile>> {
  const extension = FILE_EXTENSIONS[photo.type];
  if (!extension) return fail('photoNotSaved');

  return attempt(async () => {
    const supabase = await getSupabase();
    const current = await getProfile(userId);
    if (!current.ok) return current;

    const oldPath = current.data.photoPath;
    const newPath = `${userId}/${Date.now()}.${extension}`;

    const upload = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(newPath, photo, { contentType: photo.type, cacheControl: PHOTO_CACHE_SECONDS });
    if (upload.error) return fail('photoNotSaved');

    const saved = await saveProfileColumns(supabase, userId, { avatar_path: newPath });
    if (!saved.ok) {
      await supabase.storage.from(PHOTO_BUCKET).remove([newPath]);
      return saved;
    }

    if (oldPath) await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
    return saved;
  });
}

export async function removePhoto(userId: string): Promise<Result<StaffProfile>> {
  return attempt(async () => {
    const supabase = await getSupabase();
    const current = await getProfile(userId);
    if (!current.ok) return current;

    const saved = await saveProfileColumns(supabase, userId, { avatar_path: null });
    if (saved.ok && current.data.photoPath) {
      await supabase.storage.from(PHOTO_BUCKET).remove([current.data.photoPath]);
    }
    return saved;
  });
}

/**
 * Updates profile columns and reads the row back. If the database's access rules filter the
 * row out, Supabase reports no error, just no row, so "no row" counts as not saved (V29).
 */
async function saveProfileColumns(
  supabase: Client,
  userId: string,
  columns: Database['public']['Tables']['profiles']['Update'],
): Promise<Result<StaffProfile>> {
  const { data, error } = await supabase
    .from('profiles')
    .update(columns)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) return fail(toErrorKey(error));
  if (!data) return fail('notSaved');
  return succeed(toStaffProfile(supabase, data));
}

async function signedInUserIdOrNull(): Promise<string | null> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function toStaffProfile(supabase: Client, row: ProfileRow): StaffProfile {
  const photoUrl = row.avatar_path
    ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(row.avatar_path).data.publicUrl
    : null;

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    bio: row.bio,
    qualifications: row.qualifications,
    subjects: row.subjects,
    photoPath: row.avatar_path,
    photoUrl,
    phone: row.phone,
  };
}
