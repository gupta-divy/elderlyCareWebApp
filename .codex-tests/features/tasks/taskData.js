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
exports.buildRoutineAttentionItems = buildRoutineAttentionItems;
exports.buildCalendarEvents = buildCalendarEvents;
exports.eventSummary = eventSummary;
const taskRecurrence_1 = require("./taskRecurrence");
const helpers_1 = require("../../utils/helpers");
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
        itemType: row.item_type ?? 'routine_task',
        title: row.title,
        time: row.task_time?.slice(0, 5) ?? '',
        startDate: row.start_date,
        repeat: row.repeat_type,
        selectedWeekdays: row.repeat_type === 'set_days' ? row.repeat_days ?? [] : undefined,
        ringAlarm: row.requires_alarm,
        requiresPhoto: false,
        missNotificationThreshold: row.miss_notification_threshold ?? 3,
        consecutiveMissCount: row.consecutive_miss_count ?? 0,
        attentionActive: Boolean(row.attention_active),
        attentionRaisedAt: row.attention_raised_at ?? undefined,
        lastMissedOccurrenceAt: row.last_missed_occurrence_at ?? undefined,
        eventTimezone: row.event_timezone ?? undefined,
        eventReminderOneDaySentAt: row.event_reminder_one_day_sent_at ?? undefined,
        eventReminderTwoHoursSentAt: row.event_reminder_two_hours_sent_at ?? undefined,
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
        item_type: draft.itemType ?? 'routine_task',
        title: draft.title.trim(),
        task_time: draft.taskTime || null,
        start_date: normalizeLocalDateKey(draft.startDate),
        repeat_type: draft.itemType === 'calendar_event' ? 'once' : draft.repeatType,
        repeat_days: draft.itemType === 'routine_task' && draft.repeatType === 'set_days' ? [...(draft.repeatDays ?? [])].sort() : null,
        requires_alarm: draft.itemType === 'routine_task' && Boolean(draft.taskTime && draft.requiresAlarm),
        requires_photo: false,
        miss_notification_threshold: draft.itemType === 'calendar_event' ? 0 : draft.missNotificationThreshold ?? 3,
        event_timezone: draft.itemType === 'calendar_event' ? draft.eventTimezone ?? 'UTC' : null,
        is_active: true,
    };
}
function toTaskUpdate(draft) {
    return {
        assigned_to: draft.assignedTo,
        item_type: draft.itemType ?? 'routine_task',
        title: draft.title.trim(),
        task_time: draft.taskTime || null,
        start_date: normalizeLocalDateKey(draft.startDate),
        repeat_type: draft.itemType === 'calendar_event' ? 'once' : draft.repeatType,
        repeat_days: draft.itemType === 'routine_task' && draft.repeatType === 'set_days' ? [...(draft.repeatDays ?? [])].sort() : null,
        requires_alarm: draft.itemType === 'routine_task' && Boolean(draft.taskTime && draft.requiresAlarm),
        requires_photo: false,
        miss_notification_threshold: draft.itemType === 'calendar_event' ? 0 : draft.missNotificationThreshold ?? 3,
        event_timezone: draft.itemType === 'calendar_event' ? draft.eventTimezone ?? 'UTC' : null,
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
        .filter((task) => task.itemType === 'routine_task' && task.isActive && (0, taskRecurrence_1.doesTaskOccurOnDate)(task, new Date(`${dateKey}T00:00:00`)))
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
    return task.family_id === familyId && task.assigned_to === userId && task.is_active && (task.item_type ?? 'routine_task') === 'routine_task';
}
function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
function countConsecutiveMisses(task, completions, now = new Date()) {
    if (task.itemType !== 'routine_task' || task.missNotificationThreshold === 0) {
        return { count: 0 };
    }
    let count = 0;
    let lastMissedAt;
    const cursor = new Date(`${(0, helpers_1.toDateKey)(now)}T00:00:00`);
    for (let daysBack = 0; daysBack < 120; daysBack += 1) {
        const date = addDays(cursor, -daysBack);
        if (!(0, taskRecurrence_1.doesTaskOccurOnDate)(task, date))
            continue;
        const dateKey = (0, helpers_1.toDateKey)(date);
        const scheduledFor = (0, taskRecurrence_1.getScheduledForLocalDate)(dateKey, task.time);
        if (!isOccurrenceMissed(scheduledFor, now))
            continue;
        const completion = getCompletionForOccurrence(completions, task.id, scheduledFor);
        if (completion?.status === 'completed')
            break;
        if (completion?.status === 'skipped')
            break;
        count += 1;
        lastMissedAt ??= scheduledFor;
        if (count >= task.missNotificationThreshold)
            break;
    }
    return { count, lastMissedAt };
}
function buildRoutineAttentionItems(tasks, completions, parentNames = {}, now = new Date()) {
    return tasks
        .map(mapTaskRow)
        .filter((task) => task.isActive && task.itemType === 'routine_task')
        .map((task) => {
        const fromBackend = task.attentionActive && task.consecutiveMissCount >= task.missNotificationThreshold
            ? {
                count: task.consecutiveMissCount,
                lastMissedAt: task.lastMissedOccurrenceAt,
            }
            : countConsecutiveMisses(task, completions, now);
        return { task, ...fromBackend };
    })
        .filter(({ task, count }) => task.missNotificationThreshold > 0 && count >= task.missNotificationThreshold)
        .map(({ task, count, lastMissedAt }) => ({
        taskId: task.id,
        parentId: task.assignedParentId,
        parentName: parentNames[task.assignedParentId],
        title: task.title,
        consecutiveMisses: count,
        threshold: task.missNotificationThreshold,
        message: `${parentNames[task.assignedParentId] ?? 'Your parent'} has missed "${task.title}" ${count} times in a row.`,
        lastMissedAt,
    }));
}
function buildCalendarEvents(tasks, now = new Date()) {
    return tasks
        .filter((task) => task.is_active && (task.item_type ?? 'routine_task') === 'calendar_event')
        .map((task) => {
        const time = task.task_time?.slice(0, 5) ?? '00:00';
        const scheduledFor = (0, taskRecurrence_1.getScheduledForLocalDate)(task.start_date, time);
        return {
            id: task.id,
            familyId: task.family_id,
            parentId: task.assigned_to,
            title: task.title,
            date: task.start_date,
            time,
            timezone: task.event_timezone ?? 'UTC',
            scheduledFor,
            isUpcoming: new Date(scheduledFor).getTime() >= now.getTime(),
        };
    })
        .sort((left, right) => new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime());
}
function eventSummary(event) {
    return `${(0, helpers_1.formatDate)(event.scheduledFor)} at ${(0, helpers_1.formatLocalTime)(event.time)}`;
}
