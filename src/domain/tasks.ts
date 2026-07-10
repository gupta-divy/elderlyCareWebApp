import type {
  AppState,
  TaskAlarmRecord,
  TaskOccurrence,
  TaskStatus,
  TaskTemplate,
  TaskView,
  User,
} from '../types';
import { generateId, toDateKey } from '../utils/helpers';
import {
  TASK_GRACE_PERIOD_MINUTES,
  buildOccurrenceId,
  getNextOccurrenceAfterTask,
  getNextOccurrenceForInput,
  isOccurrenceOverdue,
  type TaskFormInput,
} from '../features/tasks/taskRecurrence';

export const DEFAULT_FAMILY_ID = 'family-demo';

function sortTaskViews(a: TaskView, b: TaskView): number {
  return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
}

function buildAlarmId(taskId: string, occurrenceId: string): string {
  return `alarm-${taskId}-${occurrenceId}`;
}

function isTaskVisible(task: TaskTemplate): boolean {
  return task.isActive;
}

export function getOccurrenceForTask(
  occurrences: TaskOccurrence[],
  taskId: string,
  scheduledFor: string,
): TaskOccurrence | undefined {
  return occurrences.find(
    (occurrence) =>
      occurrence.taskId === taskId && occurrence.scheduledFor === scheduledFor,
  );
}

function getPendingOccurrenceForTask(
  occurrences: TaskOccurrence[],
  taskId: string,
): TaskOccurrence | undefined {
  return occurrences
    .filter((occurrence) => occurrence.taskId === taskId && occurrence.status === 'pending')
    .sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    )[0];
}

function upsertOccurrence(
  occurrences: TaskOccurrence[],
  nextOccurrence: TaskOccurrence,
): TaskOccurrence[] {
  const existingIndex = occurrences.findIndex(
    (occurrence) => occurrence.id === nextOccurrence.id,
  );
  if (existingIndex === -1) return [...occurrences, nextOccurrence];

  return occurrences.map((occurrence, index) =>
    index === existingIndex ? nextOccurrence : occurrence,
  );
}

function getNextPendingOccurrence(task: TaskTemplate, now: Date): TaskOccurrence | undefined {
  const nextOccurrenceAt = task.nextOccurrenceAt
    ? new Date(task.nextOccurrenceAt)
    : getNextOccurrenceAfterTask(task, new Date(now.getTime() - 1000));
  if (!nextOccurrenceAt) return undefined;

  const iso = nextOccurrenceAt.toISOString();
  return {
    id: buildOccurrenceId(task.id, iso),
    taskId: task.id,
    assignedParentId: task.assignedParentId,
    scheduledFor: iso,
    status: 'pending',
    photoRequired: task.requiresPhoto,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function syncTaskOccurrenceAndAlarm(
  state: AppState,
  task: TaskTemplate,
  now: Date,
): AppState {
  let nextState = state;
  const pendingOccurrence = getPendingOccurrenceForTask(nextState.taskOccurrences, task.id);
  const nextPending = task.isActive ? getNextPendingOccurrence(task, now) : undefined;

  if (nextPending) {
    nextState = {
      ...nextState,
      taskOccurrences: upsertOccurrence(nextState.taskOccurrences, {
        ...pendingOccurrence,
        ...nextPending,
        completedAt: undefined,
        completedBy: undefined,
        photoConfirmed: undefined,
        proofUrl: pendingOccurrence?.proofUrl,
        createdAt: pendingOccurrence?.createdAt ?? nextPending.createdAt,
      }),
    };
  } else if (pendingOccurrence) {
    nextState = {
      ...nextState,
      taskOccurrences: nextState.taskOccurrences.filter(
        (occurrence) => occurrence.id !== pendingOccurrence.id,
      ),
    };
  }

  const nextAlarmRecords = syncAlarmRecordsForTask(
    nextState.taskAlarmRecords,
    task,
    getPendingOccurrenceForTask(nextState.taskOccurrences, task.id),
    now,
  );

  return { ...nextState, taskAlarmRecords: nextAlarmRecords };
}

function syncAlarmRecordsForTask(
  records: TaskAlarmRecord[],
  task: TaskTemplate,
  pendingOccurrence: TaskOccurrence | undefined,
  now: Date,
): TaskAlarmRecord[] {
  const activeAlarmId = pendingOccurrence
    ? buildAlarmId(task.id, pendingOccurrence.id)
    : undefined;

  const nextRecords: TaskAlarmRecord[] = records.map((record) => {
    if (record.taskId !== task.id) return record;
    if (
      activeAlarmId &&
      record.id === activeAlarmId &&
      task.ringAlarm &&
      pendingOccurrence &&
      new Date(pendingOccurrence.scheduledFor).getTime() >= now.getTime()
    ) {
      return {
        ...record,
        occurrenceId: pendingOccurrence.id,
        assignedParentId: task.assignedParentId,
        scheduledFor: pendingOccurrence.scheduledFor,
        status: 'scheduled',
        updatedAt: now.toISOString(),
      };
    }

    return {
      ...record,
      status: record.status === 'fired' ? 'fired' : 'cancelled',
      updatedAt: now.toISOString(),
    };
  });

  if (
    activeAlarmId &&
    task.ringAlarm &&
    pendingOccurrence &&
    new Date(pendingOccurrence.scheduledFor).getTime() >= now.getTime() &&
    !nextRecords.some((record) => record.id === activeAlarmId)
  ) {
    nextRecords.push({
      id: activeAlarmId,
      taskId: task.id,
      occurrenceId: pendingOccurrence.id,
      assignedParentId: task.assignedParentId,
      scheduledFor: pendingOccurrence.scheduledFor,
      status: 'scheduled',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }

  return nextRecords;
}

export function getTasksForParent(state: AppState, parentId: string): TaskView[] {
  const views: TaskView[] = [];
  const today = toDateKey();

  state.taskTemplates
    .filter((task) => task.assignedParentId === parentId && isTaskVisible(task))
    .forEach((task) => {
      const occurrence = state.taskOccurrences
        .filter(
          (entry) =>
            entry.taskId === task.id && toDateKey(entry.scheduledFor) === today,
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
        )[0];

      if (!occurrence) return;

      views.push({
        ...task,
        occurrenceId: occurrence.id,
        scheduledFor: occurrence.scheduledFor,
        status: occurrence.status,
        completedAt: occurrence.completedAt,
        photoConfirmed: occurrence.photoConfirmed,
        proofUrl: occurrence.proofUrl,
      });
    });

  return views.sort(sortTaskViews);
}

export function getTaskHistoryForParent(state: AppState, parentId: string): TaskView[] {
  const views: TaskView[] = [];

  state.taskTemplates
    .filter((task) => task.assignedParentId === parentId)
    .forEach((task) => {
      const occurrences = state.taskOccurrences
        .filter((entry) => entry.taskId === task.id)
        .sort(
          (a, b) =>
            new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime(),
        );

      occurrences.forEach((occurrence) => {
        views.push({
          ...task,
          occurrenceId: occurrence.id,
          scheduledFor: occurrence.scheduledFor,
          status: occurrence.status,
          completedAt: occurrence.completedAt,
          photoConfirmed: occurrence.photoConfirmed,
          proofUrl: occurrence.proofUrl,
        });
      });
    });

  return views.sort(
    (a, b) =>
      new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime(),
  );
}

export function getTaskSummaryForParent(state: AppState, parentId: string) {
  const tasks = getTasksForParent(state, parentId);
  return {
    total: tasks.length,
    done: tasks.filter((task) => task.status === 'done').length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    missed: tasks.filter((task) => task.status === 'missed').length,
  };
}

function syncTaskState(state: AppState, taskId: string, now: Date): AppState {
  const task = state.taskTemplates.find((entry) => entry.id === taskId);
  if (!task) return state;
  return syncTaskOccurrenceAndAlarm(state, task, now);
}

export function saveTaskDefinition(
  state: AppState,
  input: TaskFormInput,
  actor: User,
  taskId?: string,
  now = new Date(),
): AppState {
  const occurrenceAt = getNextOccurrenceForInput(input, now).toISOString();
  const existing = taskId
    ? state.taskTemplates.find((task) => task.id === taskId)
    : undefined;

  const nextTask: TaskTemplate = {
    id: existing?.id ?? generateId('task'),
    familyId: existing?.familyId ?? DEFAULT_FAMILY_ID,
    assignedParentId: input.parentId,
    createdByChildId: existing?.createdByChildId ?? actor.id,
    title: input.title.trim(),
    time: input.time,
    startDate: input.startDate || undefined,
    repeat: input.repeat,
    selectedWeekdays:
      input.repeat === 'set_days' ? [...input.selectedWeekdays].sort() : undefined,
    ringAlarm: input.ringAlarm,
    requiresPhoto: input.requiresPhoto,
    isActive: true,
    nextOccurrenceAt: occurrenceAt,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const nextState: AppState = {
    ...state,
    taskTemplates: existing
      ? state.taskTemplates.map((task) => (task.id === taskId ? nextTask : task))
      : [...state.taskTemplates, nextTask],
    taskOccurrences: state.taskOccurrences.filter((occurrence) =>
      existing
        ? occurrence.taskId !== existing.id || occurrence.status !== 'pending'
        : true,
    ),
  };

  return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}

export function completeTaskOccurrence(
  state: AppState,
  occurrenceId: string,
  completedBy: string,
  options?: { proofUrl?: string; photoConfirmed?: boolean },
  now = new Date(),
): AppState {
  const occurrence = state.taskOccurrences.find((entry) => entry.id === occurrenceId);
  if (!occurrence || occurrence.status === 'done') return state;

  const task = state.taskTemplates.find((entry) => entry.id === occurrence.taskId);
  if (!task) return state;

  const nextOccurrences = state.taskOccurrences.map((entry) =>
    entry.id === occurrenceId
      ? {
          ...entry,
          status: 'done' as TaskStatus,
          completedAt: now.toISOString(),
          completedBy,
          photoConfirmed: options?.photoConfirmed ?? entry.photoConfirmed,
          proofUrl: options?.proofUrl ?? entry.proofUrl,
          updatedAt: now.toISOString(),
        }
      : entry,
  );

  const nextTask = {
    ...task,
    nextOccurrenceAt: getNextOccurrenceAfterTask(task, new Date(occurrence.scheduledFor))?.toISOString(),
    updatedAt: now.toISOString(),
  };

  const nextState: AppState = {
    ...state,
    taskTemplates: state.taskTemplates.map((entry) =>
      entry.id === task.id ? nextTask : entry,
    ),
    taskOccurrences: nextOccurrences,
  };

  return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}

export function reopenTaskOccurrence(
  state: AppState,
  occurrenceId: string,
  now = new Date(),
): AppState {
  const occurrence = state.taskOccurrences.find((entry) => entry.id === occurrenceId);
  if (!occurrence) return state;

  const nextState: AppState = {
    ...state,
    taskOccurrences: state.taskOccurrences.map((entry) =>
      entry.id === occurrenceId
        ? {
            ...entry,
            status: 'pending',
            completedAt: undefined,
            completedBy: undefined,
            photoConfirmed: undefined,
            proofUrl: undefined,
            updatedAt: now.toISOString(),
          }
        : entry,
    ),
  };

  return syncTaskState(nextState, occurrence.taskId, now);
}

export function deleteTaskDefinition(
  state: AppState,
  taskId: string,
  now = new Date(),
): AppState {
  const task = state.taskTemplates.find((entry) => entry.id === taskId);
  if (!task) return state;

  const nextTask = {
    ...task,
    isActive: false,
    nextOccurrenceAt: undefined,
    updatedAt: now.toISOString(),
  };

  const nextState: AppState = {
    ...state,
    taskTemplates: state.taskTemplates.map((entry) =>
      entry.id === taskId ? nextTask : entry,
    ),
    taskOccurrences: state.taskOccurrences.filter(
      (occurrence) => !(occurrence.taskId === taskId && occurrence.status === 'pending'),
    ),
  };

  return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}

export function deleteTaskOccurrenceRecord(
  state: AppState,
  occurrenceId: string,
  now = new Date(),
): AppState {
  const occurrence = state.taskOccurrences.find((entry) => entry.id === occurrenceId);
  if (!occurrence || occurrence.status === 'pending') return state;

  const nextState: AppState = {
    ...state,
    taskOccurrences: state.taskOccurrences.filter((entry) => entry.id !== occurrenceId),
  };

  return syncTaskState(nextState, occurrence.taskId, now);
}

export function setTaskActive(
  state: AppState,
  taskId: string,
  isActive: boolean,
  now = new Date(),
): AppState {
  const task = state.taskTemplates.find((entry) => entry.id === taskId);
  if (!task) return state;

  const nextTask = {
    ...task,
    isActive,
    nextOccurrenceAt: isActive
      ? getNextOccurrenceAfterTask(task, new Date(now.getTime() - 1000))?.toISOString()
      : undefined,
    updatedAt: now.toISOString(),
  };

  const nextState: AppState = {
    ...state,
    taskTemplates: state.taskTemplates.map((entry) =>
      entry.id === taskId ? nextTask : entry,
    ),
    taskOccurrences: state.taskOccurrences.filter(
      (occurrence) => !(occurrence.taskId === taskId && occurrence.status === 'pending'),
    ),
  };

  return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}

export function markMissedTaskOccurrences(state: AppState, now = new Date()): AppState {
  let nextState = state;

  for (const occurrence of state.taskOccurrences) {
    if (occurrence.status !== 'pending') continue;
    if (!isOccurrenceOverdue(occurrence, now, TASK_GRACE_PERIOD_MINUTES)) continue;

    const task = nextState.taskTemplates.find((entry) => entry.id === occurrence.taskId);
    if (!task) continue;

    const updatedOccurrence: TaskOccurrence = {
      ...occurrence,
      status: 'missed',
      updatedAt: now.toISOString(),
    };

    const nextTask = {
      ...task,
      nextOccurrenceAt: getNextOccurrenceAfterTask(task, new Date(occurrence.scheduledFor))?.toISOString(),
      updatedAt: now.toISOString(),
    };

    nextState = {
      ...nextState,
      taskTemplates: nextState.taskTemplates.map((entry) =>
        entry.id === task.id ? nextTask : entry,
      ),
      taskOccurrences: upsertOccurrence(nextState.taskOccurrences, updatedOccurrence),
    };

    nextState = syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
  }

  return nextState;
}

export function normalizeTaskState(state: AppState, now = new Date()): AppState {
  return state.taskTemplates.reduce(
    (nextState, task) => syncTaskOccurrenceAndAlarm(nextState, task, now),
    state,
  );
}
