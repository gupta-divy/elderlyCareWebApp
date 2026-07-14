import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import { toDateKey } from '../../utils/helpers';
import type { TaskOccurrence, TaskTemplate, TaskWeekday } from '../../types';
import {
  buildCalendarEvents,
  buildRoutineAttentionItems,
  buildTaskViewsForDate,
  filterTasksForParent,
  type CalendarEventView,
  type CloudTaskView,
  type RoutineAttentionItem,
  type TaskCompletionRow,
  type TaskDraft,
  type TaskRow,
} from './taskData';
import {
  completeTask as completeTaskOccurrence,
  createTask,
  deactivateTask,
  listTasksForFamily,
  listTasksForParent,
  loadCompletions,
  toTaskError,
  updateTask,
} from './taskService';

function getDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function getLookbackRange(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 120);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function toDemoTaskRow(task: TaskTemplate): TaskRow {
  return {
    id: task.id,
    family_id: task.familyId,
    assigned_to: task.assignedParentId,
    created_by: task.createdByChildId,
    item_type: task.itemType,
    title: task.title,
    task_time: task.time || null,
    start_date: task.startDate ?? toDateKey(task.createdAt),
    repeat_type: task.repeat,
    repeat_days: task.selectedWeekdays ?? null,
    requires_alarm: task.ringAlarm,
    requires_photo: false,
    miss_notification_threshold: task.missNotificationThreshold,
    consecutive_miss_count: task.consecutiveMissCount,
    attention_active: task.attentionActive,
    attention_raised_at: task.attentionRaisedAt ?? null,
    last_missed_occurrence_at: task.lastMissedOccurrenceAt ?? null,
    event_timezone: task.eventTimezone ?? null,
    event_reminder_one_day_sent_at: task.eventReminderOneDaySentAt ?? null,
    event_reminder_two_hours_sent_at: task.eventReminderTwoHoursSentAt ?? null,
    is_active: task.isActive,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function toDemoCompletionRow(
  occurrence: TaskOccurrence,
  familyId: string,
): TaskCompletionRow {
  return {
    id: occurrence.id,
    task_id: occurrence.taskId,
    family_id: familyId,
    completed_by: occurrence.completedBy ?? occurrence.assignedParentId,
    scheduled_for: occurrence.scheduledFor,
    status: occurrence.status === 'done' ? 'completed' : occurrence.status,
    completed_at: occurrence.completedAt ?? null,
    photo_path: occurrence.proofUrl ?? null,
    created_at: occurrence.createdAt,
    updated_at: occurrence.updatedAt,
  };
}

export function useCloudTasks(parentId?: string | null) {
  const app = useApp();
  const { user } = useAuth();
  const { activeFamily, currentMembership, familyMembers, isChild, isParent } = useFamily();
  const familyId = activeFamily?.id ?? currentMembership?.familyId ?? null;
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [completions, setCompletions] = useState<TaskCompletionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todayKey = toDateKey();

  const refresh = useCallback(async () => {
    if (app.isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured || !user || !familyId) {
      setTasks([]);
      setCompletions([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const visibleTasks = isParent
        ? await listTasksForParent(user.id)
        : await listTasksForFamily(familyId);
      const visibleCompletions = await loadCompletions({
        familyId,
        ...(isChild ? getLookbackRange() : getDayRange(todayKey)),
      });
      setTasks(visibleTasks);
      setCompletions(visibleCompletions);
    } catch (loadError) {
      setError(toTaskError(loadError));
    } finally {
      setLoading(false);
    }
  }, [app.isDemoMode, familyId, isParent, todayKey, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedParentTasks = useMemo(
    () => {
      const sourceTasks = app.isDemoMode ? app.state.taskTemplates.map(toDemoTaskRow) : tasks;
      return parentId ? filterTasksForParent(sourceTasks, parentId) : sourceTasks;
    },
    [app.isDemoMode, app.state.taskTemplates, parentId, tasks],
  );

  const demoCompletions = useMemo(
    () =>
      app.isDemoMode
        ? app.state.taskOccurrences.map((occurrence) =>
            toDemoCompletionRow(occurrence, familyId ?? 'family-demo'),
          )
        : completions,
    [app.isDemoMode, app.state.taskOccurrences, completions, familyId],
  );

  const todayTasks = useMemo(
    () => buildTaskViewsForDate(selectedParentTasks, demoCompletions, todayKey),
    [demoCompletions, selectedParentTasks, todayKey],
  );

  const activeTasks = useMemo(
    () => selectedParentTasks.filter((task) => task.is_active && (task.item_type ?? 'routine_task') === 'routine_task'),
    [selectedParentTasks],
  );

  const calendarEvents: CalendarEventView[] = useMemo(
    () => buildCalendarEvents(selectedParentTasks),
    [selectedParentTasks],
  );

  const parentNames = useMemo(
    () =>
      Object.fromEntries(
        familyMembers
          .filter((member) => member.role === 'parent')
          .map((member) => [member.userId, member.profile.fullName]),
      ),
    [familyMembers],
  );

  const attentionItems: RoutineAttentionItem[] = useMemo(
    () => buildRoutineAttentionItems(selectedParentTasks, demoCompletions, parentNames),
    [demoCompletions, parentNames, selectedParentTasks],
  );

  const saveTask = useCallback(
    async (input: {
      taskId?: string;
      assignedTo: string;
      title: string;
      taskTime: string | null;
      startDate?: string;
      repeatType: TaskDraft['repeatType'];
      repeatDays?: TaskWeekday[];
      requiresAlarm: boolean;
      requiresPhoto: boolean;
      itemType?: TaskDraft['itemType'];
      missNotificationThreshold?: TaskDraft['missNotificationThreshold'];
      eventTimezone?: string;
    }) => {
      if (app.isDemoMode) {
        app.saveTask({
          itemType: input.itemType ?? 'routine_task',
          parentId: input.assignedTo,
          title: input.title,
          time: input.taskTime ?? '',
          startDate: input.startDate ?? '',
          repeat: input.repeatType,
          selectedWeekdays: input.repeatDays ?? [],
          ringAlarm: input.requiresAlarm,
          requiresPhoto: false,
          missNotificationThreshold: input.missNotificationThreshold,
          eventTimezone: input.eventTimezone,
        }, input.taskId);
        return;
      }
      if (!user || !familyId || !isChild || saving) return;
      setSaving(true);
      setError(null);
      try {
        if (input.taskId) {
          await updateTask(input.taskId, input);
        } else {
          await createTask({
            familyId,
            createdBy: user.id,
            ...input,
          });
        }
        await refresh();
      } catch (saveError) {
        setError(toTaskError(saveError));
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [app, familyId, isChild, refresh, saving, user],
  );

  const deactivate = useCallback(
    async (taskId: string) => {
      if (app.isDemoMode) {
        app.deleteTask(taskId);
        return;
      }
      if (!isChild || saving) return;
      setSaving(true);
      setError(null);
      try {
        await deactivateTask(taskId);
        await refresh();
      } catch (saveError) {
        setError(toTaskError(saveError));
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [app, isChild, refresh, saving],
  );

  const complete = useCallback(
    async (task: CloudTaskView) => {
      if (app.isDemoMode) {
        app.completeTask(task.occurrenceId);
        return;
      }
      if (!user || !familyId || !isParent || saving) return;
      setSaving(true);
      setError(null);
      try {
        await completeTaskOccurrence({
          taskId: task.id,
          familyId,
          completedBy: user.id,
          scheduledFor: task.scheduledFor,
        });
        await refresh();
      } catch (saveError) {
        setError(toTaskError(saveError));
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [app, familyId, isParent, refresh, saving, user],
  );

  return {
    tasks,
    activeTasks,
    attentionItems,
    calendarEvents,
    todayTasks,
    loading,
    saving,
    error,
    refresh,
    saveTask,
    deactivateTask: deactivate,
    completeTask: complete,
  };
}
