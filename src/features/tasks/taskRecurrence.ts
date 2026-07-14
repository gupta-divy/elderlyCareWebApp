import type {
  TaskOccurrence,
  TaskItemType,
  MissNotificationThreshold,
  TaskRepeat,
  TaskTemplate,
  TaskWeekday,
} from '../../types';
import { startOfDay, toDateKey } from '../../utils/helpers';

export const TASK_GRACE_PERIOD_MINUTES = 120;

export type TaskFormInput = {
  itemType: TaskItemType;
  parentId: string;
  title: string;
  time: string;
  startDate?: string;
  repeat: TaskRepeat;
  selectedWeekdays: TaskWeekday[];
  ringAlarm: boolean;
  requiresPhoto: boolean;
  missNotificationThreshold: MissNotificationThreshold;
  eventTimezone?: string;
};

export const DEFAULT_MISS_NOTIFICATION_THRESHOLD: MissNotificationThreshold = 3;

export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function parseTimeParts(time: string): [number, number] {
  const [hours, minutes] = time.split(':').map(Number);
  return [hours || 0, minutes || 0];
}

export function combineLocalDateAndTime(dateKey: string, time: string): Date {
  const date = new Date(`${dateKey}T00:00:00`);
  if (!time) {
    date.setHours(23, 59, 59, 999);
    return date;
  }
  const [hours, minutes] = parseTimeParts(time);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function resolveMonthlyDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDayOfMonth(year, monthIndex)));
}

function resolveYearlyDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  return resolveMonthlyDate(year, monthIndex, dayOfMonth);
}

function pickAnchorDate(input: TaskFormInput, now: Date): Date {
  if (input.startDate) {
    return startOfDay(new Date(`${input.startDate}T00:00:00`));
  }
  return startOfDay(now);
}

function nextWeekdayOnOrAfter(anchor: Date, weekday: TaskWeekday): Date {
  const currentWeekday = anchor.getDay() as TaskWeekday;
  const delta = (weekday - currentWeekday + 7) % 7;
  return addDays(anchor, delta);
}

function nextSelectedWeekday(
  selectedWeekdays: TaskWeekday[],
  anchor: Date,
  time: string,
  now: Date,
): Date {
  const ordered = [...selectedWeekdays].sort((a, b) => a - b);
  for (const weekday of ordered) {
    const candidate = combineLocalDateAndTime(
      toDateKey(nextWeekdayOnOrAfter(anchor, weekday)),
      time,
    );
    if (candidate.getTime() >= now.getTime()) {
      return candidate;
    }
  }

  const first = ordered[0] ?? 0;
  return combineLocalDateAndTime(
    toDateKey(addDays(nextWeekdayOnOrAfter(anchor, first), 7)),
    time,
  );
}

export function getNextOccurrenceForInput(input: TaskFormInput, now = new Date()): Date {
  if (input.itemType === 'calendar_event') {
    return combineLocalDateAndTime(input.startDate ?? toDateKey(now), input.time);
  }

  const anchor = pickAnchorDate(input, now);
  const anchorDateKey = toDateKey(anchor);
  const anchorDateTime = combineLocalDateAndTime(anchorDateKey, input.time);
  const currentDay = startOfDay(now);

  switch (input.repeat) {
    case 'once':
      if (input.startDate) {
        return anchorDateTime;
      }
      return anchorDateTime.getTime() >= now.getTime()
        ? anchorDateTime
        : combineLocalDateAndTime(toDateKey(addDays(anchor, 1)), input.time);
    case 'daily':
      if (anchorDateTime.getTime() >= now.getTime()) {
        return anchorDateTime;
      }
      return combineLocalDateAndTime(
        toDateKey(anchor > currentDay ? anchor : addDays(currentDay, 1)),
        input.time,
      );
    case 'weekly': {
      const anchorWeekday = input.startDate
        ? (anchor.getDay() as TaskWeekday)
        : (now.getDay() as TaskWeekday);
      return nextSelectedWeekday(
        [anchorWeekday],
        anchor > currentDay ? anchor : currentDay,
        input.time,
        now,
      );
    }
    case 'monthly': {
      const sourceDay = input.startDate ? anchor.getDate() : now.getDate();
      const monthCursor = anchor > currentDay ? anchor : currentDay;
      const firstCandidate = resolveMonthlyDate(
        monthCursor.getFullYear(),
        monthCursor.getMonth(),
        sourceDay,
      );
      const firstOccurrence = combineLocalDateAndTime(toDateKey(firstCandidate), input.time);
      if (firstOccurrence.getTime() >= now.getTime()) {
        return firstOccurrence;
      }
      const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
      const nextCandidate = resolveMonthlyDate(nextMonth.getFullYear(), nextMonth.getMonth(), sourceDay);
      return combineLocalDateAndTime(toDateKey(nextCandidate), input.time);
    }
    case 'yearly': {
      const monthIndex = input.startDate ? anchor.getMonth() : now.getMonth();
      const dayOfMonth = input.startDate ? anchor.getDate() : now.getDate();
      const yearCursor = anchor > currentDay ? anchor.getFullYear() : now.getFullYear();
      const firstCandidate = resolveYearlyDate(yearCursor, monthIndex, dayOfMonth);
      const firstOccurrence = combineLocalDateAndTime(toDateKey(firstCandidate), input.time);
      if (firstOccurrence.getTime() >= now.getTime()) {
        return firstOccurrence;
      }
      const nextCandidate = resolveYearlyDate(yearCursor + 1, monthIndex, dayOfMonth);
      return combineLocalDateAndTime(toDateKey(nextCandidate), input.time);
    }
    case 'set_days':
      return nextSelectedWeekday(input.selectedWeekdays, anchor, input.time, now);
    default:
      return anchorDateTime;
  }
}

export function getNextOccurrenceAfterTask(
  task: TaskTemplate,
  after: Date,
): Date | undefined {
  if (!task.isActive) return undefined;
  if (task.itemType === 'calendar_event') return undefined;

  const startDate = task.startDate ? new Date(`${task.startDate}T00:00:00`) : after;
  const input: TaskFormInput = {
    itemType: task.itemType,
    parentId: task.assignedParentId,
    title: task.title,
    time: task.time,
    startDate: task.startDate,
    repeat: task.repeat,
    selectedWeekdays: task.selectedWeekdays ?? [],
    ringAlarm: task.ringAlarm,
    requiresPhoto: task.requiresPhoto,
    missNotificationThreshold: task.missNotificationThreshold,
    eventTimezone: task.eventTimezone,
  };

  if (task.repeat === 'once') {
    const onlyOccurrence = getNextOccurrenceForInput(input, startDate);
    return onlyOccurrence.getTime() > after.getTime() ? onlyOccurrence : undefined;
  }

  return getNextOccurrenceForInput(
    {
      ...input,
      startDate:
        task.startDate && new Date(`${task.startDate}T00:00:00`).getTime() > after.getTime()
          ? toDateKey(after)
          : task.startDate,
    },
    new Date(after.getTime() + 1000),
  );
}

export function buildOccurrenceId(taskId: string, scheduledFor: string): string {
  return `occ-${taskId}-${scheduledFor}`;
}

export function isOccurrenceOverdue(
  occurrence: TaskOccurrence,
  now: Date,
  graceMinutes = TASK_GRACE_PERIOD_MINUTES,
): boolean {
  const dueTime = new Date(occurrence.scheduledFor);
  dueTime.setMinutes(dueTime.getMinutes() + graceMinutes);
  return now.getTime() > dueTime.getTime();
}

export function doesTaskOccurOnDate(
  task: Pick<TaskTemplate, 'startDate' | 'repeat' | 'selectedWeekdays'> & {
    itemType?: TaskItemType;
  },
  date: Date,
): boolean {
  if (task.itemType === 'calendar_event') return false;

  const dateKey = toDateKey(date);
  const startDateKey = task.startDate ?? dateKey;
  const start = startOfDay(new Date(`${startDateKey}T00:00:00`));
  const target = startOfDay(new Date(`${dateKey}T00:00:00`));

  if (target.getTime() < start.getTime()) return false;

  switch (task.repeat) {
    case 'once':
      return dateKey === startDateKey;
    case 'daily':
      return true;
    case 'weekly':
      return target.getDay() === start.getDay();
    case 'monthly': {
      const targetDay = target.getDate();
      const scheduledDay = Math.min(
        start.getDate(),
        lastDayOfMonth(target.getFullYear(), target.getMonth()),
      );
      return targetDay === scheduledDay;
    }
    case 'yearly': {
      const scheduled = resolveYearlyDate(
        target.getFullYear(),
        start.getMonth(),
        start.getDate(),
      );
      return toDateKey(scheduled) === dateKey;
    }
    case 'set_days':
      return Boolean(task.selectedWeekdays?.includes(target.getDay() as TaskWeekday));
    default:
      return false;
  }
}

export function getScheduledForLocalDate(dateKey: string, time: string): string {
  return combineLocalDateAndTime(dateKey, time).toISOString();
}
