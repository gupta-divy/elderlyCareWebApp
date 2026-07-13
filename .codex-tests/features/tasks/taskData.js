"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLocalDateKey = normalizeLocalDateKey;
exports.mapTaskRow = mapTaskRow;
exports.toTaskInsert = toTaskInsert;
exports.toTaskUpdate = toTaskUpdate;
exports.getCompletionForOccurrence = getCompletionForOccurrence;
exports.isOccurrenceMissed = isOccurrenceMissed;
exports.mapCompletionStatus = mapCompletionStatus;
exports.buildTaskViewsForDate = buildTaskViewsForDate;
exports.filterTasksForParent = filterTasksForParent;
exports.canParentCompleteTask = canParentCompleteTask;
const taskRecurrence_1 = require("./taskRecurrence");
function normalizeLocalDateKey(dateKey, fallback = new Date()) {
    return dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
        ? dateKey
        : fallback.toISOString().slice(0, 10);
}
function mapTaskRow(row) {
    return {
        id: row.id,
        familyId: row.family_id,
        assignedParentId: row.assigned_to,
        createdByChildId: row.created_by,
        title: row.title,
        time: row.task_time.slice(0, 5),
        startDate: row.start_date,
        repeat: row.repeat_type,
        selectedWeekdays: row.repeat_type === 'set_days' ? row.repeat_days ?? [] : undefined,
        ringAlarm: row.requires_alarm,
        requiresPhoto: row.requires_photo,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toTaskInsert(draft) {
    return {
        family_id: draft.familyId,
        assigned_to: draft.assignedTo,
        created_by: draft.createdBy,
        title: draft.title.trim(),
        task_time: draft.taskTime,
        start_date: normalizeLocalDateKey(draft.startDate),
        repeat_type: draft.repeatType,
        repeat_days: draft.repeatType === 'set_days' ? [...(draft.repeatDays ?? [])].sort() : null,
        requires_alarm: draft.requiresAlarm,
        requires_photo: draft.requiresPhoto,
        is_active: true,
    };
}
function toTaskUpdate(draft) {
    return {
        assigned_to: draft.assignedTo,
        title: draft.title.trim(),
        task_time: draft.taskTime,
        start_date: normalizeLocalDateKey(draft.startDate),
        repeat_type: draft.repeatType,
        repeat_days: draft.repeatType === 'set_days' ? [...(draft.repeatDays ?? [])].sort() : null,
        requires_alarm: draft.requiresAlarm,
        requires_photo: draft.requiresPhoto,
        is_active: true,
    };
}
function getCompletionForOccurrence(completions, taskId, scheduledFor) {
    return completions.find((completion) => completion.task_id === taskId &&
        new Date(completion.scheduled_for).getTime() === new Date(scheduledFor).getTime());
}
function isOccurrenceMissed(scheduledFor, now = new Date()) {
    const due = new Date(scheduledFor);
    due.setMinutes(due.getMinutes() + taskRecurrence_1.TASK_GRACE_PERIOD_MINUTES);
    return now.getTime() > due.getTime();
}
function mapCompletionStatus(status) {
    return status === 'completed' ? 'done' : 'missed';
}
function buildTaskViewsForDate(tasks, completions, dateKey, now = new Date()) {
    return tasks
        .map(mapTaskRow)
        .filter((task) => task.isActive && (0, taskRecurrence_1.doesTaskOccurOnDate)(task, new Date(`${dateKey}T00:00:00`)))
        .map((task) => {
        const scheduledFor = (0, taskRecurrence_1.getScheduledForLocalDate)(dateKey, task.time);
        const completion = getCompletionForOccurrence(completions, task.id, scheduledFor);
        const cloudStatus = completion?.status ?? (isOccurrenceMissed(scheduledFor, now) ? 'missed' : 'pending');
        const status = completion
            ? mapCompletionStatus(completion.status)
            : cloudStatus === 'missed'
                ? 'missed'
                : 'pending';
        return {
            ...task,
            occurrenceId: `occ-${task.id}-${dateKey}`,
            scheduledFor,
            status,
            completedAt: completion?.completed_at ?? undefined,
            photoConfirmed: completion?.status === 'completed' && Boolean(completion.photo_path),
            proofUrl: completion?.photo_path ?? undefined,
            familyId: task.familyId,
            completionId: completion?.id,
            cloudStatus,
        };
    })
        .sort((left, right) => new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime());
}
function filterTasksForParent(tasks, parentId) {
    return tasks.filter((task) => task.assigned_to === parentId);
}
function canParentCompleteTask(task, userId, familyId) {
    return task.family_id === familyId && task.assigned_to === userId && task.is_active;
}
