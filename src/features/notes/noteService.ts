import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/client';
import {
  sanitizeSharedNoteContent,
  type FamilyNoteRow,
} from './noteData';

type Client = SupabaseClient;

function client(provided?: Client) {
  return provided ?? createClient();
}

function isDuplicateError(error: unknown) {
  const message = String((error as { code?: string; message?: string })?.code ?? '')
    + String((error as { message?: string })?.message ?? '');
  return /23505|duplicate|unique/i.test(message);
}

export function toNoteError(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  if (/jwt|session|auth/i.test(message)) return 'Your session expired. Please sign in again.';
  if (/permission denied|row-level security|42501|unauthorized/i.test(message)) {
    return 'You do not have permission to access this family note.';
  }
  if (/family_notes_content_length_check|23514|too long|length/i.test(message)) {
    return 'The note must be 5,000 characters or less.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Network error. Please check your connection and retry.';
  }
  return 'We could not save the note. Please try again.';
}

export async function getFamilyNote(familyId: string, provided?: Client) {
  const { data, error } = await client(provided)
    .from('family_notes')
    .select('*')
    .eq('family_id', familyId)
    .maybeSingle();

  if (error) throw error;
  return data as FamilyNoteRow | null;
}

export async function upsertFamilyNote(input: {
  familyId: string;
  content: string;
  updatedBy: string;
}, provided?: Client) {
  const supabase = client(provided);
  const payload = {
    content: sanitizeSharedNoteContent(input.content),
    updated_by: input.updatedBy,
  };
  const { data: updatedData, error: updateError } = await supabase
    .from('family_notes')
    .update(payload)
    .eq('family_id', input.familyId)
    .select('*')
    .maybeSingle();

  if (updateError) throw updateError;
  if (updatedData) return updatedData as FamilyNoteRow;

  const { data, error } = await supabase
    .from('family_notes')
    .insert({
      family_id: input.familyId,
      ...payload,
    })
    .select('*')
    .single();

  if (error) {
    if (!isDuplicateError(error)) throw error;

    const { data: retryData, error: retryError } = await supabase
      .from('family_notes')
      .update(payload)
      .eq('family_id', input.familyId)
      .select('*')
      .single();

    if (retryError) throw retryError;
    return retryData as FamilyNoteRow;
  }

  return data as FamilyNoteRow;
}
