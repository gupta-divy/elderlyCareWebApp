"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_GRACE_PERIOD_MINUTES = void 0;
exports.combineLocalDateAndTime = combineLocalDateAndTime;
exports.getNextOccurrenceForInput = getNextOccurrenceForInput;
exports.getNextOccurrenceAfterTask = getNextOccurrenceAfterTask;
exports.buildOccurrenceId = buildOccurrenceId;
exports.isOccurrenceOverdue = isOccurrenceOverdue;
exports.doesTaskOccurOnDate = doesTaskOccurOnDate;
exports.getScheduledForLocalDate = getScheduledForLocalDate;
const helpers_1 = require("../../utils/helpers");
exports.TASK_GRACE_PERIOD_MINUTES = 120;
function parseTimeParts(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return [hours || 0, minutes || 0];
}
function combineLocalDateAndTime(dateKey, time) {
    const date = new Date(`${dateKey}T00:00:00`);
    const [hours, minutes] = parseTimeParts(time);
    date.setHours(hours, minutes, 0, 0);
    return date;
}
function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
function lastDayOfMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}
function resolveMonthlyDate(year, monthIndex, dayOfMonth) {
    return new Date(year, monthIndex, Math.min(dayOfMonth, lastDayOfMonth(year, monthIndex)));
}
function resolveYearlyDate(year, monthIndex, dayOfMonth) {
    return resolveMonthlyDate(year, monthIndex, dayOfMonth);
}
function pickAnchorDate(input, now) {
    if (input.startDate) {
        return (0, helpers_1.startOfDay)(new Date(`${input.startDate}T00:00:00`));
    }
    return (0, helpers_1.startOfDay)(now);
}
function nextWeekdayOnOrAfter(anchor, weekday) {
    const currentWeekday = anchor.getDay();
    const delta = (weekday - currentWeekday + 7) % 7;
    return addDays(anchor, delta);
}
function nextSelectedWeekday(selectedWeekdays, anchor, time, now) {
    const ordered = [...selectedWeekdays].sort((a, b) => a - b);
    for (const weekday of ordered) {
        const candidate = combineLocalDateAndTime((0, helpers_1.toDateKey)(nextWeekdayOnOrAfter(anchor, weekday)), time);
        if (candidate.getTime() >= now.getTime()) {
            return candidate;
        }
    }
    const first = ordered[0] ?? 0;
    return combineLocalDateAndTime((0, helpers_1.toDateKey)(addDays(nextWeekdayOnOrAfter(anchor, first), 7)), time);
}
function getNextOccurrenceForInput(input, now = new Date()) {
    const anchor = pickAnchorDate(input, now);
    const anchorDateKey = (0, helpers_1.toDateKey)(anchor);
    const anchorDateTime = combineLocalDateAndTime(anchorDateKey, input.time);
    const currentDay = (0, helpers_1.startOfDay)(now);
    switch (input.repeat) {
        case 'once':
            if (input.startDate) {
                return anchorDateTime;
            }
            return anchorDateTime.getTime() >= now.getTime()
                ? anchorDateTime
                : combineLocalDateAndTime((0, helpers_1.toDateKey)(addDays(anchor, 1)), input.time);
        case 'daily':
            if (anchorDateTime.getTime() >= now.getTime()) {
                return anchorDateTime;
            }
            return combineLocalDateAndTime((0, helpers_1.toDateKey)(anchor > currentDay ? anchor : addDays(currentDay, 1)), input.time);
        case 'weekly': {
            const anchorWeekday = input.startDate
                ? anchor.getDay()
                : now.getDay();
            return nextSelectedWeekday([anchorWeekday], anchor > currentDay ? anchor : currentDay, input.time, now);
        }
        case 'monthly': {
            const sourceDay = input.startDate ? anchor.getDate() : now.getDate();
            const monthCursor = anchor > currentDay ? anchor : currentDay;
            const firstCandidate = resolveMonthlyDate(monthCursor.getFullYear(), monthCursor.getMonth(), sourceDay);
            const firstOccurrence = combineLocalDateAndTime((0, helpers_1.toDateKey)(firstCandidate), input.time);
            if (firstOccurrence.getTime() >= now.getTime()) {
                return firstOccurrence;
            }
            const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
            const nextCandidate = resolveMonthlyDate(nextMonth.getFullYear(), nextMonth.getMonth(), sourceDay);
            return combineLocalDateAndTime((0, helpers_1.toDateKey)(nextCandidate), input.time);
        }
        case 'yearly': {
            const monthIndex = input.startDate ? anchor.getMonth() : now.getMonth();
            const dayOfMonth = input.startDate ? anchor.getDate() : now.getDate();
            const yearCursor = anchor > currentDay ? anchor.getFullYear() : now.getFullYear();
            const firstCandidate = resolveYearlyDate(yearCursor, monthIndex, dayOfMonth);
            const firstOccurrence = combineLocalDateAndTime((0, helpers_1.toDateKey)(firstCandidate), input.time);
            if (firstOccurrence.getTime() >= now.getTime()) {
                return firstOccurrence;
            }
            const nextCandidate = resolveYearlyDate(yearCursor + 1, monthIndex, dayOfMonth);
            return combineLocalDateAndTime((0, helpers_1.toDateKey)(nextCandidate), input.time);
        }
        case 'set_days':
            return nextSelectedWeekday(input.selectedWeekdays, anchor, input.time, now);
        default:
            return anchorDateTime;
    }
}
function getNextOccurrenceAfterTask(task, after) {
    if (!task.isActive)
        return undefined;
    const startDate = task.startDate ? new Date(`${task.startDate}T00:00:00`) : after;
    const input = {
        parentId: task.assignedParentId,
        title: task.title,
        time: task.time,
        startDate: task.startDate,
        repeat: task.repeat,
        selectedWeekdays: task.selectedWeekdays ?? [],
        ringAlarm: task.ringAlarm,
        requiresPhoto: task.requiresPhoto,
    };
    if (task.repeat === 'once') {
        const onlyOccurrence = getNextOccurrenceForInput(input, startDate);
        return onlyOccurrence.getTime() > after.getTime() ? onlyOccurrence : undefined;
    }
    return getNextOccurrenceForInput(input, new Date(after.getTime() + 1000));
}
function buildOccurrenceId(taskId, scheduledFor) {
    return `occ-${taskId}-${scheduledFor}`;
}
function isOccurrenceOverdue(occurrence, now, graceMinutes = exports.TASK_GRACE_PERIOD_MINUTES) {
    const dueTime = new Date(occurrence.scheduledFor);
    dueTime.setMinutes(dueTime.getMinutes() + graceMinutes);
    return now.getTime() > dueTime.getTime();
}
function doesTaskOccurOnDate(task, date) {
    const dateKey = (0, helpers_1.toDateKey)(date);
    const startDateKey = task.startDate ?? dateKey;
    const start = (0, helpers_1.startOfDay)(new Date(`${startDateKey}T00:00:00`));
    const target = (0, helpers_1.startOfDay)(new Date(`${dateKey}T00:00:00`));
    if (target.getTime() < start.getTime())
        return false;
    switch (task.repeat) {
        case 'once':
            return dateKey === startDateKey;
        case 'daily':
            return true;
        case 'weekly':
            return target.getDay() === start.getDay();
        case 'monthly': {
            const targetDay = target.getDate();
            const scheduledDay = Math.min(start.getDate(), lastDayOfMonth(target.getFullYear(), target.getMonth()));
            return targetDay === scheduledDay;
        }
        case 'yearly': {
            const scheduled = resolveYearlyDate(target.getFullYear(), start.getMonth(), start.getDate());
            return (0, helpers_1.toDateKey)(scheduled) === dateKey;
        }
        case 'set_days':
            return Boolean(task.selectedWeekdays?.includes(target.getDay()));
        default:
            return false;
    }
}
function getScheduledForLocalDate(dateKey, time) {
    return combineLocalDateAndTime(dateKey, time).toISOString();
}
