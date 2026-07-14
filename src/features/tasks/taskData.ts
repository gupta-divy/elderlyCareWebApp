import type {
  MissNotificationThreshold,
  TaskItemType,
  TaskRepeat,
  TaskStatus,
  TaskTemplate,
  TaskView,
  TaskWeekday,
} from '../../types';
import { TASK_GRACE_PERIOD_MINUTES, doesTaskOccurOnDate, getScheduledForLocalDate } from './taskRecurrence';
import { formatDate, formatLocalTime, toDateKey } from '../../utils/helpers';

export type TaskCompletionStatus = 'completed' | 'missed' | 'skipped';

export type TaskRow = {
  id: string;
  family_id: string;
  assigned_to: string;
  created_by: string;
  item_type?: TaskItemType;
  title: string;
  task_time: string | null;
  start_date: string;
  repeat_type: TaskRepeat;
  repeat_days: TaskWeekday[] | null;
  requires_alarm: boolean;
  requires_photo: boolean;
  miss_notification_threshold?: MissNotificationThreshold | null;
  consecutive_miss_count?: number | null;
  attention_active?: boolean | null;
  attention_raised_at?: string | null;
  last_missed_occurrence_at?: string | null;
  event_timezone?: string | null;
  event_reminder_one_day_sent_at?: string | null;
  event_reminder_two_hours_sent_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskCompletionRow = {
  id: string;
  task_id: string;
  family_id: string;
  completed_by: string;
  scheduled_for: string;
  status: TaskCompletionStatus;
  completed_at: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskDraft = {
  familyId: string;
  assignedTo: string;
  createdBy: string;
  title: string;
  taskTime: string | null;
  startDate?: string;
  repeatType: TaskRepeat;
  repeatDays?: TaskWeekday[];
  requiresAlarm: boolean;
  requiresPhoto: boolean;
  itemType?: TaskItemType;
  missNotificationThreshold?: MissNotificationThreshold;
  eventTimezone?: string;
};

export type CloudTaskView = TaskView & {
  familyId: string;
  completionId?: string;
  cloudStatus: 'pending' | TaskCompletionStatus;
};

export type RoutineAttentionItem = {
  taskId: string;
  parentId: string;
  parentName?: string;
  title: string;
  consecutiveMisses: number;
  threshold: MissNotificationThreshold;
  message: string;
  lastMissedAt?: string;
};

export type CalendarEventView = {
  id: string;
  familyId: string;
  parentId: string;
  title: string;
  date: string;
  time: string;
  timezone: string;
  scheduledFor: string;
  isUpcoming: boolean;
};

export function normalizeLocalDateKey(dateKey?: string | null, fallback = new Date()) {
  return dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? dateKey
    : fallback.toISOString().slice(0, 10);
}

export function mapTaskRow(row: TaskRow): TaskTemplate {
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

export function toTaskInsert(draft: TaskDraft) {
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

export function toTaskUpdate(draft: Omit<TaskDraft, 'familyId' | 'createdBy'>) {
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

export function getCompletionForOccurrence(
  completions: TaskCompletionRow[],
  taskId: string,
  scheduledFor: string,
) {
  return completions.find(
    (completion) =>
      completion.task_id === taskId &&
      new Date(completion.scheduled_for).getTime() === new Date(scheduledFor).getTime(),
  );
}

export function isOccurrenceMissed(scheduledFor: string, now = new Date()) {
  const due = new Date(scheduledFor);
  due.setMinutes(due.getMinutes() + TASK_GRACE_PERIOD_MINUTES);
  return now.getTime() > due.getTime();
}

export function mapCompletionStatus(status: TaskCompletionStatus): TaskStatus {
  return status === 'completed' ? 'done' : 'missed';
}

export function buildTaskViewsForDate(
  tasks: TaskRow[],
  completions: TaskCompletionRow[],
  dateKey: string,
  now = new Date(),
): CloudTaskView[] {
  return tasks
    .map(mapTaskRow)
    .filter((task) => task.itemType === 'routine_task' && task.isActive && doesTaskOccurOnDate(task, new Date(`${dateKey}T00:00:00`)))
    .map((task) => {
      const scheduledFor = getScheduledForLocalDate(dateKey, task.time);
      const completion = getCompletionForOccurrence(completions, task.id, scheduledFor);
      const cloudStatus: CloudTaskView['cloudStatus'] =
        completion?.status ?? (isOccurrenceMissed(scheduledFor, now) ? 'missed' : 'pending');
      const status: TaskStatus = completion
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

export function filterTasksForParent(tasks: TaskRow[], parentId: string) {
  return tasks.filter((task) => task.assigned_to === parentId);
}

export function canParentCompleteTask(task: TaskRow, userId: string, familyId: string) {
  return task.family_id === familyId && task.assigned_to === userId && task.is_active && (task.item_type ?? 'routine_task') === 'routine_task';
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function countConsecutiveMisses(
  task: TaskTemplate,
  completions: TaskCompletionRow[],
  now = new Date(),
): { count: number; lastMissedAt?: string } {
  if (task.itemType !== 'routine_task' || task.missNotificationThreshold === 0) {
    return { count: 0 };
  }

  let count = 0;
  let lastMissedAt: string | undefined;
  const cursor = new Date(`${toDateKey(now)}T00:00:00`);

  for (let daysBack = 0; daysBack < 120; daysBack += 1) {
    const date = addDays(cursor, -daysBack);
    if (!doesTaskOccurOnDate(task, date)) continue;

    const dateKey = toDateKey(date);
    const scheduledFor = getScheduledForLocalDate(dateKey, task.time);
    if (!isOccurrenceMissed(scheduledFor, now)) continue;

    const completion = getCompletionForOccurrence(completions, task.id, scheduledFor);
    if (completion?.status === 'completed') break;
    if (completion?.status === 'skipped') break;

    count += 1;
    lastMissedAt ??= scheduledFor;
    if (count >= task.missNotificationThreshold) break;
  }

  return { count, lastMissedAt };
}

export function buildRoutineAttentionItems(
  tasks: TaskRow[],
  completions: TaskCompletionRow[],
  parentNames: Record<string, string> = {},
  now = new Date(),
): RoutineAttentionItem[] {
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

export function buildCalendarEvents(
  tasks: TaskRow[],
  now = new Date(),
): CalendarEventView[] {
  return tasks
    .filter((task) => task.is_active && (task.item_type ?? 'routine_task') === 'calendar_event')
    .map((task) => {
      const time = task.task_time?.slice(0, 5) ?? '00:00';
      const scheduledFor = getScheduledForLocalDate(task.start_date, time);
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

export function eventSummary(event: CalendarEventView) {
  return `${formatDate(event.scheduledFor)} at ${formatLocalTime(event.time)}`;
}
