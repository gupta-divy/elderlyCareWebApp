import { startOfDay, toDateKey } from '../../utils/helpers';
export const TASK_GRACE_PERIOD_MINUTES = 120;
function parseTimeParts(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return [hours || 0, minutes || 0];
}
export function combineLocalDateAndTime(dateKey, time) {
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
        return startOfDay(new Date(`${input.startDate}T00:00:00`));
    }
    return startOfDay(now);
}
function nextWeekdayOnOrAfter(anchor, weekday) {
    const currentWeekday = anchor.getDay();
    const delta = (weekday - currentWeekday + 7) % 7;
    return addDays(anchor, delta);
}
function nextSelectedWeekday(selectedWeekdays, anchor, time, now) {
    const ordered = [...selectedWeekdays].sort((a, b) => a - b);
    for (const weekday of ordered) {
        const candidate = combineLocalDateAndTime(toDateKey(nextWeekdayOnOrAfter(anchor, weekday)), time);
        if (candidate.getTime() >= now.getTime()) {
            return candidate;
        }
    }
    const first = ordered[0] ?? 0;
    return combineLocalDateAndTime(toDateKey(addDays(nextWeekdayOnOrAfter(anchor, first), 7)), time);
}
export function getNextOccurrenceForInput(input, now = new Date()) {
    const anchor = pickAnchorDate(input, now);
    const anchorDateKey = toDateKey(anchor);
    const anchorDateTime = combineLocalDateAndTime(anchorDateKey, input.time);
    switch (input.repeat) {
        case 'none':
            if (input.startDate) {
                return anchorDateTime;
            }
            return anchorDateTime.getTime() >= now.getTime()
                ? anchorDateTime
                : combineLocalDateAndTime(toDateKey(addDays(anchor, 1)), input.time);
        case 'daily':
            return anchorDateTime.getTime() >= now.getTime()
                ? anchorDateTime
                : combineLocalDateAndTime(toDateKey(addDays(anchor, 1)), input.time);
        case 'weekly': {
            const anchorWeekday = input.startDate
                ? anchor.getDay()
                : now.getDay();
            return nextSelectedWeekday([anchorWeekday], anchor, input.time, now);
        }
        case 'monthly': {
            const sourceDay = input.startDate ? anchor.getDate() : now.getDate();
            const firstCandidate = resolveMonthlyDate(anchor.getFullYear(), anchor.getMonth(), sourceDay);
            const firstOccurrence = combineLocalDateAndTime(toDateKey(firstCandidate), input.time);
            if (firstOccurrence.getTime() >= now.getTime()) {
                return firstOccurrence;
            }
            const nextMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
            const nextCandidate = resolveMonthlyDate(nextMonth.getFullYear(), nextMonth.getMonth(), sourceDay);
            return combineLocalDateAndTime(toDateKey(nextCandidate), input.time);
        }
        case 'yearly': {
            const monthIndex = input.startDate ? anchor.getMonth() : now.getMonth();
            const dayOfMonth = input.startDate ? anchor.getDate() : now.getDate();
            const firstCandidate = resolveYearlyDate(anchor.getFullYear(), monthIndex, dayOfMonth);
            const firstOccurrence = combineLocalDateAndTime(toDateKey(firstCandidate), input.time);
            if (firstOccurrence.getTime() >= now.getTime()) {
                return firstOccurrence;
            }
            const nextCandidate = resolveYearlyDate(anchor.getFullYear() + 1, monthIndex, dayOfMonth);
            return combineLocalDateAndTime(toDateKey(nextCandidate), input.time);
        }
        case 'set_days':
            return nextSelectedWeekday(input.selectedWeekdays, anchor, input.time, now);
        default:
            return anchorDateTime;
    }
}
export function getNextOccurrenceAfterTask(task, after) {
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
    if (task.repeat === 'none') {
        const onlyOccurrence = getNextOccurrenceForInput(input, startDate);
        return onlyOccurrence.getTime() > after.getTime() ? onlyOccurrence : undefined;
    }
    return getNextOccurrenceForInput(input, new Date(after.getTime() + 1000));
}
export function buildOccurrenceId(taskId, scheduledFor) {
    return `occ-${taskId}-${scheduledFor}`;
}
export function isOccurrenceOverdue(occurrence, now, graceMinutes = TASK_GRACE_PERIOD_MINUTES) {
    const dueTime = new Date(occurrence.scheduledFor);
    dueTime.setMinutes(dueTime.getMinutes() + graceMinutes);
    return now.getTime() > dueTime.getTime();
}
