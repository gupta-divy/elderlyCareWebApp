import type { TaskRepeat, TaskStatus, TaskTemplate, TaskView, TaskWeekday } from '../../types';
import { TASK_GRACE_PERIOD_MINUTES, doesTaskOccurOnDate, getScheduledForLocalDate } from './taskRecurrence';

export type TaskCompletionStatus = 'completed' | 'missed' | 'skipped';

export type TaskRow = {
  id: string;
  family_id: string;
  assigned_to: string;
  created_by: string;
  title: string;
  task_time: string;
  start_date: string;
  repeat_type: TaskRepeat;
  repeat_days: TaskWeekday[] | null;
  requires_alarm: boolean;
  requires_photo: boolean;
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
  taskTime: string;
  startDate?: string;
  repeatType: TaskRepeat;
  repeatDays?: TaskWeekday[];
  requiresAlarm: boolean;
  requiresPhoto: boolean;
};

export type CloudTaskView = TaskView & {
  familyId: string;
  completionId?: string;
  cloudStatus: 'pending' | TaskCompletionStatus;
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

export function toTaskInsert(draft: TaskDraft) {
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

export function toTaskUpdate(draft: Omit<TaskDraft, 'familyId' | 'createdBy'>) {
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
    .filter((task) => task.isActive && doesTaskOccurOnDate(task, new Date(`${dateKey}T00:00:00`)))
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
  return task.family_id === familyId && task.assigned_to === userId && task.is_active;
}
