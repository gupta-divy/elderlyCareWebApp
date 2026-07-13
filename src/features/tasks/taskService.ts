import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/client';
import type { TaskCompletionRow, TaskDraft, TaskRow } from './taskData';
import { toTaskInsert, toTaskUpdate } from './taskData';

type Client = SupabaseClient;

function client(provided?: Client) {
  return provided ?? createClient();
}

export function toTaskError(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  if (/jwt|session|auth/i.test(message)) return 'Your session expired. Please sign in again.';
  if (/permission denied|row-level security|42501|unauthorized/i.test(message)) {
    return 'You do not have permission to access those tasks.';
  }
  if (/duplicate|unique|23505/i.test(message)) {
    return 'That task occurrence was already recorded.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Network error. Please check your connection and retry.';
  }
  return 'We could not update tasks. Please try again.';
}

export async function listTasksForFamily(familyId: string, provided?: Client) {
  const { data, error } = await client(provided)
    .from('tasks')
    .select('*')
    .eq('family_id', familyId)
    .order('task_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function listTasksForParent(parentId: string, provided?: Client) {
  const { data, error } = await client(provided)
    .from('tasks')
    .select('*')
    .eq('assigned_to', parentId)
    .eq('is_active', true)
    .order('task_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function createTask(draft: TaskDraft, provided?: Client) {
  const { data, error } = await client(provided)
    .from('tasks')
    .insert(toTaskInsert(draft))
    .select('*')
    .single();

  if (error) throw error;
  return data as TaskRow;
}

export async function updateTask(taskId: string, draft: Omit<TaskDraft, 'familyId' | 'createdBy'>, provided?: Client) {
  const { data, error } = await client(provided)
    .from('tasks')
    .update(toTaskUpdate(draft))
    .eq('id', taskId)
    .select('*')
    .single();

  if (error) throw error;
  return data as TaskRow;
}

export async function deactivateTask(taskId: string, provided?: Client) {
  const { data, error } = await client(provided)
    .from('tasks')
    .update({ is_active: false })
    .eq('id', taskId)
    .select('*')
    .single();

  if (error) throw error;
  return data as TaskRow;
}

export async function loadCompletions(input: {
  familyId: string;
  fromIso: string;
  toIso: string;
}, provided?: Client) {
  const { data, error } = await client(provided)
    .from('task_completions')
    .select('*')
    .eq('family_id', input.familyId)
    .gte('scheduled_for', input.fromIso)
    .lt('scheduled_for', input.toIso)
    .order('scheduled_for', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TaskCompletionRow[];
}

export async function completeTask(input: {
  taskId: string;
  familyId: string;
  completedBy: string;
  scheduledFor: string;
  photoPath?: string | null;
}, provided?: Client) {
  const { data, error } = await client(provided)
    .from('task_completions')
    .insert({
      task_id: input.taskId,
      family_id: input.familyId,
      completed_by: input.completedBy,
      scheduled_for: input.scheduledFor,
      status: 'completed',
      completed_at: new Date().toISOString(),
      photo_path: input.photoPath ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as TaskCompletionRow;
}
