"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTaskError = toTaskError;
exports.listTasksForFamily = listTasksForFamily;
exports.listTasksForParent = listTasksForParent;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.deactivateTask = deactivateTask;
exports.loadCompletions = loadCompletions;
exports.completeTask = completeTask;
const client_1 = require("../../lib/supabase/client");
const taskData_1 = require("./taskData");
function client(provided) {
    return provided ?? (0, client_1.createClient)();
}
function toTaskError(error) {
    const message = String(error?.message ?? error ?? '');
    if (/jwt|session|auth/i.test(message))
        return 'Your session expired. Please sign in again.';
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
async function listTasksForFamily(familyId, provided) {
    const { data, error } = await client(provided)
        .from('tasks')
        .select('*')
        .eq('family_id', familyId)
        .order('task_time', { ascending: true });
    if (error)
        throw error;
    return (data ?? []);
}
async function listTasksForParent(parentId, provided) {
    const { data, error } = await client(provided)
        .from('tasks')
        .select('*')
        .eq('assigned_to', parentId)
        .eq('is_active', true)
        .order('task_time', { ascending: true });
    if (error)
        throw error;
    return (data ?? []);
}
async function createTask(draft, provided) {
    const { data, error } = await client(provided)
        .from('tasks')
        .insert((0, taskData_1.toTaskInsert)(draft))
        .select('*')
        .single();
    if (error)
        throw error;
    return data;
}
async function updateTask(taskId, draft, provided) {
    const { data, error } = await client(provided)
        .from('tasks')
        .update((0, taskData_1.toTaskUpdate)(draft))
        .eq('id', taskId)
        .select('*')
        .single();
    if (error)
        throw error;
    return data;
}
async function deactivateTask(taskId, provided) {
    const { data, error } = await client(provided)
        .from('tasks')
        .update({ is_active: false })
        .eq('id', taskId)
        .select('*')
        .single();
    if (error)
        throw error;
    return data;
}
async function loadCompletions(input, provided) {
    const { data, error } = await client(provided)
        .from('task_completions')
        .select('*')
        .eq('family_id', input.familyId)
        .gte('scheduled_for', input.fromIso)
        .lt('scheduled_for', input.toIso)
        .order('scheduled_for', { ascending: true });
    if (error)
        throw error;
    return (data ?? []);
}
async function completeTask(input, provided) {
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
    if (error)
        throw error;
    return data;
}
